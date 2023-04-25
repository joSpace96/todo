const express = require("express"); // 서버열수 있음
const app = express();
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient; // DB연결
const methodOverride = require("method-override"); // HTML form태그에서 method PUT/DELETE가능

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(methodOverride("_method"));

app.use("/public", express.static("public"));

require("dotenv").config();

// mongodb 연결
var db;
MongoClient.connect(
  process.env.DB_URL,
  { useUnifiedTopology: true },
  (err, client) => {
    if (err) return console.log(err);
    db = client.db("todo");
    app.listen(process.env.PORT, () => {
      console.log("listening on 3000");
    });
  }
);

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/write", (req, res) => {
  res.render("write.ejs");
});

app.post("/add", (res, req) => {
  req.send("전송완료");
  // db에 있는 counter라는 컬렉션을 찾고 그 안에 있는 Posts를 찾고 Posts를 변수에 저장
  db.collection("counter").findOne({ name: "Posts" }, (err, result) => {
    console.log(result.totalPost);
    let totalPost = result.totalPost;
    // db에 있는 post라는 컬렉션에 id, title, date를 넣어줌
    db.collection("post").insertOne(
      {
        _id: totalPost + 1,
        title: res.body.title,
        date: res.body.date,
      },
      // 위에 코드가 완료가 되면 db에 있는 counter 안에 있는 Posts를 수정해줌
      (err, data) => {
        console.log("저장완료");
        db.collection("counter").updateOne(
          { name: "Posts" } /*수정할 데이터*/,
          { $inc: { totalPost: 1 } } /*$operator 필요 수정값*/,
          (err, result) => {
            if (err) {
              return console.log(err);
            }
          }
        );
      }
    );
  });
});

app.get("/list", (req, res) => {
  db.collection("post")
    .find()
    .toArray((err, result) => {
      console.log(result);
      res.render("list.ejs", { posts: result });
    });
});

// 삭제
app.delete("/delete", (req, res) => {
  // req.body는 _id
  console.log(req.body);
  req.body._id = parseInt(req.body._id);
  // req.body에 담겨온 게시물번호를 가진 글을  db에서 찾아서 삭제
  db.collection("post").deleteOne(req.body, (err, result) => {
    console.log("삭제완료");
    res.status(200).send({ message: "성공했습니다" });
  });
});

// : URL의 parameter
app.get("/detail/:id", (req, res) => {
  // req.params.id = 파라미터중 id값을 찾아서 가져옴

  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      if (result === null) {
        console.log("데이터가 없엉");
        res.send("데이터가 없음");
      } else {
        console.log(result);
        res.render("detail.ejs", { data: result });
      }
    }
  );
});

app.get("/edit/:id", (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      if (result === null) {
        console.log("데이터가 없엉");
        res.send("데이터가 없음");
      } else {
        console.log(result);
        res.render("edit.ejs", { post: result });
      }
    }
  );
});

// 수정
app.put("/edit", (req, res) => {
  // 폼에 담긴 제목, 날짜데이터를 가지고 db.collection 에다가 업데이트 함
  // db에 있는 post테이블에 업데이트 할껀데
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id) }, // 이거 찾아주세요
    { $set: { title: req.body.title, date: req.body.date } }, // 그걸 이렇게 바꿔주세요
    (err, result) => {
      console.log("수정완료"); // 다하면 실행시켜주세요
      res.redirect("/list");
    }
  );
});

// 로그인 구현 라이브러리 설치 npm install passport passport-local express-session
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");

// 미들웨어 (요청과 응답 사이에 실행되는 코드)
app.use(session({ secret: "secret", resave: true, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// 로그인하면 아이디비번 검사
app.post(
  "/login",
  // local 방식으로 회원인증
  passport.authenticate("local", {
    // 검사하는 passport 문법
    failureRedirect: "/fail", // 실패하면 여기로 이동
  }),
  (req, res) => {
    res.redirect("/"); // 성공하면 여기로 보내주세요
  }
);

// mypage로 누가 요청하면 areYouLogin미들웨어 실행 후 코드실행
app.get("/mypage", areYouLogin, (req, res) => {
  console.log(req.user); // 여기에 데이터 있음
  res.render("mypage.ejs", { 사용자: req.user });
});

// 미들웨어 생성
function areYouLogin(req, res, next) {
  // req.user(로그인 후 세션이 있으면 항상 있음)가 있으면 next() 통과
  if (req.user) {
    next();
  } else {
    res.send("로그인 안함");
  }
}

// 누가 /login으로 post 요청할 때만 실행
passport.use(
  new LocalStrategy(
    {
      // 로그인후 세션에 저장할 껀지
      usernameField: "id", // form에 입력한 id
      passwordField: "pw", // form에 입력한 pw
      session: true,
      passReqToCallback: false, // id, pw 말고도 다른정보 검증시 true
    },
    // 그러면 여기에 req.body. 넣어서 추가
    // 사용자 아이디와 비번 검증하는 부분
    (입력한아이디, 입력한비번, done) => {
      console.log(입력한아이디, 입력한비번);
      // loginDB에 있는 아이디와 맞는지 확인
      db.collection("login").findOne({ id: 입력한아이디 }, (err, result) => {
        // 에러면 에러
        // done(서버에러, 성공시사용자DB데이터, 에러메세지)
        if (err) return done(err);
        // 아무것도 없으면 이거 실행
        if (!result) return done(null, false, { message: "not found Id" });
        // DB에 아이디가 있으면 입력한 비번과 result.pw와 비교
        if (입력한비번 == result.pw) {
          return done(null, result);
        } else {
          return done(null, false, { message: "not found Pw" });
        }
      });
    }
  )
);

// 세션을 저장시키는 코드(로그인 성공시)
// 아이디/비번 검증 성공시 user = result
passport.serializeUser((user, done) => {
  done(null, user.id); // user.id에 세션을 저장
});

// 마이페이지 접속시 발동 디비에서 위에 있는 user.id로 유저를 찾은 뒤에 유저정보를 {요기에 넣음}
passport.deserializeUser((아이디, done) => {
  db.collection("login").findOne({ id: 아이디 }, (err, result) => {
    done(null, result);
  });
});
