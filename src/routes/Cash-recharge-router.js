import express from "express";
import { prisma } from "../utils/prisma/index.js";

const router = express.Router();

// 캐쉬 구입
// 라우터. 수정 ("/ 경로 매개 변수"), 비동기 함수(req, res, next)
router.patch("/users/:key/cash", async (req, res, next) => {
  // 변수 선언
  const { key } = req.params;
  const loggedlnUser = req.user;

  if (!loggedlnUser) {
    return res.status(401).json({ message: "로그인부터 해주세요" });
  }

  if (loggedlnUser.userKey !== +key) {
    return res.status(401).json({ message: "당신 계정이 아닙니다." });
  }
  try {
    await prisma.assets.update({
      where: { userKey: +key },
      data: {
        cash: { increment: 100000 },
        mileage: { increment: 100 },
      },
    });
    return res.status(200).json({ message: `100000만큼 충전되었습니다.` });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다" });
  }
});
// 충전량
// 보유 재화 조회
router.get("/users/:key/assets", async (req, res, naxt) => {
  const { key } = req.params; // 매개변수에서 key 추출

  try {
    const currentCash = await prisma.assets.findFirst({
      where: { userKey: +key }, // key를 숫자로 변환
      select: {
        cash: true,
      },
    });
    const currentMileage = await prisma.assets.findFirst({
      where: { userKey: +key },
      select: {
        mileage: true,
      },
    });
    const currentEnhancer = await prisma.assets.findFirst({
      where: { userKey: +key },
      select: {
        enhancer: true,
      },
    });

    const data = {
      cash: currentCash?.cash || 0,
      mileage: currentMileage?.mileage || 0,
      enhancer: currentEnhancer?.enhancer || 0,
    };

    return res
      .status(200)
      .json({ message: "데이터 추출에 성공하셨습니다!", data });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "캐시 조회 중 오류가 발생했습니다." });
  }
});
export default router;
