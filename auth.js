// auth.js — SAFE COMPAT LAYER
// 목적:
// - 과거에 auth.js를 로드하던 페이지(예: signup.html)에서도 로그인 동작 유지
// - 하지만 login 버튼이 없는 페이지(index/hub 등)에서는 절대 리다이렉트/부작용 발생 금지
//
// ✅ 기존 UI/레이아웃/기능은 건드리지 않고,
//    "로그인 페이지에서만" 로그인 처리하도록 범위를 제한함.

const path = (location.pathname || "").toLowerCase();

// 로그인 버튼이 있는 페이지에서만 동작
const hasLoginBtn = !!document.getElementById("googleLoginBtn");

// login.html / signup.html 이거나, 버튼이 있을 때만 login.js를 실행
const isAuthPage =
  hasLoginBtn ||
  path.endsWith("/login.html") ||
  path.endsWith("/signup.html") ||
  path.endsWith("/login") ||
  path.endsWith("/signup");

if (isAuthPage) {
  // login.js가 단일 권위(Single Authority)로 로그인 처리
  import("./login.js").catch((e) => {
    console.error("❌ auth.js → login.js import failed:", e);
  });
} else {
  // 다른 페이지에서는 아무것도 하지 않음 (🔥 핵심)
  console.log("ℹ️ auth.js: not an auth page, skipping.");
}
