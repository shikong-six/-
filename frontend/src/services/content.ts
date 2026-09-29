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
}

// 法律条文
export interface LawArticle {
  id: number;
  category: string;
  title: string;       // 条文要点名
  source: string;      // 出处
  content: string;     // 条文内容
}

// 后端统一返回格式
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 案例列表（全量，分类由前端按 category 字段分组）
export async function getCases(): Promise<LawCase[]> {
  const response = await request.get<ApiResponse<LawCase[]>>('/content/cases');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取案例列表失败');
}

// 法条列表（全量，模块由前端按 category 字段分组）
export async function getLaws(): Promise<LawArticle[]> {
  const response = await request.get<ApiResponse<LawArticle[]>>('/content/laws');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取法律条文失败');
}
