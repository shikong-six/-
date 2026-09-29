// 法律条文模块元数据（内容已迁到后端 MySQL：law_articles 表，经 services/content.ts 获取）
// 模块是页面结构的一部分（分块 key + 展示名），仍由前端维护

export interface LawCategoryMeta {
  key: string;    // 模块 key
  title: string;  // 模块名（页内分块显示）
}

export const lawCategories: LawCategoryMeta[] = [
  {key: 'marriage', title: '婚姻家庭'},
  {key: 'traffic', title: '交通事故'},
  {key: 'contract', title: '合同纠纷'},
  {key: 'labor', title: '劳动纠纷'},
  {key: 'property', title: '房产物业'},
  {key: 'criminal', title: '刑事辩护'},
];
