// 首页统计接口封装：知识库文档数 / 累计问答数 / 今日问答数
// 统一走 request 实例（自动携带 token，401 自动跳登录）
import request from './request';

// 统计数据结构（对应后端 /api/stats 返回的 data）
export interface StatsData {
  documentCount: number;  // 知识库文档总数
  totalQaCount: number;   // 累计问答数
  todayQaCount: number;   // 今日问答数
}

// 后端统一返回格式
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 获取首页统计卡片数据
export async function getStats(): Promise<StatsData> {
  // 发送 GET 请求到 /api/stats
  const response = await request.get<ApiResponse<StatsData>>('/stats');
  // 后端返回成功则取 data
  if (response.data.success) {
    return response.data.data;
  }
  // 失败则抛出后端给的错误信息
  throw new Error(response.data.message || '获取统计数据失败');
}
