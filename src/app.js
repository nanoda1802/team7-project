import express from "express";
import bodyParser from "body-parser";
import agentsRouter from "./routes/agents-router.js";
import cashRechargeRouter from "./routes/cash-recharge-router.js";
import matchRouter from "./routes/match-router.js";
import memberSetRouter from "./routes/member-set-router.js";
import userRouter from "./routes/user-router.js";

/* express 생성 */
const app = express();
const PORT = 9999; // 미정!!!!


const publicPath = path.join(process.cwd(), 'assets');
app.use(express.static(publicPath));

/* Parser */
app.use(cors());
app.use(express.json()); // 바디 파서
app.use(bodyParser.urlencoded({ extended: true }));

/* 라우터 경로 배정 */
app.use("/api", [agentsRouter, cashRechargeRouter, matchRouter, memberSetRouter, userRouter]);

/* 서버 오픈 알리미 */
app.listen(PORT, () => {
  console.log(PORT, "포트로 서버 열림!");
});
