// 分类元数据唯一数据源：案例/法条共用（key + 展示名 + 英文副标 + 分类强调色）
export interface CategoryMeta {
  key: string;      // 路由段/分类字段：marriage/traffic/...
  title: string;    // 展示名
  en: string;       // 英文副标
  accent: string;   // 顶部小色条 / Tag 强调色（不再铺满整卡）
  gradient: string; // 兼容旧引用；新卡片优先用 accent
}

export const categories: CategoryMeta[] = [
  {key: 'marriage', title: '婚姻家庭', en: 'MARRIAGE', accent: '#e64980', gradient: 'linear-gradient(135deg, #f56c6c, #e64980)'},
  {key: 'traffic', title: '交通事故', en: 'TRAFFIC', accent: '#f2994a', gradient: 'linear-gradient(135deg, #f2994a, #eb5757)'},
  {key: 'contract', title: '合同纠纷', en: 'CONTRACT', accent: '#4a6cf7', gradient: 'linear-gradient(135deg, #4a6cf7, #7a9bff)'},
  {key: 'labor', title: '劳动纠纷', en: 'LABOR', accent: '#07c160', gradient: 'linear-gradient(135deg, #07c160, #00b578)'},
  {key: 'property', title: '房产物业', en: 'PROPERTY', accent: '#9b51e0', gradient: 'linear-gradient(135deg, #9b51e0, #6a5af9)'},
  {key: 'criminal', title: '刑事辩护', en: 'CRIMINAL', accent: '#2f3b52', gradient: 'linear-gradient(135deg, #2f3b52, #1f2d3d)'},
  {key: 'other', title: '其他', en: 'OTHERS', accent: '#64748b', gradient: 'linear-gradient(135deg, #64748b, #475569)'},
];

export function getCategory(key: string): CategoryMeta | undefined {
  return categories.find((c) => c.key === key);
}
