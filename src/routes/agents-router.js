import express from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma/index.js";
import champVerification from "../middlewares/agent-verify-middleware.js";
import authMiddleware from "../middlewares/auth-middleware.js";

const router = express.Router();

// 챔피언 도감 조회
router.post("/agents", async (req, res, next) => {
  try {
    const {showHow, showWhat, orderBy, orderHow} = req.body
    // 기본 값 설정
    let whereCondition = { NOT : []}
    let orderByCondition = { name: "asc" }

    if (showHow) {
      // showHow 유효성 검사
      const validShowHow = ["team", "position", "grade"];
      if (!validShowHow.includes(showHow)) return res
        .status(400)
        .json({ errorMessage: `유효하지 않은 showHow 값입니다. 목록: [${validShowHow.join(", ")}]`});

      // showWhat 유효성 검사
      const validShowWhat = await prisma.$queryRawUnsafe(`SELECT ${showHow} FROM Agents GROUP BY 1`).then((what) => what.map((e) => Object.values(e)[0]))
      if (!validShowWhat.includes(showWhat)) return res
        .status(400)
        .json({ errorMessage: `유효하지 않은 showWhat 값입니다. 목록: [${validShowWhat.join(", ")}]`});

      // 기본 쿼리 설정
      whereCondition = { [showHow]: showWhat }
    }
    if (orderBy) {
      // orderBy 유효성 검사
      const validOrderBy = ["name", "position", "grade", "team"];
      if (!validOrderBy.includes(orderBy)) return res
        .status(400)
        .json({ errorMessage: `유효하지 않은 orderBy 값입니다. 목록: [${validOrderBy.join(", ")}]`});

      // orderHow 유효성 검사
      const validOrderHow = ["asc", "desc"];
      if (orderHow && !validOrderHow.includes(orderHow)) return res
        .status(400)
        .json({ errorMessage: `유효하지 않은 orderHow 값입니다. 목록: [${validOrderHow.join(", ")}]` });

      // 기본값은 이름순 정렬
      orderByCondition = { [orderBy]: orderHow || "asc" }
    }
    
    // 동적 쿼리 실행
    const showAgents = await prisma.agents.findMany({
      where: whereCondition,
      select: {
        name: true,
        team: true,
        position: true,
        grade: true,
      },
      orderBy: [orderByCondition], // 동적으로 생성된 orderBy 조건 사용
    });

    return res
      .status(200)
      .json({ data: showAgents });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "서버 오류" });
  }
});

// 보유 챔피언 조회
router.get("/users/agents", authMiddleware, async (req, res, next) => {
  const { user } = req

  const showMyAgents = await prisma.myAgents.findMany({
    where: { userKey: user.userKey },
    select: {
      agentKey: true,
      name: true,
      class: true,
      level: true,
      count: true,
      agent: {
        select: {
          team: true,
          position: true,
          grade: true,
        },
      },
    },
  });

  return res
    .status(200)
    .json({ data: showMyAgents });
});

