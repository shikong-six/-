// 多路召回 + 本机重排
// 向量最相近的前几条经常只是共用了一个动词，适用场景并不是用户说的那件事。
// 重排在本机看整条法条，分不够就丢掉，不为此再调用 Kimi。
// 复杂问题按连接词在本地拆开，每件事单独检索、单独重排。
import {embedQueries, embedQuery} from './embedding';
import {leadSentence, scorePassages, type RankedPassage} from './rerankLocal';
import {chunkRelevant, listChunkTexts, searchChunks} from './vectorStore';
import {lawTitleFromDocName} from './textSplitter';

export interface RetrievedChunk {
  text: string;
  docName: string;
  chunkIndex: number;
}

// 口语到法条用语。只用于检索，不直接当成答案。
const EXPANSIONS: Array<{pattern: RegExp; terms: string[]}> = [
  // 「醉酒开(车)」是实测漏掉的口语形式：原规则只认「醉酒驾驶/醉驾/酒驾」，
  // 于是「我醉酒开车撞了人」一个同义词都补不出来，刑法第133条被重排丢在 3 条之外。
  {pattern: /酒驾|醉驾|醉酒驾驶|醉酒开|酒后驾车|酒后开车|喝酒开车|喝酒开|喝酒驾车|酒后开/, terms: ['醉酒驾驶']},
  {pattern: /打人|动手打|殴打|伤人|把人打|把我打|被打|被人打|挨打|打了我|打伤/, terms: ['故意伤害', '造成人身损害']},
  {pattern: /逃逸|逃跑/, terms: ['逃逸', '逃离现场']},
  // 「开车撞了人」这类问法原来一个词都补不出来（规则里只有打人、醉驾），词法那一路整个空转：
  // 实测「开车撞了人，刑事和民事分别怎么处理」的纯向量 top-24 里，道交法第七十六条根本不在，
  // 而它开头写的正是"机动车发生交通事故造成人身伤亡、财产损失的……予以赔偿"。
  // 用它开头真实存在的词去命中它（也顺带照顾「上班路上被车撞」那条的多事项召回）。
  {pattern: /撞人|撞了|撞伤|撞到|撞死|车祸|交通事故|肇事|被车撞|开车撞/, terms: ['交通事故', '人身伤亡']},
  {pattern: /家暴/, terms: ['家庭暴力']},
  {pattern: /抚养费/, terms: ['抚养费']},
  {pattern: /试用期.{0,16}(辞退|开除|解除|补偿|赔偿)|(辞退|开除|解除|补偿|赔偿).{0,16}试用期/, terms: ['不符合录用条件', '支付经济补偿', '试用期']},
  {pattern: /押金/, terms: ['租金和押金', '全面履行自己的义务', '承担继续履行', '请求恢复原状']},
  // 实测踩过：问「公司违法把我开除了要赔多少」召回为空 ——
  // 条文原文写的是"支付赔偿金""经济补偿标准的二倍"，问句说的是"赔多少"，
  // 口语和法条用词对不上，重排分被压低后整条被丢掉。
  {pattern: /违法.{0,6}(开除|辞退|解除)|(开除|辞退|解除).{0,6}(赔|补偿)|赔偿金|二倍/, terms: ['赔偿金', '违反本法规定解除', '经济补偿标准的二倍']},
];

const DENSE_K = 24;
const LEXICAL_K = 8;
const RERANK_K = 24;
// 句子已经拆开，每件事不用再看 24 条
const RERANK_PER_ISSUE = 12;
const KEEP_K = 4;
// 一件事里拆出来的子问题，每件少留几条，避免三件事叠成十几条全文
const KEEP_PER_ISSUE = 3;
const MAX_ISSUES = 3;
const RRF_K = 60;

// 一件事对应的检索结果。简单问题只有一项，复杂问题按事项分开。
export interface IssueRetrieval {
  question: string;
  references: RetrievedChunk[];
}

