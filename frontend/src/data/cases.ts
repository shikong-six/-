// 案例库分类元数据（内容在后端 MySQL：law_cases 表，经 services/content.ts 获取）
// 分类是页面结构的一部分，统一从 categories.ts 取，保持各页展示一致
export {categories as caseCategories, getCategory as getCategoryByKey} from './categories';
export type {CategoryMeta as CaseCategoryMeta} from './categories';
