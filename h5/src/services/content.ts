// 法条 / 案例：优先走后端；接口失败或库是空的时，用本地演示数据
import request from './request';
import {seedArticles, seedCases} from '@/data/library';

const LAW_QUESTION_PREFIX = '请结合法条说明：';
const CASE_QUESTION_PREFIX = '请结合这个案例说明：';
const LIBRARY_REF_KEY = 'fazhitong_library_ref';

export interface LibraryRef {
  type: 'case' | 'law';
  id: number;
}

export function saveLibraryRef(ref: LibraryRef): void {
  sessionStorage.setItem(LIBRARY_REF_KEY, JSON.stringify(ref));
}

export function clearLibraryRef(): void {
  sessionStorage.removeItem(LIBRARY_REF_KEY);
}

function readLibraryRef(): LibraryRef | null {
  const raw = sessionStorage.getItem(LIBRARY_REF_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LibraryRef;
    if ((parsed.type === 'case' || parsed.type === 'law') && typeof parsed.id === 'number') return parsed;
  } catch {
    // 坏数据直接丢掉，避免后续提问一直对不上
  }
  return null;
}

function compact(text: string): string {
  return text.replace(/\s+/g, '').replace(/[“”"「」]/g, '');
}

const WORD_ALIASES: Array<[string, string]> = [
  ['家暴', '家庭暴力'],
  ['酒驾', '醉酒驾驶'],
  ['醉驾', '醉酒驾驶'],
  ['反击', '正当防卫'],
  ['还手', '正当防卫'],
];

function keywordsOf(question: string): string[] {
  const parts = question
    .split(/[^\u4e00-\u9fff]+|[了的吗呢吧啊是在把被给]/)
    .map((part) => part.replace(/^[那这]/, ''))
    .filter((part) => part.length >= 2);
  const aliases = WORD_ALIASES.filter(([from]) => question.includes(from)).map(([, to]) => to);
  const stop = new Set(['怎么', '如何', '什么', '这个', '那个', '请问', '可以', '是否', '一下', '请结合']);
  return [...new Set([...parts, ...aliases])].filter((word) => !stop.has(word));
}

function relatedArticles(refs: string[]) {
  return seedArticles.filter((article) =>
    refs.some((ref) => {
      const left = compact(ref);
      const right = compact(article.source);
      return left.includes(right) || right.includes(left);
    })
  );
}

function matchingLines(question: string, blocks: string[]): string[] {
  const keys = keywordsOf(question);
  if (!keys.length) return [];
  const lines = blocks
    .join('\n')
    .split(/[。；\n]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && keys.some((key) => line.includes(key)));
  return [...new Set(lines)].slice(0, 4);
}

function caseByTitle(title: string) {
  const target = compact(title);
  return seedCases.find((row) => compact(row.title) === target);
}

function articleByTitle(title: string) {
  const target = compact(title);
  return seedArticles.find((row) => compact(row.title) === target);
}

function answerFromCase(question: string, id: number): string | null {
  const item = seedCases.find((row) => row.id === id);
  if (!item) return null;
  const laws = relatedArticles(item.lawRefs);
  const hits = matchingLines(question, [item.summary, item.verdict, ...laws.map((law) => law.content)]);
  const lawText = laws.map((law) => `${law.source} ${law.title}\n${law.content}`).join('\n\n');
  const related = hits.length
    ? `和「${question}」能对上的原文：\n${hits.map((line) => `- ${line}`).join('\n')}`
    : `这则案例没有直接写「${question}」。下面是案情、裁判要旨和它引用的法条。`;
  return [
    `按你打开的案例《${item.title}》说明。`,
    item.summary,
    `裁判要旨：${item.verdict}`,
    item.lawRefs.length ? `相关法条：${item.lawRefs.join('、')}` : '',
    lawText,
    related,
    '以上仅供参考，不构成法律意见。',
  ].filter(Boolean).join('\n\n');
}

function answerFromLaw(question: string, id: number): string | null {
  const article = seedArticles.find((row) => row.id === id);
  if (!article) return null;
  const hits = matchingLines(question, [article.content]);
  const related = hits.length
    ? `和「${question}」能对上的原文：\n${hits.map((line) => `- ${line}`).join('\n')}`
    : `这条法条没有直接写「${question}」。下面是条文原文。`;
  return `根据${article.source}（${article.title}）：\n\n${article.content}\n\n${related}\n\n以上是法条原文摘录，仅供参考，不构成法律意见。`;
}

// 从案例/法条点进来之后，这条对话都绑在那一条资料上。
// 不能只认第一句「请结合这个案例说明」，否则换个问法就会失败。
export function explainFromLibrary(question: string): string | null {
  const text = question.trim();
  const saved = readLibraryRef();
  if (saved?.type === 'case') return answerFromCase(text, saved.id);
  if (saved?.type === 'law') return answerFromLaw(text, saved.id);

  if (text.startsWith(LAW_QUESTION_PREFIX)) {
    const article = articleByTitle(text.slice(LAW_QUESTION_PREFIX.length).trim());
    if (!article) return null;
    saveLibraryRef({type: 'law', id: article.id});
    return answerFromLaw(text, article.id);
  }
  if (text.startsWith(CASE_QUESTION_PREFIX)) {
    const item = caseByTitle(text.slice(CASE_QUESTION_PREFIX.length).trim());
    if (!item) return null;
    saveLibraryRef({type: 'case', id: item.id});
    return answerFromCase(text, item.id);
  }
  return null;
}

export interface LawCase {
  id: number;
  category: string;
  title: string;
  summary: string;
  verdict: string;
  lawRefs: string[];
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
}

export interface LawArticle {
  id: number;
  category: string;
  title: string;
  source: string;
  content: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
}

export interface ContentQuery {
  category?: string;
  keyword?: string;
  sort?: 'new' | 'hot';
}

export const contentCategories = [
  {key: '', title: '全部'},
  {key: 'labor', title: '劳动'},
  {key: 'marriage', title: '婚姻'},
  {key: 'traffic', title: '交通'},
  {key: 'property', title: '房产'},
  {key: 'contract', title: '合同'},
  {key: 'criminal', title: '刑事'},
  {key: 'other', title: '其他'},
];

const categoryNames: Record<string, string> = {
  labor: '劳动纠纷',
  marriage: '婚姻家庭',
  traffic: '交通事故',
  property: '房产物业',
  contract: '合同纠纷',
  criminal: '刑事辩护',
  other: '其他',
};

export function categoryName(key: string): string {
  return categoryNames[key] || '其他';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

function viewCountOf(id: number): number {
  return 100 + (id * 37) % 420;
}

function localCases(): LawCase[] {
  const seen = new Set<string>();
  return seedCases.map((item) => {
    const isPinned = !seen.has(item.category);
    seen.add(item.category);
    return {...item, isPinned, viewCount: viewCountOf(item.id), createdAt: '2025-06-01'};
  });
}

function localArticles(): LawArticle[] {
  const seen = new Set<string>();
  return seedArticles.map((item) => {
    const isPinned = !seen.has(item.category);
    seen.add(item.category);
    return {...item, isPinned, viewCount: viewCountOf(item.id), createdAt: '2025-06-01'};
  });
}

function matchKeyword(parts: string[], keyword?: string): boolean {
  const text = keyword?.trim().toLowerCase();
  if (!text) return true;
  return parts.join('\n').toLowerCase().includes(text);
}

function filterCases(query: ContentQuery): LawCase[] {
  return localCases().filter((item) => {
    if (query.category && item.category !== query.category) return false;
    return matchKeyword([item.title, item.summary, item.verdict, ...item.lawRefs], query.keyword);
  });
}

function filterArticles(query: ContentQuery): LawArticle[] {
  return localArticles().filter((item) => {
    if (query.category && item.category !== query.category) return false;
    return matchKeyword([item.title, item.source, item.content], query.keyword);
  });
}

export async function getCases(query: ContentQuery = {}): Promise<LawCase[]> {
  try {
    const response = await request.get<ApiResponse<LawCase[]>>('/content/cases', {params: query});
    if (response.data.success && response.data.data.length) return response.data.data;
  } catch {
    // 后端没启动或内容库没灌上时，改用本地演示数据
  }
  return filterCases(query);
}

export async function getCaseById(id: number): Promise<LawCase> {
  try {
    const response = await request.get<ApiResponse<LawCase>>(`/content/cases/${id}`);
    if (response.data.success && response.data.data) return response.data.data;
  } catch {
    // 同上，详情也回退到本地数据
  }
  const found = localCases().find((item) => item.id === id);
  if (!found) throw new Error('案例不存在');
  return found;
}

export async function getLaws(query: ContentQuery = {}): Promise<LawArticle[]> {
  try {
    const response = await request.get<ApiResponse<LawArticle[]>>('/content/laws', {params: query});
    if (response.data.success && response.data.data.length) return response.data.data;
  } catch {
    // 后端没启动或内容库没灌上时，改用本地演示数据
  }
  return filterArticles(query);
}

export interface CorpusLaw {
  docName: string;
  title: string;
  count: number;
}

export interface CorpusArticle {
  key: string;
  docName: string;
  source: string;
  content: string;
  chunkIndex: number;
}

export interface CorpusPage {
  laws: CorpusLaw[];
  total: number;
  page: number;
  pageSize: number;
  items: CorpusArticle[];
}

export async function getCorpus(query: {docName?: string; keyword?: string; page?: number; pageSize?: number} = {}): Promise<CorpusPage> {
  const response = await request.get<ApiResponse<CorpusPage>>('/content/corpus', {params: query});
  if (response.data.success) return response.data.data;
  throw new Error(response.data.message || '获取全文法条失败');
}

export async function recordCaseView(id: number): Promise<void> {
  await request.post(`/content/cases/${id}/view`);
}

export async function recordLawView(id: number): Promise<void> {
  await request.post(`/content/laws/${id}/view`);
}