// 不同部门法的说法。用来判断“像不像好几件事”，不靠字数。
// 同一件事里同时出现“酒驾”和“撞”，仍然只算交通这一类，避免把“醉驾撞人怎么判”拆开。
// ★ 注意：这里的词必须覆盖**用户的口语变体**，否则"像不像好几件事"会判错 ——
//   实测踩过：「我醉酒开车撞了人，公司还想借这个辞退我」因为写成"醉酒"（不是"醉驾/酒后"）、
//   "撞了人"（不是"撞人"），只有第 3 类命中 → 判定成"只有一件事" → 根本没走拆分。
const MATTER_HINTS: RegExp[] = [
  /醉驾|酒驾|醉酒|酒后|饮酒|喝酒|危险驾驶|逃逸|犯罪|判刑|拘留|缓刑|坐牢/,
  /赔偿|赔多少|医药费|医疗费|误工|伤残|撞人|撞了|撞伤|撞到|车祸|交通事故|受伤/,
  /辞退|开除|离职|解除劳动|劳动|工资|加班|社保|工伤|被裁/,
  /离婚|抚养|彩礼|家暴|家庭暴力|探视|夫妻|结婚/,
  /合同|违约|定金|订金|退货|退款|中介/,
  /房租|租赁|租房|押金|物业|漏水|买房|卖房/,
];

// 元话语：用户在说"我要你分别回答"，本身不是一件事，拆句时直接丢掉。
// 实测踩过：把它并进第二件事后，第二件事的检索被稀释（该召回劳动法却召回了民法典）。
const META_TAIL = /^(这两件事|那这两件|这两条|分别|各自|都要|怎么算|怎么办|如何处理|怎么处理|分别怎么|都怎么说|怎么看|会怎么样|如何处理呢|分别回答)[^。]{0,12}$/;

interface Candidate extends RetrievedChunk {
  rrf: number;
  lexical: number;
  distance?: number;
}

function expandTerms(question: string): string[] {
  const terms: string[] = [];
  for (const rule of EXPANSIONS) {
    if (rule.pattern.test(question)) terms.push(...rule.terms);
  }
  return [...new Set(terms)];
}

function chunkKey(chunk: {docName: string; chunkIndex: number}): string {
  return `${chunk.docName}#${chunk.chunkIndex}`;
}

function addRanked(
  pool: Map<string, Candidate>,
  list: Array<RetrievedChunk & {score?: number}>,
  weight: number,
  lexicalOf: (key: string) => number
): void {
  list.forEach((chunk, rank) => {
    const key = chunkKey(chunk);
    const gain = weight / (RRF_K + rank + 1);
    const prev = pool.get(key);
    if (prev) {
      prev.rrf += gain;
      if (chunk.score != null && (prev.distance == null || chunk.score < prev.distance)) {
        prev.distance = chunk.score;
      }
      return;
    }
    pool.set(key, {
      text: chunk.text,
      docName: chunk.docName,
      chunkIndex: chunk.chunkIndex,
      rrf: gain,
      lexical: lexicalOf(key),
      distance: chunk.score,
    });
  });
}

type LexicalHit = {chunk: RetrievedChunk; lexical: number};

function lexicalMaps(
  rows: Array<{text: string; docName: string; chunkIndex: number}>,
  termGroups: string[][]
): Array<Map<string, LexicalHit>> {
  const maps = termGroups.map(() => new Map<string, LexicalHit>());
  for (const row of rows) {
    const compact = row.text.replace(/\s+/g, '');
    termGroups.forEach((terms, index) => {
      if (terms.length === 0) return;
      let lexical = 0;
      for (const term of terms) {
        if (term && compact.includes(term)) lexical += term.length >= 4 ? 3 : 2;
      }
      if (lexical <= 0) return;
      const chunk: RetrievedChunk = {text: row.text, docName: row.docName, chunkIndex: row.chunkIndex};
      const key = chunkKey(chunk);
      const prev = maps[index].get(key);
      if (!prev || lexical > prev.lexical) maps[index].set(key, {chunk, lexical});
    });
  }
  return maps;
}

async function scanLexical(terms: string[]): Promise<Map<string, LexicalHit>> {
  if (terms.length === 0) return new Map();
  const rows = await listChunkTexts();
  return lexicalMaps(rows, [terms])[0];
}

// 像好几件事才去拆。字数长但只问一件事的，不拆。
function looksCompound(question: string): boolean {
  const marks = question.match(/[？?]/g);
  if (marks && marks.length >= 2) return true;
  if (/另外|同时|以及|此外|还有|并且|而且|再加上/.test(question)) return true;
  const matters = MATTER_HINTS.filter((hint) => hint.test(question)).length;
  return matters >= 2 && /[，,；;]/.test(question) && question.length >= 18;
}

