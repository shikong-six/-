// 本机重排：问题和法条一起打分，不调用 Kimi。
// 开头和全文分两轮打。同一轮里两条同时算。
// 不把不同长度的条文垫进同一次计算，那样分数会变。
// 通用规则有两条，不针对某一句问法：
// 1. 法条开头才是罪名和适用对象。后文里顺带出现的动词不能单独算相关。
// 2. 开头限定了特定身份或场所，而用户没提到的，不能仅凭行为动词选用。
import {AutoModelForSequenceClassification, AutoTokenizer, env, type PreTrainedModel, type PreTrainedTokenizer} from '@huggingface/transformers';

const MODEL_ID = 'Xenova/bge-reranker-base';
// 开头几乎对不上，说明相关只来自后文的某个词。
const LEAD_DEAD = 0.08;
// 全文分明显高于开头，多半是后文的从重情节带起来的。
const LEAD_GAP = 0.22;
export const RERANK_FLOOR = 0.4;
// 这些词表示条文只适用于特定身份，不是一般人之间的行为。
const LIMITED_ACTOR = /监管|被关押|国家机关|国家工作人员|司法工作人员|军人|公款|看守所|监狱|拘留所|职务上|依法从事[^。]{0,30}的人员/;
// 开头写明了特定的人、场所或前提。问题里没有对应说法时，后文里同一个动词不能把这条留下。
const SCENE_GATES: Array<{statute: RegExp; user: RegExp}> = [
  {statute: /证人|鉴定人|记录人|翻译人/, user: /证人|鉴定|作伪证|伪证|作证/},
  {statute: /公共交通工具/, user: /公交|地铁|客运|列车|火车|船舶|航空|飞机/},
  {statute: /未经允许驾驶他人机动车/, user: /未经允许|未征得|别人的车|他人的车|他人机动车/},
  {statute: /公民个人信息/, user: /个人信息|公民信息/},
  {statute: /刑事诉讼/, user: /刑事诉讼|刑事案/},
  {statute: /被绑架人/, user: /绑架/},
  {statute: /会计、统计/, user: /会计|统计/},
  {statute: /暂时没有意识|失去控制/, user: /没有意识|失去意识|失去控制|不清醒|神志/},
  {statute: /都没有过错/, user: /没有过错|无过错/},
  {statute: /受害人故意/, user: /受害人故意|自己故意|故意让/},
  {statute: /不法侵害/, user: /防卫|反击|不法侵害/},
  {statute: /动物/, user: /动物|宠物|狗|猫/},
  {statute: /知识产权|专利权|著作权|商标/, user: /知识产权|专利|著作权|商标/},
];

const modelHost = (process.env.HF_ENDPOINT || 'https://www.modelscope.cn/models/').replace(/\/?$/, '/');
env.remoteHost = modelHost;
if (modelHost.includes('modelscope.cn')) {
  env.remotePathTemplate = '{model}/resolve/master/';
}

type Ranker = {tokenizer: PreTrainedTokenizer; model: PreTrainedModel};
// 不同长度垫到同一行后，重排分会变，通过线会跟着歪。所以每条仍单独算。
// 准备两份模型同时算，互不抢同一次前向。
const RERANK_WORKERS = 2;
const rankerPromises: Array<Promise<Ranker> | null> = Array(RERANK_WORKERS).fill(null);
const rankerTails: Promise<void>[] = Array.from({length: RERANK_WORKERS}, () => Promise.resolve());

function exclusiveSlot<T>(slot: number, job: () => Promise<T>): Promise<T> {
  const run = rankerTails[slot].then(job, job);
  rankerTails[slot] = run.then(() => undefined, () => undefined);
  return run;
}

function getRanker(slot: number): Promise<Ranker> {
  if (!rankerPromises[slot]) {
    if (slot === 0) console.log('正在加载 bge-reranker（首次会下载模型）…');
    rankerPromises[slot] = Promise.all([
      AutoTokenizer.from_pretrained(MODEL_ID),
      AutoModelForSequenceClassification.from_pretrained(MODEL_ID, {dtype: 'q8'}),
    ]).then(([tokenizer, model]) => ({tokenizer, model})).catch((error) => {
      rankerPromises[slot] = null;
      throw error;
    });
  }
  return rankerPromises[slot] as Promise<Ranker>;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function finite(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NEGATIVE_INFINITY;
}

function logitsOf(output: {logits?: {tolist?: () => unknown}}, count: number): number[] {
  const list = output.logits?.tolist?.();
  if (!Array.isArray(list) || count === 0) return Array(count).fill(Number.NEGATIVE_INFINITY);
  if (count === 1) return [finite((list as unknown[]).flat(2)[0])];
  const rows = list as unknown[];
  if (rows.length === count) {
    return rows.map((row) => finite(Array.isArray(row) ? (row as unknown[]).flat(2)[0] : row));
  }
  const flat = (list as unknown[]).flat(2);
  return Array.from({length: count}, (_, index) => finite(flat[index]));
}

// 第X条到第一个句号，是这条的罪名和适用对象。
export function leadSentence(passage: string): string {
  const body = passage
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('《'))
    .join('');
  const end = body.indexOf('。');
  const lead = end > 0 ? body.slice(0, end + 1) : body.slice(0, 180);
  return lead || passage.slice(0, 180);
}

