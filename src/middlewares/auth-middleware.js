import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma/index.js';
import dotenv from 'dotenv';

// 환경 변수 설정
dotenv.config();

// 인증 미들웨어
const authMiddleware = async (req, res, next) => {
  try {
    const {key} = req.params;

    // 요청 Authorization 값 확인
    const { authorization } = req.headers;
    // "Bearer" 이후의 토큰 부분만 추출
    const [tokenType, token] = authorization.split(' ');

    // token이 비어있거나(없는 경우) tokenType이 Bearer가 아닌경우
    if (!token || tokenType !== 'Bearer') return res
      .status(401)
      .json({ errorMessage: '로그인부터 해주세요' });
    // 토큰 검증
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    // params로 받은 user 확인
    const urlUser = await prisma.users.findUnique({ where: { userKey: +key } });    
    //JWT 토큰에서 가져온 사용자 정보를 이용해서 데이터베이스에서 해당 사용자가 실제로 존재하는지 확인하는 작업
    const loginUser = await prisma.users.findUnique({ where: { userKey: decoded.userKey } });
    // 사용자 정보가 데이터베이스에 없는 경우

    if (!urlUser || !loginUser) return res
      .status(401)
      .json({ errorMessage: "해당하는 계정이 존재하지 않습니다" });

    // 계정 주인 확인
    if (urlUser.userKey !== loginUser.userKey) return res
      .status(401)
      .json({ errorMessage: "당신의 계정이 아닙니다." });

    // 사용자 정보를 req 객체에 추가
    req.user = loginUser;
    // 다음 미들웨어로 이동
    next();
  } catch (error) {
    console.error('JWT 검증 실패:', error.message);

    // 에러 종류에 따른 적절한 메시지 반환
    const isTokenExpired = error.name === 'TokenExpiredError'; // 토큰 만료 여부 확인
    const errorMessage = isTokenExpired
      ? '토큰이 만료되었습니다. 다시 로그인해주세요.' // 토큰 만료 메시지
      : '토큰 검증 실패'; // 일반 검증 실패 메시지

    // 검증 실패 응답
    return res
      .status(401)
      .json({ message: errorMessage, error: error.message });
  }
};

export default authMiddleware;