// 连接词处切开。切不开就整句当一件事，不再为此调用模型。
function splitLocally(question: string): string[] {
  if (!looksCompound(question)) return [question];
  const clean = (text: string) => text.replace(/^[，,。；;\s]+|[，,。；;\s]+$/g, '').trim();

  let parts = question
    .split(/另外|同时|以及|此外|还有|并且|而且|再加上|[？?]/)
    .map(clean)
    .filter((part) => part.length >= 4);

  // ★ 兜底：looksCompound 已经判定"这是好几件事"，但按连接词切不开 ——
  //   用户最常用的写法是用逗号分隔两件事（"我醉酒开车撞了人，公司还想辞退我"）。
  //   这里退化成按逗号切，并把"没命中任何事项分类"的碎片并回上一段，
  //   否则「这两件事分别怎么算」会被当成独立的一件事。
  if (parts.length < 2) {
    const raw = question.split(/[，,；;]/).map(clean).filter((part) => part.length >= 4);
    const merged: string[] = [];
    for (const piece of raw) {
      const hits = MATTER_HINTS.filter((hint) => hint.test(piece)).length;
      if (hits === 0 && META_TAIL.test(piece)) {
        continue;                     // "这两件事分别怎么算"只是要求，不是一件事 → 丢掉
      }
      if (merged.length > 0 && hits === 0) {
        merged[merged.length - 1] = merged[merged.length - 1] + '，' + piece;
      } else {
        merged.push(piece);
      }
    }
    parts = merged;
  }

  const unique = [...new Set(parts)];
  return unique.length >= 2 ? unique.slice(0, MAX_ISSUES) : [question];
}

function fallbackPick(ranked: Candidate[], keep: number): RetrievedChunk[] {
  const lexical = [...ranked].filter((item) => item.lexical > 0).sort((a, b) => b.lexical - a.lexical).slice(0, keep);
  if (lexical.length > 0) return lexical;
  return ranked
    .filter((item) => item.distance != null && chunkRelevant(item.distance))
    .slice(0, keep);
}

// 一件事的检索。keep 是重排后最多留下的条数，搜到的其余候选不会进回答。
export async function retrieveForQuestion(
  question: string,
  onStatus?: (message: string) => void,
  keep: number = KEEP_K
): Promise<RetrievedChunk[]> {
  onStatus?.('正在从知识库多路查找相关法条…');
  const terms = expandTerms(question);
  const expandedQuery = terms.length > 0 ? `${question} ${terms.join(' ')}` : question;
  const queries = expandedQuery === question ? [question] : [question, expandedQuery];

  const [vectors, lexicalMap] = await Promise.all([
    Promise.all(queries.map((query) => embedQuery(query))),
    scanLexical(terms),
  ]);
  const denseLists = await Promise.all(vectors.map((vector) => searchChunks(vector, DENSE_K)));
  return rerankPool(question, terms, denseLists, lexicalMap, keep, RERANK_K, onStatus);
}

