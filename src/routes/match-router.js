import express from "express";
import { prisma } from "../utils/prisma/index.js";
import authMiddleware from '../middlewares/auth-middleware.js';
import champVerification from "../middlewares/agent-verify-middleware.js"
import { check } from "prisma";

/* 계정 라우터 생성 */
const router = express.Router();

/* 스쿼드 종합 점수 계산 */
const checkSquadScore = async (key) => {
  // [1] 스쿼드 구성 멤버 확인
  const checkSquad = await prisma.users.findFirst({
    where: { userKey: key },
    select: { squadMem1: true, squadMem2: true, squadMem3: true, synergy: true },
  });
  const memKeys = Object.values(checkSquad); // 구성 멤버의 agentKey만 담은 배열!!
  let squadScore = 0;
  // [2] 구성 멤버 스탯에 강화 및 돌파 수치 적용
  for (let memKey of memKeys) {
    // [2-1] 구성 멤버 스탯 수령
    let status = await prisma.stats.findFirst({
      where: { agentKey: memKey },
      select: { ad: true, ap: true, hp: true, mp: true, def: true, crit: true },
    });
    // [2-2] 강화 수치와 돌파 수치와 포지션 확인
    let { level, class: star } = await prisma.myAgents.findFirst({
      where: { userKey: key, agentKey: memKey },
      select: { level: true, class: true },
    });
    let { position } = await prisma.agents.findFirst({
      where: { agentKey: memKey },
      select: { position: true },
    });
    // [2-3] 수치에 맞게 능력치 변동 적용
    for (let stat in status) {
      // [2-3a] 전 스탯에 강화 수치 적용
      status[stat] *= 1 + level * 0.02;
      // [2-3b] 특화 스탯에 돌파 수치 적용
      switch (stat) {
        case "ad":
          position === "warrior" ? (status[stat] *= 1 + star * 0.1) : status[stat];
          break;
        case "ap":
          position === "wizard" ? (status[stat] *= 1 + star * 0.1) : status[stat];
          break;
        case "hp":
          position === "tanker" ? (status[stat] *= 1 + star * 0.1) : status[stat];
          break;
        case "mp":
          position === "wizard" ? (status[stat] *= 1 + star * 0.1) : status[stat];
          break;
        case "def":
          position === "tanker" ? (status[stat] *= 1 + star * 0.1) : status[stat];
          break;
        case "crit":
          position === "warrior" ? (status[stat] *= 1 + star * 0.1) : status[stat];
          break;
      }
      squadScore += status[stat];
    }
  }
  // [3] 팀 시너지 적용 여부 판단
  checkSquad.synergy !== "none" ? (squadScore *= 1.1) : squadScore;
  // [4] 소수점 날린 팀 스코어 반환
  return Math.trunc(squadScore);
};

/* 친선전 API */
router.post("/users/:key/select-match", authMiddleware, async (req, res, next) => {
  const { key } = req.params; // 매개 경로변수에서 내 userKey 받음
  // 인증 미들웨어 거쳐서도 내 키 받음
  const { counterpart } = req.body; // body에서 상대방 아이디 수령
  // [검사 authMW] : 로그아웃 상태면 거부
  // [검사 authMW] : 로그인 정보와 아이디 불일치 시 거부
  // [검사 01] : 팀편성 안 됐을 시 거부
  const { squadMem1, squadMem2, squadMem3 } = await prisma.users.findFirst({
    where: { userKey: +key },
  });
  if (!(squadMem1 && squadMem2 && squadMem3)) return res.status(401).json({ message: "팀편성부터 하세요라!!" });
  // [검사 02] : 상대 유저 정보가 존재하지 않을 시 거부
  const counterUser = await prisma.users.findFirst({
    where: { nickname: counterpart },
  });
  if (!counterUser) return res.status(404).json({ message: "존재하지 않는 유저임다!!" });
  // [검사 03] : 상대 유저가 팀 편성이 되지 않은 경우 거부
  if (!(counterUser.squadMem1 && counterUser.squadMem2 && counterUser.squadMem3)) {
    return res.status(401).json({ message: "팀이 없는 유저에요!!" });
  }
  // [1] 각 팀 스코어 체크
  const myScore = await checkSquadScore(+key);
  const counterScore = await checkSquadScore(counterUser.userKey);
  // [2] 스코어 비교해 경기 결과 계산
  let matchResult = "";
  if (myScore > counterScore) {
    matchResult = "승리!!";
  } else if (myScore < counterScore) {
    matchResult = "패배!!";
  } else if (myScore === counterScore) {
    matchResult = "무승부!!";
  }
  // [3] 각 팀의 스코어와 경기 결과 응답
  return res
    .status(201)
    .json({ message: `나의 팀 점수 ${myScore}점, 상대 팀 점수 ${counterScore}점으로 ${matchResult}` });
});

