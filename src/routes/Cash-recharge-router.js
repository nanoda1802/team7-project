import express from "express";
import router from "./sample-router";
const prisma = require("@prisma/client");

// 캐쉬 구입
router.patch("/users/:key/cash", async (req, res, next) => {
  const { asset_key } = req.body;
  const loggedlnUser = req.user;

  if (!loggedlnUser) {
    return res.status(401).json({ message: "로그인부터 해주세요" });
  }

  if (loggedlnUser.userKey !== asset_key) {
    return res.status(401).json({ message: "당신 계정이 아닙니다." });
  }
  try {
    await prisma.assets.update({
      where: { userKey: user.userKey },
      data: {
        cash: { increment: 100000 },
        mileage: { increment: 100 },
      },
    });
    return res.status(200).json({ message: "캐시 충전 완료!!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다" });
  }
});
// 보유 재화 조회
// router.get("/users/:key/assets" , aysnc(req, res, naxt) => {

// })
// const currentCash = await prisma.assets.findFirst({
//   where: { userKey: user.userKey },
//   select: {
//     cash: true,
//   },
// });
// const currentMileage = await prisma.assets.findFirst({
//   where: { userKey: user.userKey },
//   select: {
//     mileage: true,
//   },
// });
// const currentEnhancer = await prisma.assets.findFirst({
//   where: { userKey: user.userKey },
//   select: {
//     enhancer: true,
//   },
// });

export default router;
