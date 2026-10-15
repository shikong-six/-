// 法律条文模块元数据（内容在后端 MySQL：law_articles 表，经 services/content.ts 获取）
// 模块是页面结构的一部分，统一从 categories.ts 取，保持各页展示一致
export {categories as lawCategories, getCategory as getLawCategory} from './categories';
export type {CategoryMeta as LawCategoryMeta} from './categories';
