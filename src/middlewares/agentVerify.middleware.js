import { prisma } from "../utils/prisma/index.js";


const strVerification = async function (req, res, next) {
    try {
        const agentValues = req.body

        if (Array.isArray(agentValues?.formation)) {
            const agents = [];

            // 입력값 확인
            if (agentValues.formation.length <= 0) return res
                .status(400)
                .json({ errorMessage: "선택할 챔피언의 이름을 입력해주세요" })

            for (let name of agentValues.formation) {
                // 챔피언 존재 여부 확인
                const agent = await prisma.agents.findFirst({where: { name }})
                if (!agent) return res
                    .status(404)
                    .json({ errorMessage: `이름이 <${name}>인 챔피언은 존재하지 않습니다`})
                agents.push(agent)
            }

            // 챔프 값 반환
            req.agent = agents
        } else {
            // 입력값 확인
            if (!agentValues.agent) return res
                .status(400)
                .json({ errorMessage: "선택할 챔피언의 이름을 입력해주세요" })

            const agent = await prisma.agents.findFirst({ where: { name: agentValues.agent } })
            if (!agent) return res
                .status(404)
                .json({ errorMessage: `이름이 <${agentValues.agent}>인 챔피언은 존재하지 않습니다` })
            req.agent = agent
        }
        next();
        //오류들 반환
    } catch (err) {
        next(err)
    }
};

const intVerification = async function (req, res, next) {
    try {
        const agentValues = req.body
        // 입력값 할당
        const agentKey = +agentValues?.pickup || +agentValues?.agent

        // 입력값 확인
        if (!agentKey || !Number.isInteger(agentKey)) return res
            .status(400)
            .json({ errorMessage: "선택할 챔피언의 <agent_key>를 입력해주세요" })

        const agent = await prisma.agents.findFirst({ where: { agentKey } })
        if (!agent) return res
            .status(404)
            .json({ errorMessage: `<agent_key> ${agentKey}에 해당하는 챔피언은 존재하지 않습니다` })

        // 챔프 값 반환
        req.agent = agent

        next();
        //오류들 반환
    } catch (err) {
        next(err)
    }
}

export { strVerification , intVerification }
