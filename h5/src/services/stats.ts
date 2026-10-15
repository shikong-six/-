import request from './request';

export interface ProfileStats {
  qaCount: number;
  caseViewCount: number;
  uploadCount: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getProfileStats(): Promise<ProfileStats> {
  const response = await request.get<ApiResponse<ProfileStats>>('/stats/me');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取个人统计失败');
}
