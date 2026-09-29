// 案例库分类元数据（内容已迁到后端 MySQL：law_cases 表，经 services/content.ts 获取）
// 分类是页面结构的一部分（路由段 + 展示名），仍由前端维护

export interface CaseCategoryMeta {
  key: string;    // 路由段（/cases/:category）
  title: string;  // 分类名（侧边导航显示）
}

export const caseCategories: CaseCategoryMeta[] = [
  {key: 'marriage', title: '婚姻家庭'},
  {key: 'traffic', title: '交通事故'},
  {key: 'contract', title: '合同纠纷'},
  {key: 'labor', title: '劳动纠纷'},
  {key: 'property', title: '房产物业'},
  {key: 'criminal', title: '刑事辩护'},
];

// 按路由段查分类元数据
export function getCategoryByKey(key: string): CaseCategoryMeta | undefined {
  return caseCategories.find((c) => c.key === key);
}
