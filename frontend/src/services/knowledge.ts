// 知识库相关 API 封装：文档列表、上传、相似度检索
// 统一走 request 实例（自动携带 token，401 自动跳登录）
import request from './request';

// 文档元数据（对应后端 MySQL documents 表）
export interface DocumentItem {
  id: number;
  filename: string;
  size: number;
  chunkCount: number;
  createdAt: string;
}

// 检索命中的文本块（对应向量库记录）
export interface SearchResult {
  text: string;
  docName: string;
  chunkIndex: number;
  score: number;
}

// 上传结果（后端返回的处理信息）
export interface UploadResult {
  filename: string;
  size: number;
  chunkCount: number;
}

// 后端统一返回格式
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 获取已上传文档列表（后端按上传时间倒序返回）
export async function getDocumentList(): Promise<DocumentItem[]> {
  const response = await request.get<ApiResponse<DocumentItem[]>>('/knowledge/list');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取文档列表失败');
}

// 上传文档，后端自动完成：解析 → 分块 → 向量化 → 写向量库 + MySQL
export async function uploadDocument(file: File): Promise<UploadResult> {
  // 用 FormData 传文件，字段名必须是 file（和后端 multer 的 upload.single('file') 对应）
  const formData = new FormData();
  formData.append('file', file);
  const response = await request.post<ApiResponse<UploadResult>>(
    '/knowledge/upload',
    formData
  );
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '上传失败');
}

// 相似度检索测试：返回与问题最相近的 topK 个文本块
export async function searchKnowledge(query: string, topK = 3): Promise<SearchResult[]> {
  const response = await request.post<ApiResponse<SearchResult[]>>('/knowledge/search', { query, topK });
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '检索失败');
}
