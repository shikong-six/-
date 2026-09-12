// 统计接口：支撑首页三张统计卡片（知识库文档数 / 累计问答数 / 今日问答数）
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

export default router;
