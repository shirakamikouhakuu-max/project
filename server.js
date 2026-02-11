const express = require("express");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const { Server } = require("socket.io");

/* ================== HOST KEY ================== */
const HOST_KEY = process.env.HOST_KEY || "CHANGE_ME_HOST_KEY";
const HOST_COOKIE_NAME = "host_auth";

function hostSig() {
  return crypto.createHmac("sha256", HOST_KEY).update("host-ok").digest("hex");
}

function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

function hasHostCookie(req) {
  const c = parseCookies(req.headers.cookie || "");
  return c[HOST_COOKIE_NAME] === hostSig();
}

function setHostCookie(req, res) {
  const isHttps =
    req.secure ||
    (req.headers["x-forwarded-proto"] || "").toString().includes("https");

  const parts = [
    `${HOST_COOKIE_NAME}=${encodeURIComponent(hostSig())}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000"
  ];
  if (isHttps) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearHostCookie(req, res) {
  const isHttps =
    req.secure ||
    (req.headers["x-forwarded-proto"] || "").toString().includes("https");

  const parts = [
    `${HOST_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (isHttps) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function requireHost(req, res, next) {
  if (hasHostCookie(req)) return next();
  return res.redirect("/host-login");
}

/* ================== QUIZ CONFIG ================== */
const PRE_DELAY_MS = 500;
const POPUP_SHOW_MS = 7000;
const MAX_POINTS = 1000;

/* ================== QUIZ (20 câu khó hơn) ================== */
const QUIZ = {
  title: "AI NHANH NHẤT",
  questions: [
    { text: "Công ty Cổ phần Multitech được thành lập vào ngày nào?", choices: ["31/01/2010", " 31/03/2010", " 31/05/2010", "31/7/2010"], correctIndex: 1, timeLimitSec: 22 },
    { text: "Tổng các chữ số trong mã số thuế của Công ty là bao nhiêu?", choices: ["40", "41", "42", "43"], correctIndex: 0, timeLimitSec: 22 },
    { text: "Tháng 9 là sinh nhật của lãnh đạo nào trong Công ty?", choices: ["Chủ Tịch Phú", "Giám Đốc Cường", "Không ai cả", "Cả hai"], correctIndex: 3, timeLimitSec: 22 },
    { text: "Công ty CP Multitech hiện có bao nhiêu thành viên chính thức?", choices: ["12", "13", "14", "15"], correctIndex: 2, timeLimitSec: 22 },
    { text: "Slogan Công ty là gì?", choices: ["Giỏi Công nghệ, Mạnh triển khai", "Đổi mới – Làm chủ công nghệ", "Tinh nhuệ – Chuyên sâu", "Chính trực – Kỷ luật"], correctIndex: 0, timeLimitSec: 22 },
    { text: "Công ty mình có bao nhiêu người độc toàn thân ( độc thân)?", choices: ["4", "5", "6", "7"], correctIndex: 1, timeLimitSec: 22 },
    { text: "Người lớn tuổi nhất của công ty sinh năm bao nhiêu?", choices: ["1978", "1979", "1980", "1981"], correctIndex: 2, timeLimitSec: 22 },
    { text: "NV trẻ nhất công ty sinh năm bao nhiêu?", choices: ["2000", "2001", "2002", "2003"], correctIndex: 3, timeLimitSec: 22 },
    { text: "Logo công ty có màu gì?", choices: ["cam + đen", "cam + tím", "đỏ + cam", "cam + xanh"], correctIndex: 3, timeLimitSec: 22 },
    { text: "Ai là người đến công ty sớm nhất thường xuyên nhất?", choices: ["Chiến", "Giang Bùi", " Bắc", "Thái"], correctIndex: 0, timeLimitSec: 22 },
    { text: "Sự kiện nội bộ đầu tiên trong năm 2026 là gì? ", choices: ["Tất niên", "Khai xuân", "Phát động kế hoạch kinh doanh", "Nhậu kết đoàn"], correctIndex: 3, timeLimitSec: 22 },
    { text: "Nếu công ty đi nhậu, ai là người tửu  lượng tốt nhất?", choices: ["Nam", "Chiến", "Bắc", "Tuấn"], correctIndex: 2, timeLimitSec: 22 },
    { text: "Nhân viên Mulnitech đi làm bằng bao nhiêu loại phương tiện giao thông?", choices: ["2", "3", "4", "5"], correctIndex: 2, timeLimitSec: 22 },
    { text: "Hải sản nào ko có trên bàn tiệc của bạn hôm nay?", choices: ["Tôm", "Mực", "Cá", "Rong biển "], correctIndex: 1, timeLimitSec: 22 },
    { text: "Trong bữa tiệc công ty bạn hnay có bao nhiêu người ko mặc quần dài?", choices: ["2", "4", "3", "5"], correctIndex: 2, timeLimitSec: 22 },
    { text: "Tốc độ ánh sáng trong chân không xấp xỉ?", choices: ["3×10⁶ m/s", "3×10⁸ m/s", "3×10¹⁰ m/s", "3×10⁴ m/s"], correctIndex: 1, timeLimitSec: 22 },
    { text: "CPI là viết tắt của chỉ số nào?", choices: ["Consumer Price Index", "Capital Profit Index", "Consumer Product Income", "Core Payment Indicator"], correctIndex: 0, timeLimitSec: 22 },
    { text: "Thủ đô của Australia là thành phố nào?", choices: ["Sydney", "Melbourne", "Canberra", "Perth"], correctIndex: 2, timeLimitSec: 22 },
    { text: "Năm 2026 là năm mệnh gì", choices: ["Thủy", "Thổ","Kim", "Hỏa"], correctIndex: 3, timeLimitSec: 22 }
  ]
};

function computePoints({ correct, elapsedMs, limitSec }) {
  if (!correct) return 0;
  const limitMs = limitSec * 1000;
  const t = Math.max(0, Math.min(1, elapsedMs / limitMs));
  const pts = Math.round(MAX_POINTS * (1 - t));
  return Math.max(1, pts);
}

/* ================== APP ================== */
const app = express();
app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: false }));

app.use("/audio", express.static(path.join(__dirname, "public", "audio"), { maxAge: "7d" }));
app.use("/video", express.static(path.join(__dirname, "public", "video"), { maxAge: "7d" }));
app.use("/img", express.static(path.join(__dirname, "public", "img"), { maxAge: "7d" }));

const server = http.createServer(app);
const io = new Server(server);

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/* ================== RANDOM HELPERS ================== */
function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makeShuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  return shuffleInPlace(arr);
}

/* ================== ROOMS ================== */
const rooms = new Map();

function getRoomQuestion(room) {
  const total = room.qOrder ? room.qOrder.length : QUIZ.questions.length;
  const baseIdx = room.qOrder ? room.qOrder[room.qIndex] : room.qIndex;
  const q = QUIZ.questions[baseIdx] || QUIZ.questions[0];
  return { baseIdx, q, total };
}

function ensureChoiceMeta(room) {
  let meta = room.choiceMeta.get(room.qIndex);
  if (meta) return meta;

  const { q } = getRoomQuestion(room);
  const order = shuffleInPlace(Array.from({ length: q.choices.length }, (_, i) => i));
  const correctShuffledIndex = order.indexOf(q.correctIndex);

  meta = {
    order,
    correctShuffledIndex,
    counts: new Array(order.length).fill(0)
  };
  room.choiceMeta.set(room.qIndex, meta);
  return meta;
}

function publicState(room) {
  return {
    code: room.code,
    started: room.started,
    ended: room.ended,
    qIndex: room.qIndex,
    total: room.qOrder ? room.qOrder.length : QUIZ.questions.length
  };
}

function safeQuestionPayload(room) {
  const { q } = getRoomQuestion(room);
  const meta = ensureChoiceMeta(room);
  const shuffledChoices = meta.order.map((i) => q.choices[i]);

  return {
    qIndex: room.qIndex,
    total: room.qOrder ? room.qOrder.length : QUIZ.questions.length,
    text: q.text,
    choices: shuffledChoices,
    timeLimitSec: q.timeLimitSec,
    startedAtMs: room.qStartAtMs,
    serverNowMs: Date.now(),
    preDelayMs: PRE_DELAY_MS
  };
}

function getTotalLeaderboard(room) {
  const list = [];
  for (const [sid, p] of room.players.entries()) {
    list.push({ socketId: sid, name: p.name, score: p.score });
  }
  list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return list;
}

function getFastCorrectTop5(room) {
  const arr = [];
  for (const p of room.players.values()) {
    const a = p.lastAnswer;
    if (a && a.qIndex === room.qIndex && a.correct) {
      arr.push({ name: p.name, elapsedMs: a.elapsedMs, points: a.points });
    }
  }
  arr.sort((x, y) => x.elapsedMs - y.elapsedMs || y.points - x.points || x.name.localeCompare(y.name));
  return arr.slice(0, 5);
}

function broadcast(room) {
  io.to(room.code).emit("room:state", publicState(room));
}

function startQuestion(room) {
  if (room.timer) clearTimeout(room.timer);

  room.questionEndedFor = null;
  room.answerRevealedFor = null;

  room.qStartAtMs = Date.now() + PRE_DELAY_MS;

  for (const p of room.players.values()) p.lastAnswer = null;

  ensureChoiceMeta(room);

  io.to(room.code).emit("question:start", safeQuestionPayload(room));

  const { q } = getRoomQuestion(room);
  room.timer = setTimeout(() => endQuestion(room), PRE_DELAY_MS + q.timeLimitSec * 1000);

  broadcast(room);
}