function rerankPool(
  question: string,
  terms: string[],
  denseLists: Array<Array<RetrievedChunk & {score?: number}>>,
  lexicalMap: Map<string, LexicalHit>,
  keep: number,
  rerankK: number,
  onStatus?: (message: string) => void
): Promise<RetrievedChunk[]> {
  const pool = new Map<string, Candidate>();
  const lexicalScoreOf = (key: string) => lexicalMap.get(key)?.lexical ?? 0;
  for (const list of denseLists) {
    addRanked(pool, list, 1, lexicalScoreOf);
  }
  const lexicalRanked = [...lexicalMap.values()]
    .sort((a, b) => b.lexical - a.lexical)
    .slice(0, LEXICAL_K);
  addRanked(
    pool,
    lexicalRanked.map((item) => item.chunk),
    1.4,
    lexicalScoreOf
  );

  // 法条开头就写明该用语的，必须进重排。只在后文里顺带出现的，不能代表这一路。
  for (const term of terms) {
    const focused = focusLeadChunk(lexicalMap, term);
    if (!focused) continue;
    const key = chunkKey(focused);
    if (pool.has(key)) continue;
    pool.set(key, {
      text: focused.text,
      docName: focused.docName,
      chunkIndex: focused.chunkIndex,
      rrf: 0.02,
      lexical: lexicalScoreOf(key),
    });
  }

  const ranked = [...pool.values()].sort((a, b) => b.rrf - a.rrf);
  if (ranked.length === 0) return Promise.resolve([]);

  const shortlist: Candidate[] = [];
  for (const term of terms) {
    const focused = focusLeadChunk(lexicalMap, term);
    const chosen = focused ? ranked.find((item) => chunkKey(item) === chunkKey(focused)) : undefined;
    if (chosen && !shortlist.includes(chosen)) shortlist.push(chosen);
  }
  for (const item of ranked) {
    if (shortlist.length >= rerankK) break;
    if (!shortlist.includes(item)) shortlist.push(item);
  }
  onStatus?.('正在核对哪些资料能回答这个问题…');
  const scoreText = terms.length > 0 ? `${question} ${terms.join(' ')}` : question;
  return scorePassages(scoreText, shortlist, (item) => item.text, question).then(
    (scored) => pickWithCoverage(scored, terms, keep),
    (error: any) => {
      console.error('本机重排失败，改用融合排序:', error.message);
      return fallbackPick(ranked, keep);
    }
  );
}

// 四个字及以上的法条用语，取开头就出现该词、并且出现得最早的那条。
function focusLeadChunk(
  lexicalMap: Map<string, {chunk: RetrievedChunk; lexical: number}>,
  term: string
): RetrievedChunk | null {
  if (term.length < 4) return null;
  let best: {chunk: RetrievedChunk; at: number} | null = null;
  for (const item of lexicalMap.values()) {
    const at = leadSentence(item.chunk.text).indexOf(term);
    if (at < 0) continue;
    if (!best || at < best.at) best = {chunk: item.chunk, at};
  }
  return best?.chunk ?? null;
}

// 分最高的一批照常留下。另一件事的法条分低一截时，只要开头对得上，也要留下。
function pickWithCoverage(
  scored: RankedPassage<Candidate>[],
  terms: string[],
  keep: number
): RetrievedChunk[] {
  if (scored.length === 0) return [];
  const best = scored[0].score;
  const picked = scored.filter((row) => row.score >= best - 0.12).slice(0, keep);
  for (const term of terms) {
    if (term.length < 4) continue;
    if (picked.some((row) => leadSentence(row.item.text).includes(term))) continue;
    const extra = scored
      .filter((row) => leadSentence(row.item.text).includes(term))
      .sort((a, b) => leadSentence(a.item.text).indexOf(term) - leadSentence(b.item.text).indexOf(term))[0];
    if (extra && !picked.includes(extra)) picked.push(extra);
  }
  return picked.map((row) => row.item);
}

// 简单问题整句查一次。拆开的几件事共用一次向量计算和一次全文扫描，再各自重排。
export async function retrieveForUserQuestion(
  question: string,
  onStatus?: (message: string) => void
): Promise<IssueRetrieval[]> {
  const issues = splitLocally(question);
  if (issues.length === 1) {
    return [{question, references: await retrieveForQuestion(question, onStatus)}];
  }
  onStatus?.(`这个问题里有 ${issues.length} 件事，分开查找法条…`);
  const prepared = issues.map((issue) => {
    const terms = expandTerms(issue);
    const expandedQuery = terms.length > 0 ? `${issue} ${terms.join(' ')}` : issue;
    const queries = expandedQuery === issue ? [issue] : [issue, expandedQuery];
    return {issue, terms, queries};
  });
  const flatQueries = prepared.flatMap((item) => item.queries);
  const [vectors, rows] = await Promise.all([
    embedQueries(flatQueries),
    listChunkTexts(),
  ]);
  const maps = lexicalMaps(rows, prepared.map((item) => item.terms));
  const denseAll = await Promise.all(vectors.map((vector) => searchChunks(vector, DENSE_K)));
  let cursor = 0;
  const slices = prepared.map((item) => {
    const denseLists = denseAll.slice(cursor, cursor + item.queries.length);
    cursor += item.queries.length;
    return denseLists;
  });
  return Promise.all(prepared.map(async (item, index) => {
    onStatus?.(`正在查找：${item.issue.slice(0, 28)}…`);
    return {
      question: item.issue,
      references: await rerankPool(item.issue, item.terms, slices[index], maps[index], KEEP_PER_ISSUE, RERANK_PER_ISSUE, onStatus),
    };
  }));
}

