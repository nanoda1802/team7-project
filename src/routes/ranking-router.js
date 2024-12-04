import express from "express";
import { prisma } from "../utils/prisma/index.js"

//계정 라우터 생성
const router = express.Router();

// 팀편성 API
router.get('/users/ranks',  async (req, res, next) => {
    let resJson = [];

    const ranking = await prisma.ranks.findMany({

        orderBy: {
            mmr: 'desc',
            loseCount: 'asc'
        },
        select: {
            userKey: true,
            winCount: true,
            loseCount: true,
            drawCount: true,
            mmr: true,
            user: true
        },
        take: 10
    })

    for (let i =0;i < ranking.length;i++) {

        const winningRate = Math.round(ranking[i].winCount / (ranking[i].winCount + ranking[i].loseCount + ranking[i].drawCount) * 100) || 0

        resJson = [...resJson,
            {
                rank: i+1,
                nickname: ranking[i].user.nickname,
                favoriteAgent: ranking[i].user.favoriteAgent,
                rankScore: ranking[i].mmr,
                winningRate: `${winningRate}%`,
                matchRecord: `${ranking[i].winCount} / ${ranking[i].loseCount} / ${ranking[i].drawCount} `
            }
        ]
    }

    return res
        .status(200)
        .json(resJson)

})


export default router