import express from 'express';
import {prisma} from '../utils/prisma/index.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

//환경 변수 파일(.env)을 로드
dotenv.config();

// Express 라우터를 초기화합니다.
const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || 'custom_secret_key'; //.env에서 비밀 키 가져오기

// 사용자 회원가입
// 이메일 중복 체크
// 비밀번호 암호화 (bcrypt 사용)
// 비번확인은 유효성 검사용, 저장하지않음

// ** 입력값 검증 **
const validateSignUpInput = (id, pw, pwCheck) => {
    // 이메일 형식을 검증하는 정규식
    const idRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     // ^와 $: 문자열의 시작과 끝을 명시.
    // [^\s@]+: 공백(\s)과 @를 제외한 하나 이상의 문자.
    // @와 \.: 이메일 형식에서 반드시 필요한 기호.
    // username@domain.com 형식의 기본 이메일 구조를 검증.
    //공백, @ 중복 등을 방지.
    const pwRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z\d!@#$%^&*]{6,}$/;
    // 비밀번호가 영어 소문자, 숫자, 특수기호를 포함하고 6자 이상인지 확인하는 정규식

    // 아이디(이메일) 형식 유효성 검증
    if (!id || !idRegex.test(id)) {
      return { errorField: 'id', errorMessage: '아이디는 이메일 형태로 입력해주세요' };
    }
  
    // 비밀번호 유효성 검증
    if (!pw || !pwRegex.test(pw)) {
      return {
        errorField: 'pw',
        errorMessage: '비밀번호는 영어 소문자, 숫자, 특수기호 하나 이상 혼합하여 6자 이상으로 작성해주세요',
      };
    }
  
    // 비밀번호 확인 입력 여부 검증
    if (!pwCheck) {
      return { errorField: 'pwCheck', errorMessage: '비밀번호 확인용<pwCheck>를 입력해주세요' };
    }
  
    // 비밀번호와 비밀번호 확인 값 일치 여부 검증
    if (pw !== pwCheck) {
      return { errorField: 'pwCheck', errorMessage: '비밀번호가 일치하지 않습니다' };
    }
  
    return null; // 모든 검증을 통과한 경우 null 반환.
  };
  
  // ** 회원가입 API **
  router.post('/sign-up', async (req, res) => {
    const { id, pw, pwCheck, nickname } = req.body; // 요청 본문에서 입력 데이터를 추출합니다.
  
    // 입력값 검증
    const validationError = validateSignUpInput(id, pw, pwCheck);
    if (validationError) {
      // 검증 실패 시 400 상태 코드와 에러 메시지를 반환.
      return res.status(400).json({ errorMessage: validationError.errorMessage });
    }
  
    try {
      // 이미 동일한 아이디가 존재하는지 데이터베이스에서 확인.
      const isExistUser = await prisma.users.findFirst({ where: { id } });
  
      if (isExistUser) {
        // 중복된 아이디가 있으면 409 상태 코드와 에러 메시지를 반환.
        return res.status(409).json({ errorMessage: '이미 존재하는 아이디입니다' });
      }
  
      // 비밀번호를 암호화(bcrypt 사용)하여 저장.
      const hashedPassword = await bcrypt.hash(pw, 10);
  
      // ** Prisma 트랜잭션을 사용해 Users, Assets, Ranks 테이블에 데이터 생성 **
    const result = await prisma.$transaction(async (tx) => {
      // Users 테이블에 사용자 정보 생성
      const user = await tx.users.create({
        data: {
          id, // 이메일
          pw: hashedPassword, // 암호화된 비밀번호
          nickname, // 닉네임
        },
      });

      // Assets 테이블에 사용자와 연관된 자산 데이터 생성
      await tx.assets.create({
        data: {
          userKey: user.userKey, // Users 테이블의 userKey를 참조
        },
      });

      // Ranks 테이블에 사용자와 연관된 랭크 데이터 생성
      await tx.ranks.create({
        data: {
          userKey: user.userKey, // Users 테이블의 userKey를 참조
        },
      });

      return user; // 트랜잭션에서 생성된 사용자 데이터 반환
    });

    // 성공 시 사용자 정보를 포함하여 응답 반환
    res.status(201).json({
      message: '회원가입이 완료되었습니다',
      id: result.id, // 생성된 사용자의 이메일 ID
      nickname: result.nickname, // 생성된 사용자의 닉네임
      key: result.userKey, // 생성된 사용자의 고유 키(userKey)
    });
  } catch (error) {
    console.error(error); // 에러를 콘솔에 출력
    res.status(500).json({ errorMessage: '서버 에러' }); // 서버 에러 메시지 반환
  }
});

// ** 로그인 API **
// 사용자의 로그인 요청을 처리합니다.
router.post('/sign-in', async (req, res) => {
  const { id, pw } = req.body; // 요청 본문에서 아이디와 비밀번호를 추출

  try {
    // 데이터베이스에서 아이디를 기준으로 사용자 조회
    const user = await prisma.users.findFirst({ where: { id } });

    if (!user) {
      // 사용자가 존재하지 않을 경우 404 상태 코드와 에러 메시지 반환
      return res.status(404).json({ errorMessage: '존재하지 않는 아이디입니다' });
    }

    // 입력된 비밀번호와 데이터베이스의 암호화된 비밀번호를 비교
    const isPasswordValid = await bcrypt.compare(pw, user.pw);

    if (!isPasswordValid) {
      // 비밀번호가 일치하지 않으면 401 상태 코드와 에러 메시지 반환
      return res.status(401).json({ errorMessage: '비밀번호가 일치하지 않습니다' });
    }

    // 비밀번호가 일치하면 JWT 생성
    const token = jwt.sign(
      {
        userKey: user.userKey, // JWT 페이로드에 사용자 키 포함
        id: user.id, // JWT 페이로드에 이메일 포함
        nickname: user.nickname, // JWT 페이로드에 닉네임 포함
      },
      SECRET_KEY, // 비밀 키를 사용하여 서명 // 수정???
      { expiresIn: '1h' } // 토큰 유효 기간을 1시간으로 설정
    );

    // 성공 시 헤더에 Authorization 토큰 추가
    res.setHeader('Authorization', `Bearer ${token}`);

    // 로그인 성공 메시지와 사용자 키 반환
    res.status(200).json({
      message: '로그인 되었습니다',
      key: user.userKey, // 로그인된 사용자의 고유 키
    });
  } catch (error) {
    console.error(error); // 에러를 콘솔에 출력
    res.status(500).json({ errorMessage: '서버 에러' }); // 서버 에러 메시지 반환
  }
});
  
  export default router;