/* 매치 메이킹 */
const matchMaking = async (key) => {
  // [1] 내 계정 mmr 찾기
  const { mmr: myMatchRank } = await prisma.ranks.findFirst({
    where: { userKey: key },
    select: { mmr: true },
  });
  // [2] 내 mmr 그룹 찾기
  const matchRanks = await prisma.ranks.findMany({
    where: {
      mmr: { gte: myMatchRank - 1000, lte: myMatchRank + 1000 },
    },
    select: { userKey: true, mmr: true },
  });
  // [3] mmr 그룹에서 본인과 팀편성 미비 유저 제외하고 다시 그루핑? 하츄핑?
  const myRankGroup = await Promise.all(
    matchRanks.map(async (user) => {
      const { squadMem1, squadMem2, squadMem3 } = await prisma.users.findFirst({
        where: { userKey: user.userKey },
      });
      // [3-1] 팀편성이 돼있고, 내 계정이 아닌 경우만 살려줌
      return squadMem1 && squadMem2 && squadMem3 && user.userKey !== key ? user : false;
    })
  ).then((users) => users.filter((user) => user)); // [3-2] 살아남은 넘만 필터링
  // [4] 그룹 중 한 명 랜덤으로 선정!!
  const counterpart = myRankGroup[Math.trunc(Math.random() * myRankGroup.length)].userKey;
  // [5] 상대할 유저의 userKey 반환
  return counterpart;
};

/* 경기 결과 적용 */
const applyMatchResult = async (matchResult, winner, loser) => {
  // [1] 승, 패, 무 분기별로 트랜잭션 ON
  if (matchResult !== "무승부!!") {
    // [2] 승패가 갈렸을 때
    await prisma.$transaction(async (tx) => {
      // [2-1] Ranks 테이블에서, 승자 winCount 1 증가하고 mmr 50 증가
      await tx.ranks.update({
        where: { userKey: winner },
        data: { winCount: { increment: 1 }, mmr: { increment: 50 } },
      });
      // [2-2] Ranks 테이블에서, 패자 loseCount 1 증가하고 mmr 20 감소
      await tx.ranks.update({
        where: { userKey: loser },
        data: { loseCount: { increment: 1 }, mmr: { decrement: 20 } },
      });
      // [2-3] Assets 테이블에서, 승자 enhancer 10 증가하고 cash 50,000 증가
      await tx.assets.update({
        where: { userKey: winner },
        data: { enhancer: { increment: 10 }, cash: { increment: 50000 } },
      });
      // [2-3] Assets 테이블에서, 패자 enhancer 2 증가하고 cash 10,000 증가
      await tx.assets.update({
        where: { userKey: loser },
        data: { enhancer: { increment: 2 }, cash: { increment: 10000 } },
      });
    });
  } else if (matchResult === "무승부!!") {
    // [3] 비겼을 때
    await prisma.$transaction(async (tx) => {
      // [3-1] Ranks 테이블에서, 둘다 drawCount 1 증가하고 mmr 5 증가
      await tx.ranks.updateMany({
        where: { userKey: { in: [winner, loser] } },
        data: { drawCount: { increment: 1 }, mmr: { increment: 5 } },
      });
      // [3-2] Assets 테이블에서, 둘다 enhancer 5 증가하고 cash 30,000 증가
      await tx.assets.updateMany({
        where: { userKey: { in: [winner, loser] } },
        data: { enhancer: { increment: 5 }, cash: { increment: 30000 } },
      });
    });
  }
};

