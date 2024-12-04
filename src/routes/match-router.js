import express from "express";
import { prisma } from "../utils/prisma/index.js";

/* 계정 라우터 생성 */
const router = express.Router();

/* 스쿼드 종합 점수 계산 */
const checkSquadScore = async (key) => {
  // [1] 스쿼드 구성 멤버 확인
  const checkSquad = await prisma.users.findFirst({
    where: { userKey: key },
    select: { squadMem1: true, squadMem2: true, squadMem3: true },
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
  console.log(squadScore);
};

/* 친선전 API */
router.post("/users/:key/select-match", async (req, res, next) => {
  const { key } = req.params; // 매개 경로변수에서 내 userKey 받음
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
  return res.status(201).json({ message: `나의 팀 점수 ${myScore}점, 상대 팀 점수 ${counterScore}점으로 ${matchResult}` });
});

/* 정규전 API */
router.post("/users/:key/rank-match", async (req, res, next) => {});

/* 라우터 내보내기 */
export default router;
