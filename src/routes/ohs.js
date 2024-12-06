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

      // 현재 강화 확률 계산
      const successRate = getSuccessRate(currentLevel);
      const successRatePercentage = Math.round(successRate * 100); // 퍼센트로 변환

      // 강화 시도 (확률에 따라 성공 여부 결정)
      const success = Math.random() < successRate; // 성공 확률
      let nextLevel = currentLevel;
      let message = ""; // 메시지 초기화
      let warningMessage = "9강 이하에서는 강화레벨이 하락하지 않습니다!!"; // 경고 메시지 초기화

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

      // 보유 재료 확인
      const materials = await prisma.assets.findFirst({
        where: { userKey: user.userKey },
      });

      const requiredMaterials = getMaterials(currentLevel + 1); // 다음 레벨에 필요한 재료
      //       그 모든걸 저장      현재 강화 재료갯수  >=    강화에 필요한 강화 재료 갯수
      const hasEnoughEnhancer =
        materials.enhancer >= requiredMaterials.enhancer; // 강화재료 부족한지 아님 가능한지 확인해주는 함수

      // 강화 재료가 부족한 경우
      if (!hasEnoughEnhancer) {
        //마일리지 갯수 확인
        if (materials.mileage < 100 * requiredMaterials.enhancer) {
          return res.status(400).json({
            message:
              "강화 재료가 부족하고 마일리지도 부족해 강화진행을 못합니다!!",
          });
        } else {
          // 마일리지 사용 (레벨이 오름)
          // 마일리지는 강화재료의 * 100 개 사용
          await prisma.$transaction(async (prisma) => {
            await prisma.myAgents.update({
              where: {
                myAgentKey: player.myAgentKey,
              },
              data: { level: nextLevel },
            });
            await prisma.assets.update({
              where: { userKey: user.userKey },
              data: {
                mileage: { decrement: 100 * requiredMaterials.enhancer },
              },
            });
          });
        }
      } else {
        // 강화 재료가 충분할 경우 강화 재료 사용
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
      }

      // 강화 시도 완료 시 상태코드와 강화 결과 반환
      return res.status(201).json({
        message: message,
        warnig: warningMessage, // 떨어질수도 있단 경고 메시지 추가
        successRate: `${successRatePercentage}%`, // 퍼센트로 보이게 변경
        currentMaterials: materials.enhancer, // 현재 보유한 강화 재료 수량 표시
        currentMileage: materials.mileage - (hasEnoughEnhancer ? 0 : 100), // 현재 마일리지 표시
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  }
);
