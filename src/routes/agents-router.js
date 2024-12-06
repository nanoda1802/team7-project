import express from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma/index.js";
import champVerification from "../middlewares/agent-verify-middleware.js";
import authMiddleware from "../middlewares/auth-middleware.js";

const router = express.Router();

// 챔피언 도감 조회
router.post("/agents", async (req, res, next) => {
  try {
    const { showHow, showWhat, orderBy, orderHow } = req.body;
    // 기본 값 설정
    let whereCondition = { NOT: [] };
    let orderByCondition = { name: "asc" };

    if (showHow) {
      // showHow 유효성 검사
      const validShowHow = ["team", "position", "grade"];
      if (!validShowHow.includes(showHow))
        return res.status(400).json({
          errorMessage: `유효하지 않은 showHow 값입니다. 목록: [${validShowHow.join(", ")}]`,
        });

      // showWhat 유효성 검사
      const validShowWhat = await prisma
        .$queryRawUnsafe(`SELECT ${showHow} FROM Agents GROUP BY 1`)
        .then((what) => what.map((e) => Object.values(e)[0]));
      if (!validShowWhat.includes(showWhat))
        return res.status(400).json({
          errorMessage: `유효하지 않은 showWhat 값입니다. 목록: [${validShowWhat.join(", ")}]`,
        });

      // 기본 쿼리 설정
      whereCondition = { [showHow]: showWhat };
    }
    if (orderBy) {
      // orderBy 유효성 검사
      const validOrderBy = ["name", "position", "grade", "team"];
      if (!validOrderBy.includes(orderBy))
        return res.status(400).json({
          errorMessage: `유효하지 않은 orderBy 값입니다. 목록: [${validOrderBy.join(", ")}]`,
        });

      // orderHow 유효성 검사
      const validOrderHow = ["asc", "desc"];
      if (orderHow && !validOrderHow.includes(orderHow))
        return res.status(400).json({
          errorMessage: `유효하지 않은 orderHow 값입니다. 목록: [${validOrderHow.join(", ")}]`,
        });

      // 기본값은 이름순 정렬
      orderByCondition = { [orderBy]: orderHow || "asc" };
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

    return res.status(200).json({ data: showAgents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

// 보유 챔피언 조회
router.get("/users/agents", authMiddleware, async (req, res, next) => {
  const { user } = req;

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

  return res.status(200).json({ data: showMyAgents });
});

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
                  where: {
                    userKey_agentKey: {
                      agentKey: myAgent.agentKey,
                      userKey: myAgent.userKey,
                    },
                  },
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
                where: {
                  userKey_agentKey: {
                    agentKey: myAgent.agentKey,
                    userKey: myAgent.userKey,
                  },
                },
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
router.patch(
  "/users/agents/gacha",
  authMiddleware,
  champVerification,
  async (req, res, next) => {
    try {
      const { count, pickup } = req.body;
      const { agent, user } = req;
      let enhancerCount = 0;
      let totalCost = 0;
      let totalMileage = 0;
      const validCount = [1, 10];

      // 횟수 확인
      if (!count || isNaN(+count) || !validCount.includes(+count))
        return res.status(400).json({
          errorMessage: "뽑을 횟수는 <count> 숫자(양의 정수)로 입력해주세요.",
        });

      // 픽업 챔피언 확인
      if (agent.grade !== "s")
        return res
          .status(400)
          .json({ errorMessage: "<pickup> 챔피언은 S급이여야 합니다!" });

      //할인 적용
      if (count >= 10) {
        totalCost = count * 900;
        totalMileage = count * 9;
      } else {
        totalCost = count * 1000;
        totalMileage = count * 10;
      }

      // 비용 확인
      const userAssets = await prisma.assets.findUnique({
        where: { userKey: user.userKey },
      });
      if (userAssets.cash < totalCost)
        return res.status(400).json({ errorMessage: "캐시가 부족합니다." });
      let countA = userAssets.countA;
      let countS = userAssets.countS;

      // 총 챔피언 조회
      const agents = await prisma.agents.findMany({
        select: {
          agentKey: true,
          team: true,
          name: true,
          grade: true,
          position: true,
        },
      });
      if (!agents)
        return res
          .status(404)
          .json({ errorMessage: "챔피언 조회에 실패 하였습니다." });
      // 급 나누기
      const aAgents = agents.filter((agent) => agent.grade === "a");
      const sAgents = agents.filter((agent) => agent.grade === "s");

      // 등급별 챔피언 랜덤 설정
      function getRandomAgent(agents, pickup = null) {
        if (!pickup) {
          // 기본 균등 확률
          return agents[Math.trunc(Math.random() * agents.length)];
        }
        // 가중치 설정 prob1 = pickup 확률 prob2 = 나머지 s급 확률
        const prob1 = 65;
        const prob2 = (100 - prob1) / agents.length - 1;
        // 확률 계산
        const weights = agents.map((agent) =>
          agent.agentKey === pickup ? prob1 : prob2
        );
        const random = Math.trunc(Math.random() * 100);

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
        await tx.myAgents.upsert({
          where: { userKey_agentKey: { userKey, agentKey } },
          update: {
            count: { increment: 1 },
          },
          create: {
            userKey: +userKey,
            agentKey,
            count: 1,
            level: 1,
            class: 0,
            name,
          },
        });
      }

      const results = await prisma.$transaction(
        async (tx) => {
          const results = [];

          // 뽑기 횟수만큼 반복
          for (let i = 0; i < count; i++) {
            // 픽업 천장일 시
            if (countS === 50) {
              const selectedAgent = sAgents.find((e) => e.agentKey === pickup);
              //픽업 확률 초기화
              countS = 0;
              // 나온값 을 저장
              results.push({ agent: selectedAgent, countS, countA });
              // DB에 업데이트
              await updateMyAgentsTransaction(
                tx,
                user.userKey,
                selectedAgent.agentKey,
                selectedAgent.name
              );
              continue;
            }
            // A 천장
            if (countA === 5) {
              const selectedAgent = getRandomAgent(aAgents);
              countA = 0;
              results.push({ agent: selectedAgent, countS, countA });
              await updateMyAgentsTransaction(
                tx,
                user.userKey,
                selectedAgent.agentKey,
                selectedAgent.name
              );
              continue;
            }

            const random = Math.random();
            // 꽝( 강화 재료)
            if (random <= 0.7) {
              enhancerCount++;
              countA++;
              countS++;
              results.push({ agent: "enhancer", countS, countA });
              // 기본 A급 챔피언 확률
            } else if (random <= 0.94) {
              const selectedAgent = getRandomAgent(aAgents);
              countA = 0;
              countS++;
              results.push({ agent: selectedAgent, countS, countA });
              await updateMyAgentsTransaction(
                tx,
                user.userKey,
                selectedAgent.agentKey,
                selectedAgent.name
              );
              // 기본 S급 챔피언 확률
            } else {
              //픽업 확률 적용
              const selectedAgent = getRandomAgent(sAgents, pickup);
              countS = 0;
              countA++;
              results.push({ agent: selectedAgent, countS, countA });
              await updateMyAgentsTransaction(
                tx,
                user.userKey,
                selectedAgent.agentKey,
                selectedAgent.name
              );
            }
          }
          // 지갑 업데이트
          await tx.assets.update({
            where: { userKey: user.userKey },
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
      return res.status(500).json({ error: "서버 오류" });
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

      // 보유 챔피언 확인
      const myAgent = await prisma.myAgents.findFirst({
        where: { agentKey: agent.agentKey, userKey: user.userKey },
      });
      if (!myAgent)
        return res
          .status(404)
          .json({ errorMessage: "현재 보유한 챔피언이 아닙니다" });

      const currentLevel = myAgent.level;
      let nextLevel = currentLevel;
      let successRate = 0; // 강화 확률
      let requiredEnhancer = 0; // 강화에 필요한 재료
      let message = ""; // 메시지 초기화
      let warningMessage = "9강 이하에서는 강화레벨이 하락하지 않습니다!!"; // 경고 메시지 초기화
      // 레벨마다 강화 확률, 필요 재료 정하는 로직
      if (currentLevel > 12) {
        successRate = 10;
        requiredEnhancer = 7;
      } else if (currentLevel > 9) {
        warningMessage = "주의! 10강부터 강화실패하면 레벨이 1 떨어집니다!!";
        successRate = 25;
        requiredEnhancer = 6;
      } else if (currentLevel > 6) {
        successRate = 50;
        requiredEnhancer = 5;
      } else if (currentLevel > 3) {
        successRate = 70;
        requiredEnhancer = 3;
      } else if (currentLevel > 0) {
        successRate = 90;
        requiredEnhancer = 1;
      }
      // 강화 시도 (확률에 따라 성공 여부 결정)
      const success = Math.random() * 100 < successRate; // 성공 여부

      if (currentLevel >= 15)
        return res
          .status(401)
          .json({ message: "이미 최대 강화에 도달한 챔피언 입니다!" });

      // 보유 재료 확인
      const asset = await prisma.assets.findFirst({
        where: { userKey: user.userKey },
      });
      let balanceEnhancer = asset.enhancer - requiredEnhancer;
      // 강화 재료가 부족한 경우
      // 강화 재료가 충분할 경우 강화 재료 사용
      if (balanceEnhancer < 0) {
        //마일리지 100 당 강화 재료 1개로 인식하여 부족분 충족 확인
        if (Math.trunc(asset.mileage / 100) < -balanceEnhancer)
          return res.status(400).json({
            message: "강화 재료가 부족합니다!!",
            needOr: {
              enhancer: `${asset.enhancer} / ${requiredEnhancer}`,
              mileage: `${asset.mileage} / ${requiredEnhancer * 100}`,
            },
          });
        else {
          //마일리지 감소된 값 저장
          asset.mileage -= -balanceEnhancer * 100;
          balanceEnhancer = 0;
        }
      }

      if (success) {
        nextLevel++; // 성공 시 레벨 증가
        message = `${agent.name}(이)가 ${nextLevel}강 강화에 성공했습니다!`;
      } else {
        // 실패 시 10강 이상일 경우 레벨 감소
        if (currentLevel >= 10) {
          nextLevel--;
          message = `${agent.name}(이)가 강화가 실패해 ${nextLevel}강으로 떨어졌습니다.`;
        } else {
          message = "강화에 실패했습니다.";
        }
      }

      const updateUser = await prisma.users.update({
        where: { userKey: user.userKey },
        data: {
          asset: {
            update: {
              data: {
                enhancer: balanceEnhancer,
                mileage: asset.mileage,
              },
            },
          },
          myAgent: {
            update: {
              where: {
                userKey_agentKey: {
                  userKey: user.userKey,
                  agentKey: agent.agentKey,
                },
              },
              data: {
                level: nextLevel,
              },
            },
          },
        },
        include: {
          asset: true,
          myAgent: true,
        },
      });

      // 강화 시도 완료 시 상태코드와 강화 결과 반환
      return res.status(201).json({
        message: message,
        warning: warningMessage, // 떨어질수도 있단 경고 메시지 추가
        successRate: `${successRate}%`, // 퍼센트로 보이게 변경
        enhancer: updateUser.asset.enhancer, // 현재 보유한 강화 재료 수량 표시
        mileage: updateUser.asset.mileage, // 현재 마일리지 표시
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
    try {
      const { agent, user } = req;

      // 보유 선수 확인
      const myAgent = await prisma.myAgents.findFirst({
        where: { agentKey: agent.agentKey, userKey: user.userKey },
      });
      if (!myAgent)
        return res
          .status(404)
          .json({ errorMessage: "현재 보유하고 있는 챔피언이 아닙니다." });
      // 최대 승급된 챔피언 시 거부
      if (myAgent.class >= 6)
        return res
          .status(400)
          .json({ errorMessage: "이미 최대 승급을 달성한 선수입니다" });
      // 중복 보유량이 없을 경우 거부
      if (myAgent.count <= 1) {
        return res.status(400).json({ message: "승급할 챔피언이 부족합니다" });
      }

      // 중복 보유 선수만 있다면 승급 처리
      const updatedAgent = await prisma.myAgents.update({
        where: {
          userKey_agentKey: { userKey: user.userKey, agentKey: agent.agentKey },
        },
        data: {
          count: { decrement: 1 },
          class: { increment: 1 },
        },
      });

      // 승급 완료 시 상태코드와 승급 결과 반환
      return res.status(200).json({
        message: "승급 결과",
        result: updatedAgent,
        class: `${myAgent.class} ⇒ ${updatedAgent.class}`,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  }
);

export default router;
