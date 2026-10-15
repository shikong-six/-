// 内容库路由：法律案例 + 法律条文查询
import {Router} from 'express'
import {listCases, listArticles, getCaseById, incrementCaseView, incrementArticleView} from '../services/content'
import {listCorpus} from '../services/corpus'
import type {ContentQuery} from '../services/content'

const router = Router()

// 从 req.query 提取筛选参数（sort 只接受 new/hot，其余忽略）
function parseQuery(req: any): ContentQuery {
    const query: ContentQuery = {}
    const {category, keyword, sort} = req.query
    if (typeof category === 'string' && category) query.category = category
    if (typeof keyword === 'string' && keyword) query.keyword = keyword
    if (sort === 'new' || sort === 'hot') query.sort = sort
    return query
}

// 案例列表 GET /api/content/cases（authMiddleware 已在外层挂载）
// 支持 query：category 分类、keyword 关键词、sort=new|hot 排序
router.get('/cases', async (req, res) => {
    try {
        const data = await listCases(parseQuery(req))
        res.json({success: true, data})
    } catch (error: any) {
        console.error('查询案例列表失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

// 案例详情 GET /api/content/cases/:id
router.get('/cases/:id', async (req, res) => {
    try {
        const data = await getCaseById(Number(req.params.id))
        if (!data) {
            return res.status(404).json({success: false, message: '案例不存在'})
        }
        res.json({success: true, data})
    } catch (error: any) {
        console.error('查询案例详情失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

// 全文法条 GET /api/content/corpus。来自向量库，按法律名分页，不走常用摘录那 47 条。
router.get('/corpus', async (req, res) => {
    try {
        const docName = typeof req.query.docName === 'string' ? req.query.docName : ''
        const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : ''
        const page = Number(req.query.page) || 1
        const pageSize = Number(req.query.pageSize) || 12
        const data = await listCorpus({docName, keyword, page, pageSize})
        res.json({success: true, data})
    } catch (error: any) {
        console.error('查询全文法条失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

// 法条列表 GET /api/content/laws，query 参数同上。这里仍是常用摘录。
router.get('/laws', async (req, res) => {
    try {
        const data = await listArticles(parseQuery(req))
        res.json({success: true, data})
    } catch (error: any) {
        console.error('查询法条列表失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

// 案例浏览数 +1 POST /api/content/cases/:id/view（用户打开详情时调用；顺带记个人浏览）
router.post('/cases/:id/view', async (req, res) => {
    try {
        await incrementCaseView(Number(req.params.id), req.user?.userId)
        res.json({success: true})
    } catch (error: any) {
        console.error('案例浏览数自增失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

// 法条浏览数 +1 POST /api/content/laws/:id/view
router.post('/laws/:id/view', async (req, res) => {
    try {
        await incrementArticleView(Number(req.params.id))
        res.json({success: true})
    } catch (error: any) {
        console.error('法条浏览数自增失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

export default router
