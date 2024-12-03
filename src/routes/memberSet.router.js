import express from "express";
import { prisma } from "../utils/prisma/index.js"
import { strVerification } from "../middlewares/agentVerification.middleware.js"

//계정 라우터 생성
const router = express.Router();

// 팀편성 API
router.put('/users/:key/formation', strVerification, async (req,res,next) => {
    const { formation } = req.body;
    const { key } = req.params;
    // 유효성 평가 미들웨어로 챔피언 배열 받아옴
    const agent = req.agent
    let myAgent = [];
    let tank = false;

    for (let i = 0;i < formation.length;i++) {
        
        myAgent[i] = await prisma.myAgents.findFirst({ where: { name: formation[i] } })
        //보유 챔피언 확인
        if (!myAgent[i]) return res
            .status(400)
            .json({errorMessage: `${formation[i]}(은)는 현재 보유한 챔피언이 아닙니다.`})
        if (agent[i].position === "tanker") {
            tank = true;
        }
    }
    // 탱커 여부 확인
    if (!tank) return res
        .status(400)
        .json({ errorMessage: "팀편성에는 탱커가 1명 이상 필요합니다" })


    if (myAgent.length !== 3) return res
        .status(400)
        .json({ errorMessage: "팀편성에는 3명의 챔피언이 필요합니다" })

    // 저장
    const updateUser = await prisma.users.update({
        where: { userKey: +key },
        data: {
            squadMem1: +myAgent[0].agentKey,
            squadMem2: +myAgent[1].agentKey,
            squadMem3: +myAgent[2].agentKey
        }
    })

    //시너지 확인
    const synergy = [...new Set(agent.map(e => e.team).filter((e,idx,arr) =>{ 
        if (idx !== arr.indexOf(e) && arr.indexOf(e) !== -1)
            return true
        else return false
    }))].join("") || "none"

    // 반환
    return res
        .status(201)
        .json({ 
            message : "성공적으로 팀이 편성되었습니다.",
            squd: [`${myAgent[0].name}(${myAgent[0].position})`, 
                `${myAgent[1].name}(${myAgent[1].position})`,
                `${myAgent[2].name}(${myAgent[2].position})`],
            synergy
        })
})
