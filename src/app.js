import express from "express";
import bodyParser from "body-parser";
import userRouter from "./routes/user-router.js";
import cashRechargeRouter from "./routes/cash-recharge-router.js";
import agentRouter from "./routes/agents-router.js";
import memberSetRouter from "./routes/member-set-router.js";
import matchRouter from "./routes/match-router.js";

/* express 생성 */
const app = express();
const PORT = 9999; // 미정!!!!

/* Parser */
app.use(express.json()); // 바디 파서
app.use(bodyParser.urlencoded({ extended: true }));

/* 라우터 경로 배정 */
app.use("/api", [userRouter, cashRechargeRouter, agentRouter, memberSetRouter, matchRouter]);

/* 서버 오픈 알리미 */
app.listen(PORT, () => {
  console.log(PORT, "포트로 서버 열림!");
});
