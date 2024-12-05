import { prisma } from "../utils/prisma/index.js";

// 챔피언 유효성 평가 미들웨어
const champVerification = async function (req, res, next) {
    try {
        const agentValues = req.body

        //배열 판정
        if (Array.isArray(agentValues?.formation) || Array.isArray(agentValues) ) {
            const agents = [];
            if (agentValues?.formation) {
                for (let agentKey of agentValues.formation) {
                    if (isNaN(+agentKey)) return res
                        .status(400)
                        .json({ errorMessage: "선택할 챔피언의 <agent_key>를 숫자로 입력해주세요" })
                        console.log("0");
                    // 챔피언 존재 여부 확인
                    const agent = await prisma.agents.findFirst({ where: { agentKey: +agentKey } })
                    if (!agent) return res
                        .status(404)
                        .json({ errorMessage: `<agent_key> ${agentKey}에 해당하는 챔피언은 존재하지 않습니다` })
                    agents.push(agent)
                }
            // 일반 배열
            } else {
                for (let { agent } of agentValues) {
                    if (isNaN(+agent)) return res
                        .status(400)
                        .json({ errorMessage: "선택할 챔피언의 <agent_key>를 숫자로 입력해주세요" })

                    // 챔피언 존재 여부 확인
                    const agentVerify = await prisma.agents.findFirst({ where: { agentKey: +agent } })
                    if (!agentVerify) return res
                        .status(404)
                        .json({ errorMessage: `<agent_key> ${agentKey}에 해당하는 챔피언은 존재하지 않습니다` })
                    agents.push(agentVerify)
                }
            }
            // 챔프 값 반환
            req.agent = agents;
        } else {
            const agentKey = +agentValues?.pickup || +agentValues?.agent
            // 입력값 확인
            if (!agentKey || isNaN(+agentKey)) return res
                .status(400)
                .json({ errorMessage: "선택할 챔피언의 <agent_key>를 숫자로 입력해주세요" })

            const agent = await prisma.agents.findFirst({ where: { agentKey } })
            if (!agent) return res
                .status(404)
                .json({ errorMessage: `<agent_key> ${agentKey}에 해당하는 챔피언은 존재하지 않습니다` })
            // 챔프 값 반환
            req.agent = agent;
        }
        console.log("req.agent:"+req.agent);
        next();
        //오류들 반환
    } catch (err) {
        next(err)
    }
};

export default champVerification