/* 정규전 API */
router.post("/users/:key/rank-match", async (req, res, next) => {
  const { key } = req.params; // 매개 경로변수에서 내 userKey 받음
  // 인증 미들웨어 거쳐서도 내 키 받음
  // [검사 authMW] : 로그아웃 상태면 거부
  // [검사 authMW] : 로그인 정보와 아이디 불일치 시 거부
  // [검사 01] : 팀편성 안 됐을 시 거부
  const { squadMem1, squadMem2, squadMem3 } = await prisma.users.findFirst({
    where: { userKey: +key },
  });
  if (!(squadMem1 && squadMem2 && squadMem3)) return res.status(401).json({ message: "팀편성부터 하세요라!!" });
  // [1] 매치 메이킹
  const counterKey = await matchMaking(+key);
  // [2] 스코어 비교해 경기 결과 계산
  const myScore = await checkSquadScore(+key);
  const counterScore = await checkSquadScore(counterKey);
  // [3] 승, 패, 무 분기 별로 보상 및 점수 변동 적용
  let matchResult = "";
  if (myScore > counterScore) {
    matchResult = "승리!!";
    applyMatchResult(matchResult, +key, counterKey);
  } else if (myScore < counterScore) {
    matchResult = "패배!!";
    applyMatchResult(matchResult, counterKey, +key);
  } else if (myScore === counterScore) {
    matchResult = "무승부!!";
    applyMatchResult(matchResult, +key, counterKey);
  }
  // [4] 각 팀의 스코어와 경기 결과 응답
  return res
    .status(201)
    .json({ message: `나의 팀 점수 ${myScore}점, 상대 팀 점수 ${counterScore}점으로 ${matchResult}` });
});

// 랭킹 조회 api
router.get('/users/ranks', async (req, res, next) => {
  let resJson = [];

  const ranking = await prisma.ranks.findMany({
    orderBy: [{
      mmr: 'desc',
    }, {
      loseCount: 'asc'
    }],
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

  for (let i = 0; i < ranking.length; i++) {

    const winningRate = Math.round(ranking[i].winCount / (ranking[i].winCount + ranking[i].loseCount + ranking[i].drawCount) * 100) || 0

    resJson = [...resJson,
    {
      rank: i + 1,
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

// 팀편성 API
router.put('/users/:key/formation', champVerification, async (req, res, next) => {
  const { formation } = req.body;
  const { key } = req.params;
  // 유효성 평가 미들웨어로 챔피언 배열 받아옴
  const agent = req.agent
  let myAgent = [];
  let tank = false;

  for (let i = 0; i < formation.length; i++) {

    myAgent[i] = await prisma.myAgents.findFirst({ where: { agentKey: +formation[i], userKey: +key } })
    //보유 챔피언 확인
    if (!myAgent[i]) return res
      .status(400)
      .json({ errorMessage: `${agent[i].name}/${formation[i]}(은)는 현재 보유한 챔피언이 아닙니다.` })
    if (agent[i].position === "tanker") {
      tank = true;
    }
    if (myAgent.indexOf(myAgent[i]) !== i) return res
      .status(400)
      .json({ errorMessage: "동일 챔피언은 동시에 배치할 수 없습니다." })
  }
  // 탱커 여부 확인
  if (!tank) return res
    .status(400)
    .json({ errorMessage: "팀편성에는 탱커가 1명 이상 필요합니다" })


  if (myAgent.length !== 3) return res
    .status(400)
    .json({ errorMessage: "팀편성에는 3명의 챔피언이 필요합니다" })

  //시너지 확인
  const synergy = [...new Set(agent.map(e => e.team).filter((e, idx, arr) => {
    if (idx !== arr.indexOf(e) && arr.indexOf(e) !== -1)
      return true
    else return false
  }))].join("") || "none"

  // 저장
  const updateUser = await prisma.users.update({
    where: { userKey: +key },
    data: {
      squadMem1: +myAgent[0].agentKey,
      squadMem2: +myAgent[1].agentKey,
      squadMem3: +myAgent[2].agentKey,
      synergy
    }
  })

  // 반환
  return res
    .status(201)
    .json({
      message: "성공적으로 팀이 편성되었습니다.",
      squd: [`${myAgent[0].name}(${agent[0].position})`,
      `${myAgent[1].name}(${agent[1].position})`,
      `${myAgent[2].name}(${agent[2].position})`],
      synergy
    })
})

//대표 챔피언 설정 API
router.patch('/users/:key/favorite', champVerification, async (req, res, next) => {
  const { agent } = req
  const { key } = req.params;

  const myAgent = await prisma.myAgents.findFirst({ where: { agentKey: +agent.agentKey, userKey: +key } })
  // 보유 챔피언 확인
  if (!myAgent) return res
    .status(400)
    .json({ errorMessage: `${agent.name}/${agent.agentKey}(은)는 현재 보유한 챔피언이 아닙니다.` })

  // 저장
  const updateUser = await prisma.users.update({
    where: { userKey: +key },
    data: {
      favoriteAgent: +myAgent.agentKey,
    }
  })

  // 반환
  return res
    .status(201)
    .json({
      message: "대표 챔피언이 변경되었습니다.",
      favorite: myAgent.name
    })
})


/* 라우터 내보내기 */
export default router;
