import express from "express";
import bodyParser from "body-parser";
import Agentsrouter from "./routes/agents.router.js";
import cookieParser from "cookie-parser";
import agentRouter from "./routes/agents.router.js";
import memberSetRouter from "./routes/memberSet.router.js";

/* express 생성 */
const app = express();
const PORT = 3012; // 미정!!!!

/* Parser */
app.use(express.json()); // 바디 파서
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); // 쿠키 파서

/* 라우터 경로 배정 */
app.use("/api", [Agentsrouter]);

/* 서버 오픈 알리미 */
app.listen(PORT, () => {
  console.log(PORT, "포트로 서버 열림!");
});
