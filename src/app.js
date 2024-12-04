import express from "express";
import bodyParser from "body-parser";
import agentsRouter from "./routes/agents-router.js";
import matchRouter from "./routes/match-router.js";
import userRouter from "./routes/user-router.js";
import path from "path";
import cors from 'cors';

/* express 생성 */
const app = express();
const PORT = 9999; // 미정!!!!


const publicPath = path.join(process.cwd(), 'assets');
app.use(express.static(publicPath));

/* Parser */
app.use(cors({
  origin: 'http://127.0.0.1:5500', // 정확한 도메인
  credentials: true, // 인증 정보 허용
  allowedHeaders: ['Content-Type', 'Authorization'], // 허용할 헤더 설정
  exposedHeaders: ['Authorization'], // 클라이언트가 Authorization 헤더를 접근할 수 있도록 설정
}));
app.use(express.json()); // 바디 파서
app.use(bodyParser.urlencoded({ extended: true }));

/* 라우터 경로 배정 */
app.use("/api", [agentsRouter, matchRouter, userRouter]);

/* 서버 오픈 알리미 */
app.listen(PORT, () => {
  console.log(PORT, "포트로 서버 열림!");
});
