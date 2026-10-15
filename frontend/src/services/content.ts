// 内容库 API 封装：法律案例、法律条文（后端 MySQL，走 request 实例自动带 token）
import request from './request';

// 法律案例
export interface LawCase {
  id: number;
  category: string;    // 分类路由段：marriage/traffic/...
  title: string;
  summary: string;     // 案情摘要
  verdict: string;     // 裁判要旨
  lawRefs: string[];   // 相关法条
  isPinned: boolean;   // 是否置顶
  viewCount: number;   // 浏览数
  createdAt: string;   // 入库日期 YYYY-MM-DD
}

// 法律条文
export interface LawArticle {
  id: number;
  category: string;
  title: string;       // 条文要点名
  source: string;      // 出处
  content: string;     // 条文内容
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
}

// 列表筛选参数（与后端 ContentQuery 对齐）
export interface ContentQuery {
  category?: string;
  keyword?: string;
  sort?: 'new' | 'hot';
}

// 后端统一返回格式
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 案例列表（支持分类/关键词/排序筛选，不传参 = 全部，置顶优先）
export async function getCases(query: ContentQuery = {}): Promise<LawCase[]> {
  const response = await request.get<ApiResponse<LawCase[]>>('/content/cases', {params: query});
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取案例列表失败');
}

// 案例详情
export async function getCaseById(id: number): Promise<LawCase> {
  const response = await request.get<ApiResponse<LawCase>>(`/content/cases/${id}`);
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取案例详情失败');
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

// 全文法条。docName 为空表示全部已入库法律，page 从 1 开始。
export async function getCorpus(query: {docName?: string; keyword?: string; page?: number; pageSize?: number} = {}): Promise<CorpusPage> {
  const response = await request.get<ApiResponse<CorpusPage>>('/content/corpus', {params: query});
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取全文法条失败');
}

// 法条列表（支持分类/关键词/排序筛选）。这是常用摘录，不是全文。
export async function getLaws(query: ContentQuery = {}): Promise<LawArticle[]> {
  const response = await request.get<ApiResponse<LawArticle[]>>('/content/laws', {params: query});
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取法律条文失败');
}

// 案例浏览数 +1（打开详情时调用）
export async function recordCaseView(id: number): Promise<void> {
  await request.post(`/content/cases/${id}/view`);
}

// 法条浏览数 +1
export async function recordLawView(id: number): Promise<void> {
  await request.post(`/content/laws/${id}/view`);
}