// 챔피언 매각
// 챔피언 매각
router.patch(
  "/users/agents/sale",
  authMiddleware,
  champVerification,
  async (req, res, next) => {
    const { agent, user } = req;
    let resJson = [];

    //다중 매각
    if (Array.isArray(agent)) {
      for (let i = 0; i < agent.length; i++) {
        const count = req.body[i].count;
        const myAgent = await prisma.myAgents.findFirst({
          where: { userKey: user.userKey, agentKey: agent[i].agentKey },
        });
        const amount =
          agent[i].grade === "s" ? 300000 * +count : 100000 * +count;

        if (!myAgent || myAgent.count < count) {
          0;
          resJson = [
            ...resJson,
            {
              errorMessage: `판매할 챔피언(${agent[i].name})(이)가 부족합니다`,
            },
          ];
        } else {
          const update = await prisma.users.update({
            where: { userKey: user.userKey },
            data: {
              asset: {
                update: {
                  data: {
                    cash: { increment: +amount },
                  },
                },
              },
              myAgent: {
                update: {
                  where: { myAgentKey: +myAgent.myAgentKey },
                  data: {
                    count: { decrement: +count },
                  },
                },
              },
            },
            include: {
              asset: {
                select: {
                  cash: true,
                },
              },
            },
          });

          resJson = [
            ...resJson,
            {
              message: `성공적으로 챔피언 ${agent[i].name}(을)를 ${count}만큼 판매하였습니다.`,
              amount: `+${amount}`,
              cash: update.asset.cash,
            },
          ];
        }
      }
      //단일 매각
    } else {
      const { count } = req.body;
      const myAgent = await prisma.myAgents.findFirst({
        where: { userKey: user.userKey, agentKey: agent.agentKey },
      });
      const amount = agent.grade === "s" ? 300000 * count : 100000 * count;

      if (!myAgent || myAgent.count < count) {
        resJson = [
          { errorMessage: `판매할 챔피언(${agent.name})(이)가 부족합니다` },
        ];
      } else {
        const update = await prisma.users.update({
          where: { userKey: user.userKey },
          data: {
            asset: {
              update: {
                data: {
                  cash: { increment: +amount },
                },
              },
            },
            myAgent: {
              update: {
                where: { myAgentKey: +myAgent.myAgentKey },
                data: {
                  count: { decrement: +count },
                },
              },
            },
          },
          include: {
            asset: {
              select: {
                cash: true,
              },
            },
          },
        });

        resJson = [
          {
            message: `성공적으로 챔피언 ${agent.name}(을)를 ${count}만큼 판매하였습니다.`,
            amount: `+${amount}`,
            cash: update.asset.cash,
          },
        ];
      }
    }

    // 남은 숫자가 0 이하인 챔피언 삭제
    const deleteMyAgent = await prisma.myAgents.deleteMany({
      where: { count: { lte: 0 }, userKey: user.userKey },
    });

    return res.status(200).json(resJson);
  }
);

// 챔피언 뽑기
router.patch("/users/agents/gacha", authMiddleware, champVerification, async (req, res, next) => {
  try {
      const { count } = req.body;
      const  key  = req.user.userKey;
      const pickUpAgent = req.agent;
      

      if (!count || isNaN(+count) || count <= 0) {
        throw new Error("뽑기 횟수는 양의 정수여야 합니다.");
      }

      if (pickUpAgent.grade !== "s") {
        throw new Error(`해당 챔피언은 s급이 아닙니다.`);
      }

      const results = await prisma.$transaction(
        async (tx) => {
          const userAssets = await tx.assets.findUnique({
            where: { userKey: +key },
          });

          if (!userAssets) {
            throw new Error(" 유저의 지갑이 존재하지 않습니다.");
          }

          let enhancerCount = 0;
          let countA = userAssets.countA;
          let countS = userAssets.countS;
          const results = [];
          let totalCost = 0;
          let totalMileage = 0;

          //할인 적용
          if (count >= 10) {
            totalCost = count * 900;
            totalMileage = count * 9;
          } else {
            totalCost = count * 1000;
            totalMileage = count * 10;
          }

          if (userAssets.cash < totalCost) {
            throw new Error("캐시가 부족합니다.");
          }

          const agents = await tx.agents.findMany({
            select: {
              agentKey: true,
              team: true,
              name: true,
              grade: true,
              position: true,
            },
          });

          const aAgents = agents.filter((agent) => agent.grade === "a");
          const sAgents = agents.filter((agent) => agent.grade === "s");

          for (let i = 0; i < count; i++) {
            if (countS === 50) {
              const selectedAgent = getRandomAgent(sAgents, (agentKey) =>
                agentKey === req.body.agentKey ? 1 / 3 : 2 / 45
              );
              countS = 0;
              results.push({ agent: selectedAgent });
              await updateMyAgentsTransaction(
                tx,
                key,
                selectedAgent.agentKey,
                selectedAgent.name
              );
              continue;
            }

            if (countA === 5) {
              const selectedAgent = getRandomAgent(aAgents);
              countA = 0;
              results.push({ agent: selectedAgent });
              await updateMyAgentsTransaction(
                tx,
                key,
                selectedAgent.agentKey,
                selectedAgent.name
              );
              continue;
            }

            const random = Math.random();
            if (random <= 0.7) {
              enhancerCount++;
              countA++;
              countS++;
              results.push({ agent: "enhancer" });
            } else if (random <= 0.94) {
              const selectedAgent = getRandomAgent(aAgents);
              countA = 0;
              countS++;
              results.push({ agent: selectedAgent });
              await updateMyAgentsTransaction(
                tx,
                key,
                selectedAgent.agentKey,
                selectedAgent.name
              );
            } else {
              const selectedAgent = getRandomAgent(sAgents, (agentKey) =>
                agentKey === req.body.agentKey ? 1 / 3 : 2 / 45
              );
              countS = 0;
              countA++;
              results.push({ agent: selectedAgent });
              await updateMyAgentsTransaction(
                tx,
                key,
                selectedAgent.agentKey,
                selectedAgent.name
              );
            }
          }
          await tx.assets.update({
            where: { userKey: +key },
            data: {
              cash: { decrement: totalCost },
              enhancer: { increment: enhancerCount },
              countA: countA,
              countS: countS,
              mileage: { increment: totalMileage },
            },
          });

          return results;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        }
      );

      // Return success response
      return res.status(200).json({
        message: "갸챠 결과",
        results,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message || "서버 오류" });
    }
  }
);

