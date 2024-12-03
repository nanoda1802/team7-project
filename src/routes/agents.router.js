import express from "express";
import { prisma } from "../utils/prisma/index.js";
import { Prisma } from "@prisma/client";

const router = express.Router();

router.get("/agents", async (req, res, next) => {
  const { option } = req.body;
  const [showHow, showWhat, orderBy, orderHow] = option.split(",");

  const validOrderBy = ["name", "position", "grade", "team"]; // 허용할 수 있는 orderBy 값들
  const validOrderHow = ["asc", "desc"]; // 허용할 수 있는 정렬 방향

  // showHow가 team, position, grade 중 하나인지 체크
  const validShowHow = ["team", "position", "grade"];
  if (!validShowHow.includes(showHow)) {
    return res.status(400).json({ error: "유효하지 않은 showHow 값입니다." });
  }

  // showWhat 유효성 검사
  if (!showWhat) {
    return res.status(400).json({ error: "showWhat 값이 필요합니다." });
  }

  // orderBy 유효성 검사
  if (!validOrderBy.includes(orderBy)) {
    return res.status(400).json({
      error: `유효하지 않은 orderBy 값입니다. 가능한 값: ${validOrderBy.join(", ")}`,
    });
  }

  // orderHow 유효성 검사
  if (!validOrderHow.includes(orderHow)) {
    return res.status(400).json({
      error: `유효하지 않은 orderHow 값입니다. 가능한 값: ${validOrderHow.join(", ")}`,
    });
  }

  // 기본 쿼리 설정
  const whereCondition = {
    [showHow]: showWhat, // showHow에 맞는 조건 설정 (team, position, grade)
  };

  const orderByCondition = validOrderBy.includes(orderBy)
    ? { [orderBy]: validOrderHow.includes(orderHow) ? orderHow : "asc" }
    : { name: "asc" }; // 기본값은 이름순 정렬

  try {
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

router.get("/users/:userKey/agents", async (req, res, next) => {
  const { userKey } = req.params;//미들웨어에서 받기.
  //const { user_key } = req.params;
  //미들웨어 넣기.

  const showMyAgents = await prisma.myAgents.findMany({
    where: { userKey: +userKey },
    select: {
      name: true,
      class: true,
      level: true,
      count: true,
    },
  });

  return res.status(200).json({ data: showMyAgents });
});


//1. 복합키가 필요한데 프리즈마 수정하기 귀찮아서 그냥 나눠서 함. 다음에 만든다면 이런상황을 예상해서 해보기.
//2. 할건 마일리지, 한번에 하는 트렌지션, 10번하면 세일하게 하는거. 
//3. 유저키 만약 숫자로 받는다면 이제 밑에 +해준거 다 빼기
//4. 카운터가 무한으로 증식해 버리네. 근데 왜 s가 안뽑혔지. 
router.patch("/users/:userKey/agents/gacha", async (req, res, next) => {
  const { numberOfGacha } = req.body;
  const { userKey } = req.params;

  try {
    const userAssets = await prisma.assets.findUnique({
      where: { userKey: +userKey },
    });
    
    let totalCost= 0; 
    let totalmileage= 0;
    if (numberOfGacha>=10){
      totalCost = numberOfGacha * 900;
      totalmileage =  numberOfGacha * 9;
    }else {
       totalCost = numberOfGacha * 1000;
       totalmileage =  numberOfGacha * 10;
      }

    if (userAssets.cash < totalCost) {
      return res.status(400).json({ error: "캐시가 부족합니다." });
    }

    const agents = await prisma.agents.findMany({
      select: {
        agentKey: true,
        name: true,
        grade: true,
      },
    });

    const aAgents = agents.filter((agent) => agent.grade === "a");
    const sAgents = agents.filter((agent) => agent.grade === "s");


    console.log(userAssets);

    let enhancerCount = 0;
    let countA = userAssets.countA;
    let countS = userAssets.countS;
    const results = [];

    for (let i = 0; i < numberOfGacha; i++) {
       if (countS === 50){
        const selectedAgent = getRandomAgent(sAgents, agentKey => agentKey === req.body.agentKey ?  (1/3): (2/45));
        countS = 0;
        results.push({agent: selectedAgent });
        await updateMyAgents(userKey, selectedAgent.agentKey , selectedAgent.name);

        continue;
       }
       
       if(countA===5){
        const selectedAgent = getRandomAgent(aAgents);
        countA = 0;
        results.push({agent: selectedAgent });
        await updateMyAgents(userKey, selectedAgent.agentKey , selectedAgent.name);

        continue;
       }

      const random = Math.random();
      if (random <= 0.7) {
        // 70% 확률: 강화재료
        enhancerCount++;
        countA++;
        countS++;
        results.push({ type: "enhancer" });
      } else if (random <= 0.94) {

        const selectedAgent = getRandomAgent(aAgents);
        countA = 0;
        countS++;
        results.push({agent: selectedAgent });
        await updateMyAgents(userKey, selectedAgent.agentKey, selectedAgent.name);
      } else {

        const selectedAgent = getRandomAgent(sAgents, agentKey => agentKey === req.body.agentKey ?  (1/3): (2/45));
        countS = 0;
        countA++;
        results.push({agent: selectedAgent });
        await updateMyAgents(userKey, selectedAgent.agentKey, selectedAgent.name);
      }
    }

    await prisma.assets.update({
      where: { userKey: +userKey },
      data: {
        cash: { decrement: totalCost },
        enhancer: { increment: enhancerCount },
        countA: countA ,
        countS: countS ,
        mileage: { increment: totalmileage },
      },
    });



    return res.status(200).json({
      message: "갸챠 결과",
      results,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "서버 오류" });
  }
});


function getRandomAgent(agents, weighting = null) {
  if (!weighting) {
    // 기본 균등 확률
    return agents[Math.floor(Math.random() * agents.length)];
  }
  const weights = agents.map(agent => weighting(agent.agentKey));//가중치 반환. [1/3, 2/45,...]
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0; // 이제 가중치를 모아서 어느수에 걸치는지 파악하기 위한 변수.
  for (let i = 0; i < agents.length; i++) {
    cumulative += weights[i]; //가중치를 모은다.
    if (random <= cumulative) {// 가중치가 랜덤에 걸렸을때.
      return agents[i];//그 가중치의 선수.
    }
  }

  return agents[agents.length - 1];//이건 만약 오류나면 그냥 마지막꺼 내놓음.


}

async function updateMyAgents(userKey, agentKey, name) {
  const existingAgent = await prisma.myAgents.findFirst({
    where: {
      userKey:+userKey,
      agentKey,
    },
  });

  if (existingAgent) {
    await prisma.myAgents.update({
      where: { myAgentKey: existingAgent.myAgentKey },
      data: {
        count: { increment: 1 },
      },
    });
  } else {
    await prisma.myAgents.create({
      data: {
        userKey:+userKey,
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
