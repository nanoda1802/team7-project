import express from "express";
import { prisma } from "../utils/prisma/index.js";

const router = express.Router();

router.patch("/users/:key/agents/intensify", async (req, res) => {
    const { key } = req.params;
    const { agentKey } = req.body;

    // 로그인 상태 확인
    if (!checkLogin(req)) {
        return res.status(401).json({ message: "로그인 부터 해주세요!!" });
    }

    const loggedInUserId = getUserId(req);
    if (loggedInUserId !== key) {
        return res.status(403).json({ message: "당신 계정이 아녀요!!" });
    }

    try {
        // 보유 에이전트 확인
        const player = await prisma.myAgents.findFirst({
            where: {  agentKey: agentKey, userKey: +key  },
            include: {
                agent: true, // 에이전트 정보 포함
            },
        });

        if (!player || player.userKey !== loggedInUserId) {
            return res.status(404).json({ message: "보유하고 있는 선수가 아닙니다." });
        }

        const currentLevel = player.level;
        if (currentLevel >= 15) {
            return res.status(400).json({ message: "이미 15강입니다." });
        }

        // 보유 재료 확인
        const materials = await prisma.assets.findUnique({
            where: { userKey: loggedInUserId },
        });

        const requiredMaterials = getMaterials(currentLevel + 1); // 다음 레벨에 필요한 재료
        if (!checkMaterials(materials, requiredMaterials)) {
            return res.status(400).json({ message: "강화 재료가 부족합니다." });
        }

        // 강화 시도 (고정 확률 성공 20% 실패 80%)
        const success = Math.random() < 0.2; // 20% 확률
        const nextLevel = success ? currentLevel + 1 : currentLevel;

        // 트랜잭션을 통해 강화 결과 데이터베이스에 반영
        await prisma.$transaction(async (prisma) => {
            if (success) {
                await prisma.myAgents.update({
                    where: {
                        myAgentKey: player.myAgentKey,
                    },
                    data: { level: nextLevel },
                });
                // 강화 재료 차감 로직 추가
                await deductMaterials(loggedInUserId, requiredMaterials);
            }
        });

        // 강화 시도 완료 시 상태코드와 강화 결과 반환
        const resultMessage = success ? "성공" : "실패";
        return res.status(201).json({ message: `${currentLevel}강에서 ${nextLevel}강으로 강화가 ${resultMessage}했습니다!` });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});

// 필요한 재료 확인 함수
function checkMaterials(materials, requiredMaterials) {
    // 재료 확인 로직 구현
    // 예시: materials.cash >= requiredMaterials.cash
    return true; // 예시로 항상 true 반환
}

// 강화에 필요한 재료를 가져오는 함수
function getMaterials(level) {
    // 레벨에 따른 필요한 재료 반환 로직 구현
    return { cash: 1000 }; // 예시로 1000 현금 필요
}

// 재료 차감 로직
async function deductMaterials(userID, requiredMaterials) {
    // 재료 차감 로직 구현
    await prisma.assets.update({
        where: { userKey: userID },
        data: {
            cash: { decrement: requiredMaterials.cash },
        },
    });
}



 // 승급 라우터
 router.patch("/users/:key/agents/promote", async (req, res) => {
    const { key } = req.params;
    const { agentKey } = req.body;

    // // 로그인 상태인지 확인
    // if (!checkLogin(req)) {
    //     return res.status(401).json({ message: "로그인 부터 해주세요!!" });
    // }

    // 로그인 된 계정의 아이디가 아닌 경우 거절
    const loggedInUserId = await prisma.users.findFirst({where:{userKey: +key}})
    // if (loggedInUserId !== key) { // key를 사용하여 비교
    //     return res.status(403).json({ message: "당신 계정이 아녀요!!" });
    // }

    try {
        // 보유 선수 확인
        const myAgent = await prisma.myAgents.findUnique({
            where: {  agentKey: agentKey, userKey: +key  }
        });

        if (!myAgent) {
            return res.status(404).json({ message: "보유하고 있는 선수가 아닙니다." });
        }

        // 이미 6단 선수 시 거부
        if (myAgent.rank >= 6) {
            return res.status(400).json({ message: "이미 6단 선수입니다." });
        }

        // 중복 보유량이 없을 경우 거부
        if (myAgent.count <= 1) {
            return res.status(400).json({ message: "중복 보유 선수가 없습니다." });
        }

        // 중복 보유 선수만 있다면 승급 처리
        const updatedAgent = await prisma.myAgents.update({
            where: {  agentKey: agentKey, userKey: +key  }, 
            data: {
                rank: { increment: 1 },
                count: { decrement: 1 }
            }
        });

        // 포지션 특화 능력치 10% 증가 
        const originalStats = {
            mainStat1: myAgent.mainStat1,
            mainStat2: myAgent.mainStat2
        };

        const newStats = {
            mainStat1: Math.floor(originalStats.mainStat1 * 1.1), // 10% 증가
            mainStat2: Math.floor(originalStats.mainStat2 * 1.1)  // 10% 증가
        };

        // 승급 완료 시 상태코드와 승급 결과 반환
        res.status(200).json({
            message: "승급 결과",
            result: updatedAgent,
            class: `${myAgent.class} ⇒ ${updatedAgent.class}`, 
            stat: {
                mainStat1: `${originalStats.mainStat1} ⇒ ${newStats.mainStat1}`,
                mainStat2: `${originalStats.mainStat2} ⇒ ${newStats.mainStat2}`
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});
export default router;