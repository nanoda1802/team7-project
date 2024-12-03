// import express from "express";
// import { prisma } from "../utils/prisma/index.js";

// const router = express.Router();

// // 강화 라우터
// router.patch("/api/users/:key/agents/intensify");

// const { key } = req.params;
// const { agentkey } = req.body;

// // 로그인 상태인지 아닌지 확인
// if (!checkLogin(req)) {
//   return resizeBy.status(401).json({ message: "로그인 부터 해주세요!!" });
// }
// // 로그인 된 계정의 아이디가 아닌 경우 거절
// const loggedlnUser = getUserid(req);
// if (loggedlnUser !== userID) {
//   return resizeBy.status(403).json({ message: "당신 계정이 아녀요!!"});
// }

// try {
//   // 보유 선수 확인
//   const plater = await prisma.$queryRaw()
// }

// export default router;
