// 内容库路由：法律案例 + 法律条文查询
import {Router} from 'express'
import {listCases, listArticles} from '../services/content'

const router = Router()

// 案例列表 GET /api/content/cases（authMiddleware 已在外层挂载）
router.get('/cases', async (req, res) => {
    try {
        const data = await listCases()
        res.json({success: true, data})
    } catch (error: any) {
        console.error('查询案例列表失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

// 法条列表 GET /api/content/laws
router.get('/laws', async (req, res) => {
    try {
        const data = await listArticles()
        res.json({success: true, data})
    } catch (error: any) {
        console.error('查询法条列表失败:', error.message)
        res.status(500).json({success: false, message: error.message})
    }
})

export default router