// 챔피언 강화
router.patch(
  "/users/agents/intensify",
  authMiddleware,
  champVerification,
  async (req, res) => {
    try {
      const { user, agent } = req;

      // 보유 에이전트 확인
      const player = await prisma.myAgents.findFirst({
        where: { agentKey: agent.agentKey, userKey: user.userKey },
        include: {
          agent: true, // 에이전트 정보 포함
        },
      });

      if (!player || player.userKey !== user.userKey) {
        return res
          .status(404)
          .json({ message: "보유하고 있는 선수가 아닙니다." });
      }

      const currentLevel = player.level;
      if (currentLevel >= 15) {
        return res.status(400).json({ message: "이미 15강입니다." });
      }

      // 보유 재료 확인
      const materials = await prisma.assets.findFirst({
        where: { userKey: user.userKey },
      });
      // 현재 강화 확률 계산
      const successRate = getSuccessRate(currentLevel);
      const successRatePercentage = Math.round(successRate * 100); // 퍼센트로 변환

      const requiredMaterials = getMaterials(currentLevel + 1); // 다음 레벨에 필요한 재료
      const hasEnoughEnhancer =
        materials.enhancer >= requiredMaterials.enhancer;

      if (!checkMaterials(materials, requiredMaterials)) {
        return res.status(400).json({ message: "강화 재료가 부족합니다." });
      }

      // 강화 시도 (확률에 따라 성공 여부 결정)
      const success = Math.random() < successRate; // 성공 확률
      let nextLevel = currentLevel;
      let message = ""; // 메시지 초기화
      let warningMessage = ""; // 경고 메시지 초기화

      if (currentLevel >= 10) {
        warningMessage = "주의! 10강부터 강화실패하면 레벨이 1 떨어집니다!!";
      }

      if (success) {
        nextLevel = currentLevel + 1; // 성공 시 레벨 증가
        message = `${currentLevel}강에서 ${nextLevel}강으로 강화가 성공했습니다!`;
      } else {
        // 실패 시 10강 이상일 경우 레벨 감소
        if (currentLevel >= 10) {
          nextLevel = Math.max(currentLevel - 1, 0); // 레벨이 0 미만으로 떨어지지 않도록
          message = `${currentLevel}강에서 ${nextLevel}강으로 강화가 실패했으므로 레벨이 떨어졌습니다.`;
        } else {
          message = `${currentLevel}강에서 ${nextLevel}강으로 강화가 실패했습니다.`;
        }
      }
      // level +ddd
      // 트랜잭션을 통해 강화 결과 데이터베이스에 반영
      await prisma.$transaction(async (prisma) => {
        await prisma.myAgents.update({
          where: {
            myAgentKey: player.myAgentKey,
          },
          data: { level: nextLevel },
        });
        await deductMaterials(user.userKey, requiredMaterials);
      });

      // 강화 시도 완료 시 상태코드와 강화 결과 반환
      return res.status(201).json({
        message: message,
        warnig: warningMessage, // 떨어질수도 있단 경고 메시지 추가
        successRate: `${successRatePercentage}%`, // 퍼센트로 보이게 변경
        currentMaterials: materials.enhancer, // 현재 보유한 강화 재료 수량 표시
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  }
);

// 챔피언 승급
router.patch(
  "/users/agents/promote",
  authMiddleware,
  champVerification,
  async (req, res) => {
    const { agent, user } = req;

    // 로그인 된 계정의 아이디가 아닌 경우 거절

    try {
      // 보유 선수 확인
      const myAgent = await prisma.myAgents.findUnique({
        where: { agentKey: agent.agentKey, userKey: user.userKey },
      });

      if (!myAgent) {
        return res
          .status(404)
          .json({ message: "보유하고 있는 선수가 아닙니다." });
      }

      // 이미 6단 선수 시 거부
      if (myAgent.class >= 6) {
        return res.status(400).json({ message: "이미 6단 선수입니다." });
      }

      // 중복 보유량이 없을 경우 거부
      if (myAgent.count <= 1) {
        return res.status(400).json({ message: "중복 보유 선수가 없습니다." });
      }

      // 중복 보유 선수만 있다면 승급 처리
      const updatedAgent = await prisma.myAgents.update({
        where: { agentKey: agent.agentKey, userKey: user.userKey },
        data: {
          count: { decrement: 1 },
          class: { increment: 1 },
        },
      });

      // 승급 완료 시 상태코드와 승급 결과 반환
      res.status(200).json({
        message: "승급 결과",
        result: updatedAgent,
        class: `${myAgent.class} ⇒ ${updatedAgent.class}`,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  }
);

// 필요한 재료 확인 함수
function checkMaterials(materials, requiredMaterials) {
  return materials.enhancer >= requiredMaterials.enhancer;
}

// 강화에 필요한 재료를 가져오는 함수
function getSuccessRate(level) {
  if (level >= 1 && level <= 3) return 0.9;
  if (level >= 4 && level <= 6) return 0.7;
  if (level >= 7 && level <= 9) return 0.5;
  if (level >= 10 && level <= 12) return 0.25;
  if (level >= 13 && level <= 15) return 0.1;
  return 0; // 기본값
}

// 재료 차감 로직
async function deductMaterials(userID, requiredMaterials) {
  // 재료 차감 로직 구현
  await prisma.assets.update({
    where: { userKey: userID },
    data: {
      enhancer: { decrement: requiredMaterials.enhancer },
    },
  });
}

// 랜덤 챔피언 뽑기
function getRandomAgent(agents, weighting = null) {
  if (!weighting) {
    // 기본 균등 확률
    return agents[Math.floor(Math.random() * agents.length)];
  }
  const weights = agents.map((agent) => weighting(agent.agentKey)); //가중치 반환. [1/3, 2/45,...]
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0; // 이제 가중치를 모아서 어느수에 걸치는지 파악하기 위한 변수.
  for (let i = 0; i < agents.length; i++) {
    cumulative += weights[i]; //가중치를 모은다.
    if (random <= cumulative) {
      // 가중치가 랜덤에 걸렸을때.
      return agents[i]; //그 가중치의 선수.
    }
  }

  return agents[agents.length - 1]; //이건 만약 오류나면 그냥 마지막꺼 내놓음.
}


// agent업데이트 트랜잭션
async function updateMyAgentsTransaction(tx, userKey, agentKey, name) {
  const existingAgent = await tx.myAgents.findFirst({
    where: {
      userKey: +userKey,
      agentKey,
    },
  });

  if (existingAgent) {
    await tx.myAgents.update({
      where: { myAgentKey: existingAgent.myAgentKey },
      data: {
        count: { increment: 1 },
      },
    });
  } else {
    await tx.myAgents.create({
      data: {
        userKey: +userKey,
        agentKey,
        count: 1,
        level: 1,
        class: 0,
        name,
      },
    });
  }
}

export default router;
