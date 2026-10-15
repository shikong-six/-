// 统计接口：支撑首页三张统计卡片（知识库文档数 / 累计问答数 / 今日问答数）
// 以及个人中心：累计问答 / 浏览案例 / 上传文档
import {Router} from 'express';
import pool from '../services/db';

const router = Router();

// GET /api/stats
router.get('/', async (req, res) => {
    try {
        const [docRows] = await pool.query<any[]>('SELECT COUNT(*) AS count FROM documents');
        const [totalRows] = await pool.query<any[]>('SELECT COUNT(*) AS count FROM chat_history');
        const [todayRows] = await pool.query<any[]>(
            'SELECT COUNT(*) AS count FROM chat_history WHERE DATE(created_at) = CURDATE()'
        );
        res.json({
            success: true,
            data: {
                documentCount: docRows[0].count,
                totalQaCount: totalRows[0].count,
                todayQaCount: todayRows[0].count
            }
        });
    } catch (error: any) {
        console.error('查询统计数据失败:', error.message);
        res.status(500).json({success: false, message: error.message});
    }
});

// GET /api/stats/me — 当前登录用户的个人中心统计
router.get('/me', async (req, res) => {
    try {
        const userId = req.user!.userId;
        const [qaRows] = await pool.query<any[]>(
            'SELECT COUNT(*) AS count FROM chat_history WHERE user_id = ?',
            [userId]
        );
        let caseViewCount = 0;
        try {
            const [viewRows] = await pool.query<any[]>(
                'SELECT COUNT(*) AS count FROM user_case_views WHERE user_id = ?',
                [userId]
            );
            caseViewCount = viewRows[0]?.count ?? 0;
        } catch {
            caseViewCount = 0;
        }
        let uploadCount = 0;
        try {
            const [uploadRows] = await pool.query<any[]>(
                'SELECT COUNT(*) AS count FROM documents WHERE user_id = ?',
                [userId]
            );
            uploadCount = uploadRows[0]?.count ?? 0;
        } catch {
            uploadCount = 0;
        }
        res.json({
            success: true,
            data: {
                qaCount: qaRows[0].count,
                caseViewCount,
                uploadCount
            }
        });
    } catch (error: any) {
        console.error('查询个人统计失败:', error.message);
        res.status(500).json({success: false, message: error.message});
    }
});

export default router;