function endQuestion(room) {
  if (room.ended) return;
  if (room.questionEndedFor === room.qIndex) return;

  room.questionEndedFor = room.qIndex;

  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  const { q } = getRoomQuestion(room);
  const meta = ensureChoiceMeta(room);

  const shuffledChoices = meta.order.map((i) => q.choices[i]);
  const answeredCount = meta.counts.reduce((a, b) => a + b, 0);

  const totalTop15 = getTotalLeaderboard(room).slice(0, 15);

  // ✅ KHÔNG gửi correctIndex ở đây (chưa công bố)
  io.to(room.code).emit("question:end", {
    qIndex: room.qIndex,
    choices: shuffledChoices,
    counts: meta.counts,
    answeredCount,
    totalPlayers: room.players.size,
    totalTop15
  });

  broadcast(room);
}

function endGame(room) {
  room.ended = true;
  if (room.timer) clearTimeout(room.timer);

  const total = getTotalLeaderboard(room);
  io.to(room.code).emit("game:end", {
    totalTop15: total.slice(0, 15),
    totalPlayers: total.length
  });

  broadcast(room);
}

/* ================== LAYOUT ================== */
function layout(title, bodyHtml) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${title}</title>

<script>
(function(){
  function setVH(){
    document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
  }
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', setVH);
})();
</script>

<script>
(function(){
  try{
    var KEY = 'intro_seen_session_v4';
    if (sessionStorage.getItem(KEY) === '1') {
      document.documentElement.classList.add('intro-seen');
    }
  }catch(e){}
})();
</script>

<style>
:root{
  --bg:#050814;
  --text:#f4f6ff;
  --muted:rgba(244,246,255,.75);
  --line:rgba(255,255,255,.18);
  --card:rgba(10,14,28,.62);
  --card2:rgba(10,14,28,.42);
  --btn:rgba(70,85,170,.55);
  --btn2:rgba(70,85,170,.70);
  --good:#37d67a;--bad:#ff5a5f;
}
*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
html,body{height:100%}
body{
  margin:0;color:var(--text);
  background:
    radial-gradient(1200px 800px at 20% 10%, rgba(40,60,140,.28), rgba(0,0,0,.72) 55%),
    linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.75)),
    var(--bg);
  overflow-x:hidden;
}

/* ✅ Background ảnh dùng cho Host + Play */
.app-bg{
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  background:#050814;
}
.app-bg::before{
  content:"";
  position:absolute; inset:0;
  background-image:url("/img/tet-doan-vien.png");
  background-size:cover;
  background-position:center;
  background-repeat:no-repeat;
  transform:scale(1.08);
  filter:blur(22px) brightness(0.95) saturate(1.15);
  opacity:0.35;
}
.app-bg::after{
  content:"";
  position:absolute; inset:0;
  background-image:url("/img/tet-doan-vien.png");
  background-size:contain;
  background-position:center;
  background-repeat:no-repeat;
  filter:drop-shadow(0 18px 50px rgba(0,0,0,.55));
  opacity:1;
}

.container{
  max-width:980px;
  margin:0 auto;
  padding:clamp(12px, 2.2vw, 24px);
  padding-top:calc(clamp(12px, 2.2vw, 24px) + env(safe-area-inset-top));
  padding-bottom:calc(clamp(12px, 2.2vw, 24px) + env(safe-area-inset-bottom));
  visibility:hidden;
  position:relative;
  z-index:1;
}

.header{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
h1{margin:0;font-size:clamp(18px,4.6vw,22px);line-height:1.2;text-shadow:0 2px 14px rgba(0,0,0,.45)}
h2{text-shadow:0 2px 14px rgba(0,0,0,.45)}
.small{font-size:clamp(12px,3.2vw,13px);color:var(--muted)}
label{font-size:clamp(12px,3.2vw,13px);color:var(--muted)}

.card{
  background:linear-gradient(180deg, var(--card), var(--card2));
  border:1px solid var(--line);
  border-radius:16px;
  padding:clamp(12px,2.2vw,16px);
  box-shadow:0 10px 40px rgba(0,0,0,.35);
  backdrop-filter: blur(6px);
}

.grid{display:grid;grid-template-columns:1fr;gap:14px;margin-top:14px}
@media(min-width:860px){.grid{grid-template-columns:1fr 1fr}}

.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
input{
  width:100%;padding:10px 12px;border-radius:12px;
  border:1px solid var(--line);
  background:rgba(0,0,0,.28);
  color:var(--text);outline:none
}

.btn{
  padding:10px 14px;border-radius:12px;
  border:1px solid var(--line);
  background:var(--btn);color:var(--text);
  cursor:pointer;font-weight:800
}
.btn:hover{background:var(--btn2)}
.btn:disabled{opacity:.55;cursor:not-allowed}

.pill{
  display:inline-flex;align-items:center;gap:8px;
  padding:7px 10px;border-radius:999px;
  border:1px solid var(--line);
  background:rgba(0,0,0,.22);
  color:var(--muted);font-size:12px
}
.dot{width:8px;height:8px;border-radius:999px;background:var(--muted);display:inline-block}
.dot.good{background:var(--good)} .dot.bad{background:var(--bad)}
.bigcode{font-size:clamp(22px,7vw,32px);letter-spacing:3px;font-weight:900;word-break:break-word}

hr{border:0;border-top:1px solid var(--line);margin:14px 0}

.choices{display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px}
@media(min-width:720px){.choices{grid-template-columns:1fr 1fr}}

.choice{
  display:flex;align-items:center;gap:12px;
  padding:14px 14px;border-radius:14px;
  border:1px solid rgba(255,255,255,.32);
  background:#1b263b;color:#fff;
  cursor:pointer;text-align:left;
  transition:filter .15s ease, transform .05s ease;
}
.choice:hover{filter:brightness(1.08)}
.choice:active{transform:translateY(1px)}
.choice[disabled]{opacity:.78;cursor:not-allowed;filter:none;}
.choice .opt{
  width:34px;height:34px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-weight:900;
  background:rgba(255,255,255,.95);
  color:#0b1020;
  border:1px solid rgba(0,0,0,.18);
  flex:0 0 auto
}
.choice .txt{flex:1;font-weight:800;line-height:1.25;color:#fff}

.badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:12px;border:1px solid var(--line);background:rgba(0,0,0,.18);color:var(--muted)}
.good{color:var(--good)} .bad{color:var(--bad)}

.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:12px}
table{width:100%;border-collapse:collapse;margin-top:10px;min-width:420px}
th,td{padding:8px;border-bottom:1px solid var(--line);text-align:left;font-size:14px}
th{color:var(--muted);font-weight:900}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;padding:16px;z-index:9999}
.modal{max-width:820px;width:100%}

/* ================== KAHOOT-LIKE BAR CHART ================== */
.chartWrapV2{
  margin-top:12px;
  padding:12px;
  border-radius:16px;
  border:1px solid var(--line);
  background:rgba(0,0,0,.18);
}

.chartV2{
  display:grid;
  grid-template-columns: 48px 1fr;
  gap:10px;
  align-items:stretch;
}

.yAxis{
  position:relative;
  height:280px;
}
.yTick{
  position:absolute;
  left:0;
  width:100%;
  text-align:right;
  padding-right:6px;
  color:rgba(244,246,255,.78);
  font-size:12px;
  font-weight:900;
  transform:translateY(50%);
  text-shadow:0 2px 14px rgba(0,0,0,.35);
}

.plot{
  position:relative;
  height:280px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.18);
  background:
    linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,0)),
    rgba(0,0,0,.18);
  overflow-x:auto;
  overflow-y:hidden;
}
.gridLine{
  position:absolute;
  left:0; right:0;
  height:1px;
  background:rgba(255,255,255,.12);
}
.gridLine.bold{
  background:rgba(255,255,255,.18);
}
.xBase{
  position:absolute;
  left:0; right:0;
  bottom:44px;
  height:2px;
  background:rgba(255,255,255,.20);
}

.barsRow{
  position:absolute;
  left:0; right:0;
  bottom:0;
  height:100%;
  display:flex;
  align-items:flex-end;
  gap:12px;
  padding:12px 12px 12px 12px;
  min-width:520px; /* mobile scroll vẫn đẹp */
}

.barCol{
  flex:1;
  min-width:140px;
  max-width:220px;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  gap:8px;
  position:relative;
}

.barStack{
  height:220px;
  display:flex;
  align-items:flex-end;
  position:relative;
  border-radius:16px;
  overflow:hidden;
  background:rgba(0,0,0,.18);
  border:1px solid rgba(255,255,255,.14);
}

.barFill{
  width:100%;
  height:0%;
  border-radius:16px 16px 12px 12px;
  box-shadow:0 16px 40px rgba(0,0,0,.35);
}

.barTopBadge{
  position:absolute;
  left:10px; top:10px;
  font-size:12px;
  font-weight:1000;
  color:#fff;
  background:rgba(0,0,0,.36);
  border:1px solid rgba(255,255,255,.18);
  padding:5px 10px;
  border-radius:999px;
  backdrop-filter: blur(4px);
}

.barCheck{
  position:absolute;
  right:10px; top:10px;
  width:30px;height:30px;
  border-radius:999px;
  display:flex;align-items:center;justify-content:center;
  font-weight:1000;
  background:rgba(55,214,122,.95);
  color:#04140a;
  box-shadow:0 16px 36px rgba(55,214,122,.22);
  opacity:0;
  transform:scale(.92);
  transition:opacity .2s ease, transform .2s ease;
}