async function rawScores(question: string, passages: string[]): Promise<number[]> {
  if (passages.length === 0) return [];
  const scores = new Array<number>(passages.length);
  let cursor = 0;
  const workers = Math.min(RERANK_WORKERS, passages.length);
  await Promise.all(Array.from({length: workers}, (_, slot) => (async () => {
    for (;;) {
      const index = cursor++;
      if (index >= passages.length) return;
      const passage = passages[index].slice(0, 1500);
      scores[index] = await exclusiveSlot(slot, async () => {
        const {tokenizer, model} = await getRanker(slot);
        const inputs = await tokenizer(question, {
          text_pair: passage,
          padding: true,
          truncation: true,
          max_length: 512,
        });
        const output = await model(inputs);
        return sigmoid(logitsOf(output, 1)[0]);
      });
    }
  })()));
  return scores;
}

function sceneMismatch(lead: string, question: string): boolean {
  return SCENE_GATES.some((gate) => gate.statute.test(lead) && !gate.user.test(question));
}

// 返回采用分。对不上返回 null，调用方就不要把这条送去回答。
// question 用来打分，可以带上检索用的法条用语；gateText 只用用户原话做主体、场所核对。
export async function fitScore(question: string, passage: string, gateText = question): Promise<number | null> {
  const lead = leadSentence(passage);
  if (LIMITED_ACTOR.test(lead) && !LIMITED_ACTOR.test(gateText)) return null;
  if (sceneMismatch(lead, gateText)) return null;
  const [opening] = await rawScores(question, [lead]);
  if (opening < LEAD_DEAD) return null;
  const [full] = await rawScores(question, [passage]);
  if (full - opening > LEAD_GAP) return null;
  const score = Math.max(full, opening);
  return score >= RERANK_FLOOR ? score : null;
}

export interface RankedPassage<T> {
  item: T;
  score: number;
}

// 打分通过的全部候选，按相关分从高到低。主体或场所对不上的已经丢掉。
export async function scorePassages<T>(
  question: string,
  items: T[],
  textOf: (item: T) => string,
  gateText = question
): Promise<RankedPassage<T>[]> {
  const pending: Array<{item: T; lead: string; text: string}> = [];
  for (const item of items) {
    const text = textOf(item);
    const lead = leadSentence(text);
    if (LIMITED_ACTOR.test(lead) && !LIMITED_ACTOR.test(gateText)) continue;
    if (sceneMismatch(lead, gateText)) continue;
    pending.push({item, lead, text});
  }
  if (pending.length === 0) return [];
  const openings = await rawScores(question, pending.map((row) => row.lead));
  const survivors: Array<{item: T; text: string; opening: number}> = [];
  pending.forEach((row, index) => {
    const opening = openings[index];
    if (opening < LEAD_DEAD) return;
    survivors.push({item: row.item, text: row.text, opening});
  });
  if (survivors.length === 0) return [];
  const fulls = await rawScores(question, survivors.map((row) => row.text));
  const scored: RankedPassage<T>[] = [];
  survivors.forEach((row, index) => {
    const full = fulls[index];
    if (full - row.opening > LEAD_GAP) return;
    const score = Math.max(full, row.opening);
    if (score >= RERANK_FLOOR) scored.push({item: row.item, score});
  });
  return scored.sort((a, b) => b.score - a.score);
}

// 按相关分从高到低留下不超过 keep 条。都对不上就一条都不留。
export async function rankPassages<T>(
  question: string,
  items: T[],
  textOf: (item: T) => string,
  keep: number,
  gateText = question
): Promise<RankedPassage<T>[]> {
  const ranked = await scorePassages(question, items, textOf, gateText);
  if (ranked.length === 0) return [];
  // 只留和最相近的那条差不多的。差一截的不要为了凑条数硬塞进去。
  const best = ranked[0].score;
  return ranked.filter((row) => row.score >= best - 0.12).slice(0, keep);
}