// 引用列表按条文去重，同一条被两件事用到时前端只显示一次
export function flattenReferences(issues: IssueRetrieval[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const flat: RetrievedChunk[] = [];
  for (const issue of issues) {
    for (const chunk of issue.references) {
      const key = chunkKey(chunk);
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push(chunk);
    }
  }
  return flat;
}

function formatReferences(references: RetrievedChunk[]): string {
  return references.map((chunk, index) => (
    `【资料${index + 1}】（出自《${lawTitleFromDocName(chunk.docName)}》）\n${chunk.text}`
  )).join('\n\n');
}

function compact(text: string): string {
  return text.replace(/[\s，,。！!？?哎啊呢吧呀哦]/g, '');
}

function leftover(text: string): string {
  return compact(text).replace(/^(那|然后|接下来|所以|这样|这种情况|这种事|如此|这两|上述|刚才|前面|我|该|要|现在)+/, '');
}

// 这句话自己带了另一件事的经过。短问不能把这种句子当成上一件的追问。
const NEW_STORY = /辞退|离职|工资|加班|社保|工伤|劳动合同|离婚|抚养|彩礼|家暴|房租|租赁|物业|买房|卖房|押金|酒驾|醉驾|逃逸|车祸|撞|打人|被打|被人打|殴打|把人打|把我打|轻伤|重伤/;

// 去掉「那」「然后」之后没有新内容，或只剩「怎么办」。这种不另开一次检索。
function isBareFollowUp(text: string): boolean {
  const core = compact(text);
  if (core.length < 2 || core.length > 16) return false;
  const rest = leftover(text);
  if (!rest) return true;
  return /^(怎么办|怎么处理|咋办|如何是好|该怎么|要怎么|怎么判|如何判|怎么处罚|如何处罚|怎么量刑|如何量刑|判几年|判多久|判多重|怎么定|定什么罪|什么罪|怎么承担|承担什么责任|什么责任|怎么赔偿|如何赔偿|怎么赔|如何赔|赔多少|能赔多少|赔偿多少)$/.test(rest);
}

// 很短，只问赔偿、责任、费用，没有把新的经过再说一遍。
function isAttachedQuestion(text: string): boolean {
  const core = compact(text);
  if (core.length < 2 || core.length > 18) return false;
  if (NEW_STORY.test(core)) return false;
  if (isBareFollowUp(text)) return true;
  // 用原句判断。「呢」会在压缩时被去掉，不能拿压缩后的字去认问句。
  return /怎么|如何|咋|吗|呢|哪些|多少|能否|能不能|赔|责任|起诉|报警|立案|医药|误工|护理|营养/.test(text);
}

// 用「这样」「那」「前面」接着上文说，哪怕这句又问了刑期、并罚这类新问题。
function pointsAtPrior(text: string): boolean {
  const core = compact(text);
  if (core.length < 2 || core.length > 40) return false;
  if (isBareFollowUp(text) || isAttachedQuestion(text)) return true;
  return /^(那|然后|接下来|所以|这样|这种情况|这种事|如此|这两|上述|刚才|前面)/.test(text.trim());
}

// 追问时先查前面那句事实。这句如果又问了新的点，再单独查这句，两头的条文都留下。
export function questionForRetrieval(messages: Array<{role?: string; content?: string}>): {queries: string[]; followUp: boolean} {
  const users = messages.filter((item) => item.role === 'user' && item.content && item.content.trim());
  const last = users[users.length - 1]?.content?.trim() || '';
  if (!last || !pointsAtPrior(last)) return {queries: last ? [last] : [], followUp: false};
  for (let i = users.length - 2; i >= 0; i--) {
    const prior = users[i].content?.trim() || '';
    if (prior && !pointsAtPrior(prior)) {
      return {
        queries: isBareFollowUp(last) ? [prior] : [prior, last],
        followUp: true,
      };
    }
  }
  // ★ 兜底：一条「干净上文」都没找到（更早那些问句自己也带着「赔多少/怎么办」这类追问口气），
  //   但对话里确实有更早的用户原话 —— 仍然带上最近的那句，不要只用最后一句去检索。
  //   实测踩过：「公司违法把我开除了要赔多少」因为含「赔」「多少」被判成追问句而遭跳过，
  //   于是「那要是公司不给我怎么办」被单独拿去检索，召回到刑法第171条（申请公司登记），
  //   而正确答案在劳动合同法第八十七条。
  const nearest = users.length >= 2 ? (users[users.length - 2].content?.trim() || '') : '';
  if (nearest) {
    return {
      queries: isBareFollowUp(last) ? [nearest] : [nearest, last],
      followUp: true,
    };
  }
  return {queries: [last], followUp: false};
}

const FOLLOW_UP_RULE = '用户最后一句是接着前面已经说过的事实在问，不是把那些事实抛开的新问题。请同时用上前面事实对应的资料，和这句新问题对应的资料。不要因为这句没有把事实再说一遍，就说那些事实没有法律依据。资料里没有具体刑期时，说明规则，并写明资料没有给出具体数字。';

export function buildLegalPrompt(issues: IssueRetrieval[], followUp = false): string {
  const follow = followUp ? `\n${FOLLOW_UP_RULE}\n` : '';
  if (issues.length <= 1) {
    return buildSinglePrompt(issues[0]?.references ?? [], follow);
  }
  const blocks = issues.map((issue, index) => {
    const body = issue.references.length > 0
      ? formatReferences(issue.references)
      : '（这件事没有检索到相关法律资料）';
    return `【事项${index + 1}】${issue.question}\n${body}`;
  }).join('\n\n');
  return `你是"法制通"法律智能问答助手。用户这次问了多件事，请按事项分段回答。
回答要求：
1. 每一段只用该事项下面的【资料】，不要用别的事项的法条去补。
2. 某一事项没有资料时，这一段只说明“知识库中未找到相关依据”。
3. 条文里的行为主体、发生场所和罪名构成必须与用户说的事实一致。只是出现了同一个动词，不能拿来回答。
4. 不要编造资料里没有的法条编号和原文。尽量引用原文条款。
5. 用中文回答。小标题沿用事项里的说法。
6. 用户说了受伤、撞伤或发生事故，但没有写明轻伤、重伤、死亡或财产损失程度时，按该事项资料里的档次分情况写。不要因为没写「重伤」就把已经召到的量刑整段说成没有依据。能确定的部分先写。逃逸、特别恶劣情节这些加重档，只在资料写明的基本后果已经达到时才适用；用户没写明是否达到的，用「若构成该罪，则……」来写，不要写成已经确定构成。
${follow}
${blocks}`;
}

function buildSinglePrompt(references: RetrievedChunk[], follow = ''): string {
  const context = formatReferences(references);
  return `你是"法制通"法律智能问答助手。请根据下面提供的法律条文资料回答用户的问题。
回答要求：
1. 只依据【法律资料】回答，不要编造资料里没有的法条编号和原文。
2. 尽量引用资料中的原文条款表述。
3. 用中文回答，按用户提到的每个行为分段说明。
4. 条文里的行为主体、发生场所和罪名构成必须与用户说的事实一致。只是出现了同一个动词，不能拿来回答，这一部分说明“知识库中未找到相关依据”。
5. 资料只覆盖问题的一部分时，先回答资料能支撑的部分，再单独说明没覆盖的部分“知识库中未找到相关依据”。不要整段拒绝，也不要让用户重新描述已经说过的行为。
6. 资料整体与问题无关时，不要罗列这些资料，直接说明“知识库中未找到与该问题相关的法律依据”。
7. 用户说了受伤、撞伤或发生事故，但没有写明轻伤、重伤、死亡或财产损失程度时，按资料里的档次分情况写：若达到某一档，就写该档的后果。不要因为没写「重伤」就把已经召到的量刑整段说成没有依据。资料里已经能确定的部分先写。逃逸、特别恶劣情节这些加重档，只在资料写明的基本后果已经达到时才适用；用户没写明是否达到的，用「若构成该罪，则……」来写，不要写成已经确定构成。
${follow}
${context ? `【法律资料】\n${context}` : '（本次未检索到相关法律资料，请说明知识库中未找到相关依据，不要编造法条。）'}`;
}