.barXLabel{
  height:44px;
  display:flex;
  gap:8px;
  align-items:flex-start;
  padding:0 4px 0 4px;
}
.barLetter{
  width:28px; height:28px;
  border-radius:10px;
  background:rgba(255,255,255,.92);
  color:#0b1020;
  display:flex;align-items:center;justify-content:center;
  font-weight:1000;
  border:1px solid rgba(0,0,0,.18);
  flex:0 0 auto;
}
.barText{
  color:rgba(244,246,255,.82);
  font-size:12px;
  font-weight:900;
  line-height:1.2;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

@keyframes correctGlow {
  0%{ box-shadow:0 0 0 0 rgba(55,214,122,.0), 0 0 0 0 rgba(55,214,122,.0); }
  50%{ box-shadow:0 0 0 3px rgba(55,214,122,.18), 0 0 24px rgba(55,214,122,.18); }
  100%{ box-shadow:0 0 0 2px rgba(55,214,122,.14), 0 0 20px rgba(55,214,122,.12); }
}

.barCol.isCorrect .barStack{
  border-color:rgba(55,214,122,.65);
  animation: correctGlow 1.2s ease-in-out infinite;
}
.barCol.isCorrect .barTopBadge{
  border-color:rgba(55,214,122,.55);
  background:rgba(55,214,122,.18);
}
.barCol.isCorrect .barCheck{
  opacity:1;
  transform:scale(1);
}

/* ================== Timer ================== */
.qaCard{position:relative;overflow:hidden}
.timer-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.timer-track{fill:none;stroke:rgba(255,255,255,.18);stroke-width:6}
.timer-prog{
  fill:none;stroke:rgba(255,215,0,.95);stroke-width:6;
  stroke-linecap:round;stroke-linejoin:round;opacity:0
}

/* ================== SPLASH VIDEO ================== */
.intro{
  position:fixed; left:0; top:0;
  width:100vw;
  height:calc(var(--vh, 1vh) * 100);
  overflow:hidden;
  z-index:999999;
  display:block;
  background:#000;
}
#introVidBg{
  position:absolute; left:0; top:0;
  width:100vw; height:calc(var(--vh, 1vh) * 100);
  object-fit:cover; object-position:center;
  transform:scale(1.08);
  filter: blur(22px) brightness(1.06) saturate(1.18);
  opacity:0.95;
}
#introVid{
  position:absolute; left:0; top:0;
  width:100vw; height:calc(var(--vh, 1vh) * 100);
  object-fit:contain; object-position:center;
  background:transparent;
  filter: brightness(1.18) contrast(1.06) saturate(1.06);
}
.intro::after{
  content:"";
  position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.12));
  pointer-events:none;
}
.intro-hint{
  position:fixed; left:50%;
  transform:translateX(-50%);
  bottom:calc(14px + env(safe-area-inset-bottom));
  background:rgba(0,0,0,.55);
  border:1px solid rgba(255,255,255,.25);
  color:#fff;
  padding:8px 12px;
  border-radius:999px;
  font-size:12px;
  z-index:1000000;
}
.intro-sound{
  position:fixed; right:14px;
  top:calc(14px + env(safe-area-inset-top));
  background:rgba(0,0,0,.55);
  border:1px solid rgba(255,255,255,.25);
  color:#fff;
  padding:8px 10px;
  border-radius:999px;
  font-size:12px;
  z-index:1000000;
  cursor:pointer;
}
.intro.hide{opacity:0;pointer-events:none;transition:opacity .35s ease}
.intro-seen .container{visibility:visible}
.intro-seen #intro{display:none !important}
</style>
</head>

<body>
<div id="intro" class="intro" aria-label="Intro video">
  <video id="introVidBg" autoplay muted loop playsinline preload="auto" aria-hidden="true">
    <source src="/video/intro.mp4" type="video/mp4">
  </video>
  <video id="introVid" autoplay muted loop playsinline preload="auto">
    <source src="/video/intro.mp4" type="video/mp4">
  </video>
  <audio id="introMusic" preload="auto" loop playsinline>
    <source src="/audio/splash.mp3" type="audio/mpeg">
  </audio>
  <div id="introHint" class="intro-hint">Bấm để vào</div>
  <button id="introSound" class="intro-sound" type="button">🔊 Bật nhạc</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<div class="container">${bodyHtml}</div>

