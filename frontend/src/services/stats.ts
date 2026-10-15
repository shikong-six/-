// 首页统计 + 个人中心统计
import request from './request';

// 首页统计（知识库文档数 / 累计问答数 / 今日问答数）
export interface StatsData {
  documentCount: number;
  totalQaCount: number;
  todayQaCount: number;
}

// 个人中心统计
export interface ProfileStats {
  qaCount: number;        // 累计问答
  caseViewCount: number;  // 浏览案例（去重）
  uploadCount: number;    // 上传文档
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getStats(): Promise<StatsData> {
  const response = await request.get<ApiResponse<StatsData>>('/stats');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取统计数据失败');
}

export async function getProfileStats(): Promise<ProfileStats> {
  const response = await request.get<ApiResponse<ProfileStats>>('/stats/me');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取个人统计失败');
}