<script>
(function(){
  var intro = document.getElementById('intro');
  if(!intro) return;
  if (document.documentElement.classList.contains('intro-seen')) return;

  var KEY = 'intro_seen_session_v4';
  var vidBg = document.getElementById('introVidBg');
  var vid = document.getElementById('introVid');
  var music = document.getElementById('introMusic');
  var hint = document.getElementById('introHint');
  var btnSound = document.getElementById('introSound');

  try{ vidBg && vidBg.play().catch(function(){}); }catch(e){}
  try{ vid && vid.play().catch(function(){}); }catch(e){}

  function tryPlayMusic(){
    if (!music) return;
    try{
      music.volume = 1.0;
      var p = music.play();
      if (p && typeof p.then === 'function') {
        p.then(function(){ btnSound.style.display = 'none'; })
         .catch(function(){ btnSound.style.display = 'inline-block'; });
      }
    }catch(e){}
  }
  tryPlayMusic();

  btnSound.addEventListener('click', function(ev){
    ev.stopPropagation();
    try{
      music.play().then(function(){
        btnSound.style.display = 'none';
        if (hint) hint.textContent = "Bấm để vào";
      }).catch(function(){});
    }catch(e){}
  });

  function stopAll(){
    try{ if (vidBg) vidBg.pause(); }catch(e){}
    try{ if (vid) vid.pause(); }catch(e){}
    try{ if (music){ music.pause(); music.currentTime = 0; } }catch(e){}
  }

  function hideIntro(){
    try{ sessionStorage.setItem(KEY,'1'); }catch(e){}
    stopAll();
    document.documentElement.classList.add('intro-seen');
    intro.classList.add('hide');
    setTimeout(function(){ if(intro) intro.remove(); }, 400);
  }

  intro.addEventListener('click', hideIntro);
})();
</script>
</body>
</html>`;
}

/* ================== ROUTES ================== */
app.get("/health", (_, res) => res.json({ ok: true, preDelayMs: PRE_DELAY_MS }));

app.get("/", (_, res) => {
  res.send(layout("Quiz Realtime", `
    <div class="card">
      <div class="header"><h1>${QUIZ.title}</h1></div>
      <p class="small" style="margin:10px 0 0">Người chơi vào <b>/play</b>. Host cần key vào <b>/host</b>.</p>
      <hr/>
      <div class="row">
        <a class="btn" href="/play">Người chơi</a>
        <a class="btn" href="/host">Host (cần key)</a>
      </div>
    </div>
  `));
});

app.get("/host-login", (req, res) => {
  res.send(layout("Nhập Host Key", `
    <div class="card">
      <h1>Nhập Host Key</h1>
      <p class="small">Chỉ người có key mới vào được trang Host.</p>
      <form method="POST" action="/host-login">
        <label>Host Key</label>
        <input name="key" placeholder="Nhập key..." />
        <div class="row" style="margin-top:10px">
          <button class="btn" type="submit">Vào Host</button>
          <a class="btn" href="/play">Tôi là người chơi</a>
        </div>
      </form>
      <hr/>
      <p class="small">Vào nhanh: <b>/host?key=YOUR_KEY</b></p>
    </div>
  `));
});

app.post("/host-login", (req, res) => {
  const key = String(req.body.key || "").trim();
  if (!key || key !== HOST_KEY) {
    return res.send(layout("Sai Host Key", `
      <div class="card">
        <h1 class="bad">Sai Host Key</h1>
        <p class="small">Vui lòng thử lại.</p>
        <div class="row">
          <a class="btn" href="/host-login">Nhập lại</a>
          <a class="btn" href="/play">Tôi là người chơi</a>
        </div>
      </div>
    `));
  }
  setHostCookie(req, res);
  return res.redirect("/host");
});

app.get("/host-logout", (req, res) => {
  clearHostCookie(req, res);
  return res.redirect("/play");
});

app.get("/host", (req, res, next) => {
  const k = String(req.query.key || "").trim();
  if (k && k === HOST_KEY) {
    setHostCookie(req, res);
    return res.redirect("/host");
  }
  return next();
}, requireHost, (req, res) => {
  res.send(layout("Host", hostPageHtml()));
});

app.get("/play", (_, res) => {
  res.send(layout("Người chơi", playPageHtml()));
});

/* ================== PAGES HTML ================== */
function hostPageHtml() {
  return `
  <div class="app-bg" aria-hidden="true"></div>

  <div class="header">
    <h1>Host (MC)</h1>
    <div class="row">
      <a class="pill" href="/play">Mở trang Người chơi</a>
      <a class="pill" href="/host-logout">Đăng xuất Host</a>
      <button id="soundBtn" class="pill" style="display:none;background:transparent;cursor:pointer">🔊 Bật âm thanh</button>
      <span class="pill"><span class="dot" id="connDot"></span><span id="connText">Đang kết nối…</span></span>
    </div>
  </div>

  <audio id="qAudio" preload="auto" src="/audio/olympia.mp3"></audio>

  <div class="grid">
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div class="small">Mã phòng</div>
          <div id="roomCode" class="bigcode">—</div>
          <div class="small">Flow: Kết thúc câu → Biểu đồ → <b>Công bố đáp án</b> → <b>Top 5</b> → Câu tiếp.</div>
        </div>
        <div class="row">
          <span class="pill">Người chơi: <b id="playersCount">0</b></span>
          <span class="pill">Câu: <b id="qCounter">—</b></span>
        </div>
      </div>
      <hr/>
      <div class="row">
        <button id="btnCreate" class="btn" disabled>Tạo phòng</button>
        <button id="btnStart" class="btn" disabled>Bắt đầu</button>
        <button id="btnReveal" class="btn" disabled>Kết thúc câu</button>
        <button id="btnNext" class="btn" disabled>Câu tiếp theo</button>
      </div>
    </div>

    <div id="qaCardHost" class="card qaCard">
      <div class="small">Câu hỏi đang chạy</div>
      <h2 id="qText" style="margin:6px 0 0;font-size:clamp(16px,4.2vw,18px)">—</h2>
      <div class="row" style="margin-top:8px">
        <span class="badge">Đã trả lời: <b id="qAnswered">0</b></span>
      </div>
      <div id="choicesHost" class="choices"></div>
    </div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="small">Bảng xếp hạng tổng điểm</div>
    <h2 style="margin:6px 0 0;font-size:clamp(16px,4.2vw,18px)">Top 15 (tích lũy)</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Tên</th><th>Tổng điểm</th></tr></thead>
        <tbody id="lbBody"><tr><td colspan="3" class="small">Chưa có dữ liệu.</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- ✅ Popup biểu đồ (KHÔNG tự tắt) -->
  <div id="resultPopup" class="overlay">
    <div class="modal card">
      <div class="header">
        <h1 style="font-size:18px;margin:0">Kết quả câu vừa rồi</h1>
        <span class="pill"><span class="small">Kahoot-like chart</span></span>
      </div>

      <div id="resultMeta" class="small" style="margin-top:6px"></div>

      <div class="chartWrapV2">
        <div class="chartV2">
          <div id="yAxis" class="yAxis"></div>
          <div class="plot">
            <div id="gridLines"></div>
            <div class="xBase"></div>
            <div id="barsRow" class="barsRow"></div>
          </div>
        </div>
      </div>

      <div id="resultCorrect" class="small" style="margin-top:10px">
        <span class="badge">Chưa công bố đáp án</span> • <span class="small">Nhấn “Công bố đáp án”</span>
      </div>

      <div class="row" style="justify-content:flex-end;margin-top:12px">
        <button id="btnRevealAns" class="btn">Công bố đáp án</button>
        <button id="btnShowTop5" class="btn" disabled>Hiện Top 5</button>
      </div>

      <div class="small" style="margin-top:8px">
        Biểu đồ không tự tắt. Host điều khiển: <b>Công bố đáp án</b> → <b>Hiện Top 5</b>.
      </div>
    </div>
  </div>

  <!-- ✅ Popup Top 5 -->
  <div id="fastPopup" class="overlay">
    <div class="modal card">
      <div class="header">
        <h1 style="font-size:18px;margin:0">Top 5 đúng & nhanh (câu vừa xong)</h1>
        <span class="pill"><span class="small">Tự tắt sau 7 giây</span></span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Tên</th><th>Thời gian</th><th>+Điểm</th></tr></thead>
          <tbody id="fastBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    var socket = io();
    var $ = function(id){ return document.getElementById(id); };
    var esc = function(s){
      return String(s).replace(/[&<>"']/g, function(m){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]);
      });
    };
    function fmtMs(ms){ return (ms/1000).toFixed(2) + "s"; }

    // màu đáp án
    var ANSWER_COLOR_POOL = ["#1D3557","#0B3D91","#264653","#283618","#2F3E46","#3A0CA3","#5A189A","#6A040F","#004E64","#1B263B","#2D1E2F","#006D77"];
    // màu chart "tươi + sang"
    var CHART_COLOR_POOL = ["#4CC9F0","#F72585","#B5179E","#7209B7","#3A0CA3","#4361EE","#4895EF","#4D908E","#F9C74F","#F8961E","#F94144","#90BE6D"];

    function shuffle(arr){
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    function pickColors(pool, n){
      var p = shuffle(pool);
      while (p.length < n) p = p.concat(shuffle(pool));
      return p.slice(0, n);
    }
    function applyAnswerColors(containerId){
      var wrap = $(containerId);
      if (!wrap) return;
      var nodes = wrap.querySelectorAll(".choice");
      var colors = pickColors(ANSWER_COLOR_POOL, nodes.length);
      nodes.forEach(function(node, idx){
        node.style.background = colors[idx];
        node.style.borderColor = "rgba(255,255,255,.32)";
      });
    }

    /* ===== Timer SVG ===== */
    function ensureTimer(cardId){
      var card = $(cardId);
      if (!card) return null;
      if (card.__timerObj) return card.__timerObj;

      var ns = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "timer-svg");

      var track = document.createElementNS(ns, "rect");
      track.setAttribute("class", "timer-track");

      var prog = document.createElementNS(ns, "rect");
      prog.setAttribute("class", "timer-prog");

      svg.appendChild(track);
      svg.appendChild(prog);
      card.appendChild(svg);

      var obj = { card: card, svg: svg, track: track, prog: prog, len: 0, raf: 0 };

      obj.resize = function(){
        var w = card.clientWidth;
        var h = card.clientHeight;
        var sw = 6;
        var r = 16;
        var rx = Math.max(0, r - sw/2);

        svg.setAttribute("viewBox", "0 0 " + w + " " + h);

        track.setAttribute("x", sw/2);
        track.setAttribute("y", sw/2);
        track.setAttribute("width", Math.max(0, w - sw));
        track.setAttribute("height", Math.max(0, h - sw));
        track.setAttribute("rx", rx);
        track.setAttribute("ry", rx);

        prog.setAttribute("x", sw/2);
        prog.setAttribute("y", sw/2);
        prog.setAttribute("width", Math.max(0, w - sw));
        prog.setAttribute("height", Math.max(0, h - sw));
        prog.setAttribute("rx", rx);
        prog.setAttribute("ry", rx);

        try{
          obj.len = prog.getTotalLength();
          prog.style.strokeDasharray = String(obj.len);
        }catch(e){}
      };

      window.addEventListener("resize", function(){ obj.resize(); });
      obj.resize();

      card.__timerObj = obj;
      return obj;
    }

    function startTimer(cardId, startAtMs, durationMs){
      var t = ensureTimer(cardId);
      if (!t || !t.len) return;

      t.resize();
      if (t.raf) cancelAnimationFrame(t.raf);

      var len = t.len;
      t.prog.style.opacity = "1";
      t.prog.style.strokeDasharray = String(len);
      t.prog.style.strokeDashoffset = String(len);

      function step(){
        var now = Date.now();
        var p = (now - startAtMs) / durationMs;

        if (p < 0) {
          t.prog.style.strokeDashoffset = String(len);
          t.raf = requestAnimationFrame(step);
          return;
        }

        p = Math.max(0, Math.min(1, p));
        t.prog.style.strokeDashoffset = String(len * (1 - p));
        if (p < 1) t.raf = requestAnimationFrame(step);
      }
      t.raf = requestAnimationFrame(step);
    }

    function stopTimer(cardId){
      var t = ensureTimer(cardId);
      if (!t) return;
      if (t.raf) cancelAnimationFrame(t.raf);
      t.raf = 0;
      t.prog.style.opacity = "0";
    }

    /* ===== Audio ===== */
    var audio = document.getElementById("qAudio");
    var soundBtn = document.getElementById("soundBtn");
    function stopAudio(){ try{ audio.pause(); audio.currentTime = 0; }catch(e){} }
    function playAudioAfter(delayMs){
      stopAudio();
      soundBtn.style.display = "none";
      setTimeout(function(){
        audio.play().catch(function(){ soundBtn.style.display = "inline-flex"; });
      }, delayMs);
    }
    soundBtn.onclick = function(){
      audio.play().then(function(){ soundBtn.style.display = "none"; }).catch(function(){});
    };

    /* ===== Connection UI ===== */
    var dot = document.getElementById("connDot");
    var text = document.getElementById("connText");
    function setConn(ok, msg){
      dot.classList.remove("good","bad");
      dot.classList.add(ok ? "good" : "bad");
      text.textContent = msg;
    }

    var code = null;
    var state = null;

    var resultShowing = false;
    var answerRevealed = false;
    var lastResult = null;

    /* ===== Popup Top5 ===== */
    var popupTimer = null;
    function hidePopup(){ document.getElementById("fastPopup").style.display = "none"; }
    function showPopup(list, showMs){
      if (popupTimer) clearTimeout(popupTimer);
      var fastBody = document.getElementById("fastBody");
      if (!list || !list.length){
        fastBody.innerHTML = '<tr><td colspan="4" class="small">Không có ai trả lời đúng.</td></tr>';
      } else {
        fastBody.innerHTML = list.map(function(x,i){
          return "<tr><td>" + (i+1) + "</td><td>" + esc(x.name) + "</td><td>" + fmtMs(x.elapsedMs) + "</td><td>+" + (x.points || 0) + "</td></tr>";
        }).join("");
      }
      document.getElementById("fastPopup").style.display = "flex";
      popupTimer = setTimeout(hidePopup, showMs || 7000);
    }

    function hideResult(){
      document.getElementById("resultPopup").style.display = "none";
      resultShowing = false;
      answerRevealed = false;
      lastResult = null;
      setButtons();
    }

    function showResult(payload){
      lastResult = payload;
      answerRevealed = false;

      var answeredCount = Number(payload.answeredCount || 0);
      var totalPlayers = Number(payload.totalPlayers || 0);

      document.getElementById("resultMeta").textContent =
        "Số lượt chọn: " + answeredCount + " / " + totalPlayers + " • Biểu đồ không tự tắt";

      document.getElementById("resultCorrect").innerHTML =
        '<span class="badge">Chưa công bố đáp án</span> • <span class="small">Nhấn “Công bố đáp án”</span>';

      buildChartV2(payload.choices || [], payload.counts || [], totalPlayers);

      document.getElementById("resultPopup").style.display = "flex";
      resultShowing = true;
      setButtons();
    }

    // ===== Chart V2 (axis + grid + bounce + count-up) =====
    function niceTop(maxVal){
      if (!maxVal || maxVal <= 0) return 1;
      var ticks = 4;
      var step = Math.ceil(maxVal / ticks);
      return step * ticks;
    }

    function easeOutBack(t){
      var c1 = 1.70158;
      var c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function buildChartV2(choices, counts, totalPlayers){
      var yAxis = document.getElementById("yAxis");
      var grid = document.getElementById("gridLines");
      var barsRow = document.getElementById("barsRow");
      yAxis.innerHTML = "";
      grid.innerHTML = "";
      barsRow.innerHTML = "";

      var maxCount = 0;
      for (var i=0;i<counts.length;i++) maxCount = Math.max(maxCount, Number(counts[i]||0));
      var top = niceTop(maxCount);
      var ticks = 4;

      // y-axis labels + grid lines
      for (var k=0;k<=ticks;k++){
        var val = (top / ticks) * k;
        var pct = (k / ticks) * 100;

        var tick = document.createElement("div");
        tick.className = "yTick";
        tick.style.bottom = (pct) + "%";
        tick.textContent = String(val);
        yAxis.appendChild(tick);

        var line = document.createElement("div");
        line.className = "gridLine" + (k===0 ? " bold" : "");
        line.style.bottom = "calc(" + pct + "% + 44px)"; // offset vì x-label 44px
        grid.appendChild(line);
      }

      var colors = pickColors(CHART_COLOR_POOL, choices.length);

      // build bars
      for (var i=0;i<choices.length;i++){
        var letter = String.fromCharCode(65+i);
        var text = String(choices[i] || "");
        var cnt = Number(counts[i] || 0);
        var pct = totalPlayers ? Math.round((cnt / totalPlayers) * 100) : 0;
        var targetH = top ? Math.round((cnt / top) * 100) : 0;
        targetH = Math.max(0, Math.min(100, targetH));

        var col = document.createElement("div");
        col.className = "barCol";
        col.setAttribute("data-i", String(i));

        var stack = document.createElement("div");
        stack.className = "barStack";

        var fill = document.createElement("div");
        fill.className = "barFill";
        fill.style.height = "0%";
        fill.style.background = "linear-gradient(180deg, " + colors[i] + ", rgba(0,0,0,0))";

        var badge = document.createElement("div");
        badge.className = "barTopBadge";
        badge.textContent = "0 • 0%";

        var check = document.createElement("div");
        check.className = "barCheck";
        check.textContent = "✓";

        stack.appendChild(fill);
        stack.appendChild(badge);
        stack.appendChild(check);

        var x = document.createElement("div");
        x.className = "barXLabel";

        var l = document.createElement("div");
        l.className = "barLetter";
        l.textContent = letter;

        var t = document.createElement("div");
        t.className = "barText";
        t.textContent = text;

        x.appendChild(l);
        x.appendChild(t);

        col.appendChild(stack);
        col.appendChild(x);
        barsRow.appendChild(col);

        // animate with stagger
        (function(fillEl, badgeEl, targetHeight, targetCount, targetPct, delay){
          setTimeout(function(){
            var dur = 820;
            var t0 = performance.now();
            function step(now){
              var p = (now - t0) / dur;
              if (p < 0) p = 0;
              if (p > 1) p = 1;

              var e = easeOutBack(p);
              if (e < 0) e = 0;
              if (e > 1.08) e = 1.08;

              var h = Math.min(100, Math.round(targetHeight * e));
              fillEl.style.height = h + "%";

              var cc = Math.round(targetCount * Math.min(1, p));
              var pp = Math.round(targetPct * Math.min(1, p));
              badgeEl.textContent = cc + " • " + pp + "%";

              if (p < 1) requestAnimationFrame(step);
              else {
                fillEl.style.height = targetHeight + "%";
                badgeEl.textContent = targetCount + " • " + targetPct + "%";
              }
            }
            requestAnimationFrame(step);
          }, delay);
        })(fill, badge, targetH, cnt, pct, 90*i);
      }
    }

    function markCorrect(correctIndex){
      var barsRow = document.getElementById("barsRow");
      var cols = barsRow.querySelectorAll(".barCol");
      cols.forEach(function(c){ c.classList.remove("isCorrect"); });
      var el = barsRow.querySelector('.barCol[data-i="' + correctIndex + '"]');
      if (el) el.classList.add("isCorrect");
    }

    function setButtons(){
      document.getElementById("btnCreate").disabled = !socket.connected;
      document.getElementById("btnStart").disabled  = !socket.connected || !code || (state && state.started);
      document.getElementById("btnReveal").disabled = !socket.connected || !code || !(state && state.started) || (state && state.ended);

      // ✅ khóa Next khi đang popup biểu đồ
      document.getElementById("btnNext").disabled   =
        !socket.connected || !code || !(state && state.started) || (state && state.ended) || resultShowing;

      // popup control
      document.getElementById("btnRevealAns").disabled = !resultShowing || answerRevealed || !code;
      document.getElementById("btnShowTop5").disabled  = !resultShowing || !answerRevealed || !code;
    }

    socket.on("connect", function(){ setConn(true,"Đã kết nối"); setButtons(); });
    socket.on("disconnect", function(){ setConn(false,"Mất kết nối"); setButtons(); });
    socket.on("connect_error", function(){ setConn(false,"Lỗi kết nối"); setButtons(); });

    document.getElementById("btnCreate").onclick = function(){
      socket.emit("host:createRoom", {}, function(resp){
        if (!resp || !resp.ok) return alert((resp && resp.error) || "Không tạo được phòng");
        code = resp.code;
        document.getElementById("roomCode").textContent = code;
        hidePopup(); hideResult(); stopAudio(); stopTimer("qaCardHost"); setButtons();
      });
    };

    document.getElementById("btnStart").onclick = function(){
      socket.emit("host:start", { code: code }, function(resp){
        if (!resp || !resp.ok) return alert((resp && resp.error) || "Không thể bắt đầu");
        hidePopup(); hideResult(); stopAudio(); stopTimer("qaCardHost"); setButtons();
      });
    };

    document.getElementById("btnReveal").onclick = function(){
      socket.emit("host:reveal", { code: code }, function(resp){
        if (!resp || !resp.ok) alert((resp && resp.error) || "Lỗi");
      });
    };

    document.getElementById("btnNext").onclick = function(){
      socket.emit("host:next", { code: code }, function(resp){
        if (!resp || !resp.ok) return alert((resp && resp.error) || "Lỗi");
        hidePopup(); hideResult(); stopAudio(); stopTimer("qaCardHost"); setButtons();
      });
    };

    document.getElementById("btnRevealAns").onclick = function(){
      if (!code) return;
      socket.emit("host:revealAnswer", { code: code }, function(resp){
        if (!resp || !resp.ok) return alert((resp && resp.error) || "Không thể công bố đáp án");
      });
    };

    document.getElementById("btnShowTop5").onclick = function(){
      if (!code) return;
      socket.emit("host:showTop5", { code: code }, function(resp){
        if (!resp || !resp.ok) return alert((resp && resp.error) || "Không thể hiện Top 5");
      });
    };

    socket.on("players:count", function(p){
      document.getElementById("playersCount").textContent = String((p && p.count) || 0);
    });

    socket.on("room:state", function(s){
      state = s;
      if (state && state.total != null && state.qIndex != null) {
        document.getElementById("qCounter").textContent = String(state.qIndex + 1) + "/" + String(state.total);
      }
      setButtons();
    });

    socket.on("question:progress", function(p){
      document.getElementById("qAnswered").textContent = String(p.answered) + "/" + String(p.totalPlayers);
    });

    socket.on("question:start", function(q){
      hidePopup(); hideResult(); stopAudio(); stopTimer("qaCardHost");

      document.getElementById("qText").textContent = q.text;
      document.getElementById("qAnswered").textContent = "0";

      document.getElementById("choicesHost").innerHTML = q.choices.map(function(c,i){
        var letter = String.fromCharCode(65+i);
        return '<div class="choice"><span class="opt">' + letter + '</span><span class="txt">' + esc(c) + '</span></div>';
      }).join("");

      applyAnswerColors("choicesHost");

      var serverNow = q.serverNowMs || Date.now();
      var startedAt = q.startedAtMs || serverNow;

      var offset = serverNow - startedAt;
      var startLocalMs = Date.now() - offset;
      var delayToStart = Math.max(0, startedAt - serverNow);

      playAudioAfter(delayToStart);
      startTimer("qaCardHost", startLocalMs, q.timeLimitSec * 1000);
    });

    // ✅ Kết thúc câu => hiện biểu đồ (chưa công bố đáp án)
    socket.on("question:end", function(p){
      stopAudio(); stopTimer("qaCardHost");
      hidePopup();

      var totalTop15 = p.totalTop15 || [];
      document.getElementById("lbBody").innerHTML = (totalTop15.length ? totalTop15 : []).map(function(x,i){
        return "<tr><td>" + (i+1) + "</td><td>" + esc(x.name) + "</td><td>" + x.score + "</td></tr>";
      }).join("") || '<tr><td colspan="3" class="small">Chưa có dữ liệu.</td></tr>';

      showResult(p);
    });

    // ✅ Host công bố đáp án -> tất cả highlight cột đúng
    socket.on("answer:reveal", function(p){
      if (!lastResult || p.qIndex !== lastResult.qIndex) return;

      answerRevealed = true;
      var ci = Number(p.correctIndex || 0);
      markCorrect(ci);

      var choices = lastResult.choices || [];
      var letter = String.fromCharCode(65 + ci);
      var txt = (choices[ci] != null) ? String(choices[ci]) : "";

      document.getElementById("resultCorrect").innerHTML =
        '<span class="badge">Đáp án đúng: <b>' + letter + '</b></span>' +
        '<span class="small" style="margin-left:8px">' + esc(txt) + '</span>';

      setButtons();
    });

    // ✅ Host bấm "Hiện Top 5" => đóng chart và hiện top5
    socket.on("top5:show", function(p){
      hideResult();
      showPopup(p.fastTop5 || [], p.popupShowMs || 7000);
    });

    socket.on("game:end", function(p){
      stopAudio(); stopTimer("qaCardHost");
      hidePopup(); hideResult();

      var totalTop15 = p.totalTop15 || [];
      document.getElementById("lbBody").innerHTML = (totalTop15.length ? totalTop15 : []).map(function(x,i){
        return "<tr><td>" + (i+1) + "</td><td>" + esc(x.name) + "</td><td>" + x.score + "</td></tr>";
      }).join("") || '<tr><td colspan="3" class="small">Chưa có dữ liệu.</td></tr>';

      alert("Kết thúc game! Tổng người chơi: " + p.totalPlayers);
    });

    setButtons();
  </script>
  `;
}

function playPageHtml() {
  return `
  <div class="app-bg" aria-hidden="true"></div>

  <div class="header">
    <h1>Người chơi</h1>
    <div class="row">
      <a class="pill" href="/host">Host (cần key)</a>
      <button id="soundBtn" class="pill" style="display:none;background:transparent;cursor:pointer">🔊 Bật âm thanh</button>
      <span class="pill"><span class="dot" id="connDot"></span><span id="connText">Đang kết nối…</span></span>
    </div>
  </div>

  <audio id="qAudio" preload="auto" src="/audio/olympia.mp3"></audio>

  <div class="grid">
    <div class="card">
      <div class="small">Tham gia phòng</div>
      <div class="row" style="margin-top:8px">
        <div style="flex:1;min-width:220px">
          <label>Mã phòng</label>
          <input id="code" placeholder="ABC123"/>
        </div>
        <div style="flex:1;min-width:220px">
          <label>Tên của bạn</label>
          <input id="name" placeholder="Nguyễn Văn A"/>
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <button id="btnJoin" class="btn">Tham gia</button>
        <span id="joinStatus" class="small"></span>
      </div>
      <hr/>
      <div class="row">
        <span class="pill">Điểm: <b id="score">0</b></span>
        <span class="pill">Hạng (tạm tính): <b id="rank">—</b></span>
      </div>
      <p class="small" style="margin:10px 0 0">Không hiện “đúng/sai” ngay. Chờ MC công bố.</p>
    </div>

    <div id="qaCardPlay" class="card qaCard">
      <div class="small">Câu hỏi</div>
      <h2 id="qText" style="margin:6px 0 0;font-size:clamp(16px,4.2vw,18px)">—</h2>
      <div id="choicesPlay" class="choices"></div>
      <div id="feedback" class="small" style="margin-top:10px"></div>
    </div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="small">Bảng xếp hạng tổng điểm</div>
    <h2 style="margin:6px 0 0;font-size:clamp(16px,4.2vw,18px)">Top 15 (tích lũy)</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Tên</th><th>Tổng điểm</th></tr></thead>
        <tbody id="lbBody"><tr><td colspan="3" class="small">Chưa có dữ liệu.</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- ✅ Popup biểu đồ (KHÔNG tự tắt, chờ Host) -->
  <div id="resultPopup" class="overlay">
    <div class="modal card">
      <div class="header">
        <h1 style="font-size:18px;margin:0">Kết quả câu vừa rồi</h1>
        <span class="pill"><span class="small">Kahoot-like chart</span></span>
      </div>

      <div id="resultMeta" class="small" style="margin-top:6px"></div>

      <div class="chartWrapV2">
        <div class="chartV2">
          <div id="yAxis" class="yAxis"></div>
          <div class="plot">
            <div id="gridLines"></div>
            <div class="xBase"></div>
            <div id="barsRow" class="barsRow"></div>
          </div>
        </div>
      </div>

      <div id="resultCorrect" class="small" style="margin-top:10px">
        <span class="badge">Đang chờ Host công bố đáp án…</span>
      </div>
    </div>
  </div>

  <!-- ✅ Popup Top 5 -->
  <div id="fastPopup" class="overlay">
    <div class="modal card">
      <div class="header">
        <h1 style="font-size:18px;margin:0">Top 5 đúng & nhanh (câu vừa xong)</h1>
        <span class="pill"><span class="small">Tự tắt sau 7 giây</span></span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Tên</th><th>Thời gian</th><th>+Điểm</th></tr></thead>
          <tbody id="fastBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    var socket = io();
    var esc = function(s){
      return String(s).replace(/[&<>"']/g, function(m){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]);
      });
    };
    function fmtMs(ms){ return (ms/1000).toFixed(2) + "s"; }

    var ANSWER_COLOR_POOL = ["#1D3557","#0B3D91","#264653","#283618","#2F3E46","#3A0CA3","#5A189A","#6A040F","#004E64","#1B263B","#2D1E2F","#006D77"];
    var CHART_COLOR_POOL = ["#4CC9F0","#F72585","#B5179E","#7209B7","#3A0CA3","#4361EE","#4895EF","#4D908E","#F9C74F","#F8961E","#F94144","#90BE6D"];

    function shuffle(arr){
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    function pickColors(pool, n){
      var p = shuffle(pool);
      while (p.length < n) p = p.concat(shuffle(pool));
      return p.slice(0, n);
    }
    function applyAnswerColors(containerId){
      var wrap = document.getElementById(containerId);
      if (!wrap) return;
      var nodes = wrap.querySelectorAll(".choice");
      var colors = pickColors(ANSWER_COLOR_POOL, nodes.length);
      nodes.forEach(function(node, idx){
        node.style.background = colors[idx];
        node.style.borderColor = "rgba(255,255,255,.32)";
      });
    }

    function ensureTimer(cardId){
      var card = document.getElementById(cardId);
      if (!card) return null;
      if (card.__timerObj) return card.__timerObj;

      var ns = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "timer-svg");

      var track = document.createElementNS(ns, "rect");
      track.setAttribute("class", "timer-track");

      var prog = document.createElementNS(ns, "rect");
      prog.setAttribute("class", "timer-prog");

      svg.appendChild(track);
      svg.appendChild(prog);
      card.appendChild(svg);

      var obj = { card: card, svg: svg, track: track, prog: prog, len: 0, raf: 0 };

      obj.resize = function(){
        var w = card.clientWidth;
        var h = card.clientHeight;
        var sw = 6;
        var r = 16;
        var rx = Math.max(0, r - sw/2);

        svg.setAttribute("viewBox", "0 0 " + w + " " + h);

        track.setAttribute("x", sw/2);
        track.setAttribute("y", sw/2);
        track.setAttribute("width", Math.max(0, w - sw));
        track.setAttribute("height", Math.max(0, h - sw));
        track.setAttribute("rx", rx);
        track.setAttribute("ry", rx);

        prog.setAttribute("x", sw/2);
        prog.setAttribute("y", sw/2);
        prog.setAttribute("width", Math.max(0, w - sw));
        prog.setAttribute("height", Math.max(0, h - sw));
        prog.setAttribute("rx", rx);
        prog.setAttribute("ry", rx);

        try{
          obj.len = prog.getTotalLength();
          prog.style.strokeDasharray = String(obj.len);
        }catch(e){}
      };

      window.addEventListener("resize", function(){ obj.resize(); });
      obj.resize();

      card.__timerObj = obj;
      return obj;
    }

    function startTimer(cardId, startAtMs, durationMs){
      var t = ensureTimer(cardId);
      if (!t || !t.len) return;

      t.resize();
      if (t.raf) cancelAnimationFrame(t.raf);

      var len = t.len;
      t.prog.style.opacity = "1";
      t.prog.style.strokeDasharray = String(len);
      t.prog.style.strokeDashoffset = String(len);

      function step(){
        var now = Date.now();
        var p = (now - startAtMs) / durationMs;

        if (p < 0) {
          t.prog.style.strokeDashoffset = String(len);
          t.raf = requestAnimationFrame(step);
          return;
        }

        p = Math.max(0, Math.min(1, p));
        t.prog.style.strokeDashoffset = String(len * (1 - p));
        if (p < 1) t.raf = requestAnimationFrame(step);
      }
      t.raf = requestAnimationFrame(step);
    }

    function stopTimer(cardId){
      var t = ensureTimer(cardId);
      if (!t) return;
      if (t.raf) cancelAnimationFrame(t.raf);
      t.raf = 0;
      t.prog.style.opacity = "0";
    }

    var audio = document.getElementById("qAudio");
    var soundBtn = document.getElementById("soundBtn");
    function stopAudio(){ try{ audio.pause(); audio.currentTime = 0; }catch(e){} }
    function playAudioAfter(delayMs){
      stopAudio();
      soundBtn.style.display = "none";
      setTimeout(function(){
        audio.play().catch(function(){ soundBtn.style.display = "inline-flex"; });
      }, delayMs);
    }
    soundBtn.onclick = function(){
      audio.play().then(function(){ soundBtn.style.display = "none"; }).catch(function(){});
    };

    var dot = document.getElementById("connDot");
    var text = document.getElementById("connText");
    function setConn(ok, msg){
      dot.classList.remove("good","bad");
      dot.classList.add(ok ? "good" : "bad");
      text.textContent = msg;
    }
    socket.on("connect", function(){ setConn(true,"Đã kết nối"); });
    socket.on("disconnect", function(){ setConn(false,"Mất kết nối"); });
    socket.on("connect_error", function(){ setConn(false,"Lỗi kết nối"); });

    var joined = false;
    var roomCode = null;
    var myAnswered = false;
    var enableTimer = null;

    var lastResult = null;

    function clearEnable(){ if (enableTimer) clearTimeout(enableTimer); enableTimer = null; }
    function setAnswerEnabled(enabled){
      Array.prototype.forEach.call(document.getElementById("choicesPlay").querySelectorAll("button.choice"), function(b){
        if (!myAnswered) {
          if (enabled) b.removeAttribute("disabled");
          else b.setAttribute("disabled","disabled");
        }
      });
    }

    var popupTimer = null;
    function hidePopup(){ document.getElementById("fastPopup").style.display = "none"; }
    function showPopup(list, showMs){
      if (popupTimer) clearTimeout(popupTimer);
      var fastBody = document.getElementById("fastBody");
      if (!list || !list.length){
        fastBody.innerHTML = '<tr><td colspan="4" class="small">Không có ai trả lời đúng.</td></tr>';
      } else {
        fastBody.innerHTML = list.map(function(x,i){
          return "<tr><td>" + (i+1) + "</td><td>" + esc(x.name) + "</td><td>" + fmtMs(x.elapsedMs) + "</td><td>+" + (x.points || 0) + "</td></tr>";
        }).join("");
      }
      document.getElementById("fastPopup").style.display = "flex";
      popupTimer = setTimeout(hidePopup, showMs || 7000);
    }

    function hideResult(){ document.getElementById("resultPopup").style.display = "none"; lastResult=null; }

    function niceTop(maxVal){
      if (!maxVal || maxVal <= 0) return 1;
      var ticks = 4;
      var step = Math.ceil(maxVal / ticks);
      return step * ticks;
    }
    function easeOutBack(t){
      var c1 = 1.70158;
      var c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function buildChartV2(choices, counts, totalPlayers){
      var yAxis = document.getElementById("yAxis");
      var grid = document.getElementById("gridLines");
      var barsRow = document.getElementById("barsRow");
      yAxis.innerHTML = "";
      grid.innerHTML = "";
      barsRow.innerHTML = "";

      var maxCount = 0;
      for (var i=0;i<counts.length;i++) maxCount = Math.max(maxCount, Number(counts[i]||0));
      var top = niceTop(maxCount);
      var ticks = 4;

      for (var k=0;k<=ticks;k++){
        var val = (top / ticks) * k;
        var pct = (k / ticks) * 100;

        var tick = document.createElement("div");
        tick.className = "yTick";
        tick.style.bottom = (pct) + "%";
        tick.textContent = String(val);
        yAxis.appendChild(tick);

        var line = document.createElement("div");
        line.className = "gridLine" + (k===0 ? " bold" : "");
        line.style.bottom = "calc(" + pct + "% + 44px)";
        grid.appendChild(line);
      }

      var colors = pickColors(CHART_COLOR_POOL, choices.length);

      for (var i=0;i<choices.length;i++){
        var letter = String.fromCharCode(65+i);
        var text = String(choices[i] || "");
        var cnt = Number(counts[i] || 0);
        var pct = totalPlayers ? Math.round((cnt / totalPlayers) * 100) : 0;
        var targetH = top ? Math.round((cnt / top) * 100) : 0;
        targetH = Math.max(0, Math.min(100, targetH));

        var col = document.createElement("div");
        col.className = "barCol";
        col.setAttribute("data-i", String(i));

        var stack = document.createElement("div");
        stack.className = "barStack";

        var fill = document.createElement("div");
        fill.className = "barFill";
        fill.style.height = "0%";
        fill.style.background = "linear-gradient(180deg, " + colors[i] + ", rgba(0,0,0,0))";

        var badge = document.createElement("div");
        badge.className = "barTopBadge";
        badge.textContent = "0 • 0%";

        var check = document.createElement("div");
        check.className = "barCheck";
        check.textContent = "✓";

        stack.appendChild(fill);
        stack.appendChild(badge);
        stack.appendChild(check);

        var x = document.createElement("div");
        x.className = "barXLabel";

        var l = document.createElement("div");
        l.className = "barLetter";
        l.textContent = letter;

        var t = document.createElement("div");
        t.className = "barText";
        t.textContent = text;

        x.appendChild(l);
        x.appendChild(t);

        col.appendChild(stack);
        col.appendChild(x);

        barsRow.appendChild(col);

        (function(fillEl, badgeEl, targetHeight, targetCount, targetPct, delay){
          setTimeout(function(){
            var dur = 820;
            var t0 = performance.now();
            function step(now){
              var p = (now - t0) / dur;
              if (p < 0) p = 0;
              if (p > 1) p = 1;

              var e = easeOutBack(p);
              if (e < 0) e = 0;
              if (e > 1.08) e = 1.08;

              var h = Math.min(100, Math.round(targetHeight * e));
              fillEl.style.height = h + "%";

              var cc = Math.round(targetCount * Math.min(1, p));
              var pp = Math.round(targetPct * Math.min(1, p));
              badgeEl.textContent = cc + " • " + pp + "%";

              if (p < 1) requestAnimationFrame(step);
              else {
                fillEl.style.height = targetHeight + "%";
                badgeEl.textContent = targetCount + " • " + targetPct + "%";
              }
            }
            requestAnimationFrame(step);
          }, delay);
        })(fill, badge, targetH, cnt, pct, 90*i);
      }
    }

    function markCorrect(correctIndex){
      var barsRow = document.getElementById("barsRow");
      var cols = barsRow.querySelectorAll(".barCol");
      cols.forEach(function(c){ c.classList.remove("isCorrect"); });
      var el = barsRow.querySelector('.barCol[data-i="' + correctIndex + '"]');
      if (el) el.classList.add("isCorrect");
    }

    function showResult(payload){
      lastResult = payload;

      var answeredCount = Number(payload.answeredCount || 0);
      var totalPlayers = Number(payload.totalPlayers || 0);

      document.getElementById("resultMeta").textContent =
        "Số lượt chọn: " + answeredCount + " / " + totalPlayers;

      document.getElementById("resultCorrect").innerHTML =
        '<span class="badge">Đang chờ Host công bố đáp án…</span>';

      buildChartV2(payload.choices || [], payload.counts || [], totalPlayers);

      document.getElementById("resultPopup").style.display = "flex";
    }

    document.getElementById("btnJoin").onclick = function(){
      var code = document.getElementById("code").value.trim().toUpperCase();
      var name = document.getElementById("name").value.trim();
      socket.emit("player:join", { code: code, name: name }, function(resp){
        if (!resp || !resp.ok) {
          joined = false;
          document.getElementById("joinStatus").innerHTML = '<span class="bad">✖ ' + esc((resp && resp.error) || "Không tham gia được") + '</span>';
          return;
        }
        joined = true;
        roomCode = code;
        document.getElementById("joinStatus").innerHTML = '<span class="good">✔ Đã vào phòng ' + esc(code) + '</span>';
      });
    };

    socket.on("question:start", function(q){
      if (!joined) return;

      hidePopup(); hideResult(); stopAudio(); stopTimer("qaCardPlay"); clearEnable();
      myAnswered = false;
      document.getElementById("feedback").textContent = "";
      document.getElementById("qText").textContent = q.text;

      document.getElementById("choicesPlay").innerHTML = q.choices.map(function(c,i){
        var letter = String.fromCharCode(65+i);
        return '<button class="choice" data-i="' + i + '" disabled>' +
                 '<span class="opt">' + letter + '</span>' +
                 '<span class="txt">' + esc(c) + '</span>' +
               '</button>';
      }).join("");

      applyAnswerColors("choicesPlay");

      var serverNow = q.serverNowMs || Date.now();
      var startedAt = q.startedAtMs || serverNow;

      var offset = serverNow - startedAt;
      var startLocalMs = Date.now() - offset;
      var delayToStart = Math.max(0, startedAt - serverNow);

      playAudioAfter(delayToStart);
      startTimer("qaCardPlay", startLocalMs, q.timeLimitSec * 1000);

      enableTimer = setTimeout(function(){ setAnswerEnabled(true); }, delayToStart);

      Array.prototype.forEach.call(document.getElementById("choicesPlay").querySelectorAll("button.choice"), function(btn){
        btn.onclick = function(){
          if (myAnswered) return;
          if (btn.hasAttribute("disabled")) return;

          myAnswered = true;
          var choiceIndex = Number(btn.getAttribute("data-i"));
          setAnswerEnabled(false);

          socket.emit("player:answer", { code: roomCode, choiceIndex: choiceIndex }, function(resp){
            if (!resp || !resp.ok) {
              document.getElementById("feedback").innerHTML = '<span class="bad">✖ ' + esc((resp && resp.error) || "Lỗi") + '</span>';
              return;
            }
            document.getElementById("score").textContent = String(resp.totalScore || 0);
            document.getElementById("rank").textContent = String(resp.rank || "—");
            document.getElementById("feedback").innerHTML = '<span class="badge">Đã gửi đáp án • chờ MC công bố…</span>';
          });
        };
      });
    });

    socket.on("question:end", function(p){
      if (!joined) return;

      stopAudio(); stopTimer("qaCardPlay"); clearEnable();
      hidePopup();

      var totalTop15 = p.totalTop15 || [];
      document.getElementById("lbBody").innerHTML = (totalTop15.length ? totalTop15 : []).map(function(x,i){
        return "<tr><td>" + (i+1) + "</td><td>" + esc(x.name) + "</td><td>" + x.score + "</td></tr>";
      }).join("") || '<tr><td colspan="3" class="small">Chưa có dữ liệu.</td></tr>';

      showResult(p);
    });

    socket.on("answer:reveal", function(p){
      if (!lastResult || p.qIndex !== lastResult.qIndex) return;

      var ci = Number(p.correctIndex || 0);
      markCorrect(ci);

      var choices = lastResult.choices || [];
      var letter = String.fromCharCode(65 + ci);
      var txt = (choices[ci] != null) ? String(choices[ci]) : "";

      document.getElementById("resultCorrect").innerHTML =
        '<span class="badge">Đáp án đúng: <b>' + letter + '</b></span>' +
        '<span class="small" style="margin-left:8px">' + esc(txt) + '</span>';
    });

    socket.on("top5:show", function(p){
      hideResult();
      showPopup(p.fastTop5 || [], p.popupShowMs || 7000);
    });

    socket.on("game:end", function(p){
      if (!joined) return;

      stopAudio(); stopTimer("qaCardPlay"); clearEnable();
      hidePopup(); hideResult();

      var totalTop15 = p.totalTop15 || [];
      document.getElementById("lbBody").innerHTML = (totalTop15.length ? totalTop15 : []).map(function(x,i){
        return "<tr><td>" + (i+1) + "</td><td>" + esc(x.name) + "</td><td>" + x.score + "</td></tr>";
      }).join("") || '<tr><td colspan="3" class="small">Chưa có dữ liệu.</td></tr>';

      alert("Kết thúc game! Tổng người chơi: " + p.totalPlayers);
    });
  </script>
  `;
}

/* ================== SOCKET.IO ================== */
function socketIsHost(socket) {
  const cookies = parseCookies(socket.request.headers.cookie || "");
  return cookies[HOST_COOKIE_NAME] === hostSig();
}

io.on("connection", (socket) => {
  socket.on("host:createRoom", (_, ack) => {
    if (!socketIsHost(socket)) return ack && ack({ ok: false, error: "Bạn cần HOST KEY để dùng Host." });

    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      createdAt: Date.now(),
      started: false,
      ended: false,
      qIndex: 0,
      qStartAtMs: 0,
      timer: null,
      questionEndedFor: null,
      answerRevealedFor: null,
      players: new Map(),
      qOrder: null,
      choiceMeta: new Map()
    };
    rooms.set(code, room);
    socket.join(code);

    ack && ack({ ok: true, code });
    broadcast(room);
  });

  socket.on("host:start", ({ code }, ack) => {
    if (!socketIsHost(socket)) return ack && ack({ ok: false, error: "Bạn cần HOST KEY để dùng Host." });

    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: "Không tìm thấy phòng" });
    if (room.hostId !== socket.id) return ack && ack({ ok: false, error: "Bạn không phải Host" });
    if (room.started) return ack && ack({ ok: false, error: "Phòng đã bắt đầu rồi" });

    room.started = true;
    room.ended = false;

    room.qOrder = makeShuffledIndices(QUIZ.questions.length); // random câu
    room.choiceMeta = new Map();
    room.qIndex = 0;

    for (const p of room.players.values()) {
      p.score = 0;
      p.lastAnswer = null;
    }

    startQuestion(room);
    ack && ack({ ok: true });
  });

  socket.on("host:reveal", ({ code }, ack) => {
    if (!socketIsHost(socket)) return ack && ack({ ok: false, error: "Bạn cần HOST KEY để dùng Host." });

    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: "Không tìm thấy phòng" });
    if (room.hostId !== socket.id) return ack && ack({ ok: false, error: "Bạn không phải Host" });

    endQuestion(room);
    ack && ack({ ok: true });
  });

  // ✅ Host công bố đáp án (mới)
  socket.on("host:revealAnswer", ({ code }, ack) => {
    if (!socketIsHost(socket)) return ack && ack({ ok: false, error: "Bạn cần HOST KEY để dùng Host." });

    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: "Không tìm thấy phòng" });
    if (room.hostId !== socket.id) return ack && ack({ ok: false, error: "Bạn không phải Host" });

    if (room.questionEndedFor !== room.qIndex) return ack && ack({ ok: false, error: "Chưa kết thúc câu hỏi." });
    if (room.answerRevealedFor === room.qIndex) return ack && ack({ ok: true });

    const meta = ensureChoiceMeta(room);
    room.answerRevealedFor = room.qIndex;

    io.to(code).emit("answer:reveal", {
      qIndex: room.qIndex,
      correctIndex: meta.correctShuffledIndex
    });

    ack && ack({ ok: true });
  });

  // ✅ Host bấm để đóng biểu đồ + hiện Top5
  socket.on("host:showTop5", ({ code }, ack) => {
    if (!socketIsHost(socket)) return ack && ack({ ok: false, error: "Bạn cần HOST KEY để dùng Host." });

    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: "Không tìm thấy phòng" });
    if (room.hostId !== socket.id) return ack && ack({ ok: false, error: "Bạn không phải Host" });

    if (room.questionEndedFor !== room.qIndex) return ack && ack({ ok: false, error: "Chưa kết thúc câu hỏi." });
    if (room.answerRevealedFor !== room.qIndex) return ack && ack({ ok: false, error: "Chưa công bố đáp án." });

    io.to(code).emit("top5:show", {
      qIndex: room.qIndex,
      fastTop5: getFastCorrectTop5(room),
      popupShowMs: POPUP_SHOW_MS
    });

    ack && ack({ ok: true });
  });

  socket.on("host:next", ({ code }, ack) => {
    if (!socketIsHost(socket)) return ack && ack({ ok: false, error: "Bạn cần HOST KEY để dùng Host." });

    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: "Không tìm thấy phòng" });
    if (room.hostId !== socket.id) return ack && ack({ ok: false, error: "Bạn không phải Host" });
    if (!room.started) return ack && ack({ ok: false, error: "Chưa bắt đầu" });

    endQuestion(room);

    room.qIndex += 1;
    const total = room.qOrder ? room.qOrder.length : QUIZ.questions.length;

    if (room.qIndex >= total) {
      endGame(room);
      return ack && ack({ ok: true, ended: true });
    }

    startQuestion(room);
    ack && ack({ ok: true, ended: false });
  });

  socket.on("player:join", ({ code, name }, ack) => {
    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: "Mã phòng không đúng" });
    if (room.ended) return ack && ack({ ok: false, error: "Game đã kết thúc" });

    const cleanName = String(name || "").trim().slice(0, 24);
    if (!cleanName) return ack && ack({ ok: false, error: "Bạn cần nhập tên" });

    room.players.set(socket.id, { name: cleanName, score: 0, lastAnswer: null });
    socket.join(code);

    io.to(code).emit("players:count", { count: room.players.size });

    ack && ack({ ok: true });

    if (room.started && !room.ended) socket.emit("question:start", safeQuestionPayload(room));
    broadcast(room);
  });

  socket.on("player:answer", ({ code, choiceIndex }, ack) => {
    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: "Không tìm thấy phòng" });
    if (!room.started || room.ended) return ack && ack({ ok: false, error: "Game chưa chạy hoặc đã kết thúc" });

    const p = room.players.get(socket.id);
    if (!p) return ack && ack({ ok: false, error: "Bạn chưa tham gia" });

    const { q } = getRoomQuestion(room);
    const meta = ensureChoiceMeta(room);

    if (Date.now() < room.qStartAtMs) {
      return ack && ack({ ok: false, error: "Chưa bắt đầu, chờ 0.5 giây..." });
    }

    if (p.lastAnswer && p.lastAnswer.qIndex === room.qIndex) {
      return ack && ack({ ok: false, error: "Bạn đã trả lời câu này rồi" });
    }

    const elapsedMs = Date.now() - room.qStartAtMs;
    const selected = Number(choiceIndex);

    if (Number.isFinite(selected) && selected >= 0 && selected < meta.counts.length) {
      meta.counts[selected] += 1;
    }

    const correct = selected === meta.correctShuffledIndex;
    const pts = computePoints({ correct, elapsedMs, limitSec: q.timeLimitSec });
    p.score += pts;

    p.lastAnswer = { qIndex: room.qIndex, choiceIndex: selected, elapsedMs, correct, points: pts };

    const leaderboard = getTotalLeaderboard(room);
    const rank = leaderboard.findIndex((x) => x.socketId === socket.id) + 1;

    // ✅ không trả correct/points
    ack && ack({ ok: true, totalScore: p.score, rank });

    let answered = 0;
    for (const pl of room.players.values()) {
      if (pl.lastAnswer && pl.lastAnswer.qIndex === room.qIndex) answered++;
    }
    io.to(code).emit("question:progress", { answered, totalPlayers: room.players.size });
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      if (room.hostId === socket.id) {
        endGame(room);
        rooms.delete(room.code);
        continue;
      }
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        io.to(room.code).emit("players:count", { count: room.players.size });
        broadcast(room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Realtime quiz running on port", PORT));
