// index.js — AUTH + EVENT GATE (LOOP FIXED / CLICK SAFE)
// ✅ 기능/UX/UI 변경 없이, "허브→인덱스 갔다가 다시 허브로 튕김"만 방지
// - eventId를 query 또는 sessionStorage에서 복원
// - eventId가 없으면 hub로
// - 로그인 안 되어 있으면 login으로
// - 기존 click-safe patch 유지

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   EVENT ID GATE (즉시 실행)
=============================== */
(function(){
  const params = new URLSearchParams(location.search);
  let eventId = params.get("eventId") || params.get("id") || params.get("event");

  // 🔥 허브에서 넘어올 때 eventId를 안전하게 유지 (PC에서 간헐적으로 query가 누락/변형되는 케이스 방어)
  if (!eventId) eventId = sessionStorage.getItem("eventId");

  if (eventId) {
    sessionStorage.setItem("eventId", eventId);
    return;
  }

  // eventId가 없으면 index에 있을 이유가 없음 → 허브로
  location.replace("/hub");
})();

/* ===============================
   AUTH GATE
=============================== */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.replace("/login");
  }
});

/* ===============================
   CLICK SAFE PATCH (기존 유지)
=============================== */
document.addEventListener("DOMContentLoaded", () => {
  // page transition 잔여 상태 제거
  document.documentElement.classList.remove("page-enter");
  document.documentElement.classList.add("page-ready");

  // 혹시 남아있는 클릭 방해 레이어 제거
  document.querySelectorAll(
    ".overlay, .loading, .blocker, .page-block, .modal-block, .layout-loading"
  ).forEach(el => {
    // hidden 요소가 전체 클릭을 먹는 케이스 방어
    const isHidden =
      el.classList.contains("hidden") ||
      el.getAttribute("aria-hidden") === "true" ||
      getComputedStyle(el).display === "none" ||
      getComputedStyle(el).visibility === "hidden";

    if (isHidden) el.style.pointerEvents = "none";
  });

  // body 클릭 복구
  document.body.style.pointerEvents = "auto";

  console.log("✅ index.js: auth/event gate + click restored");
});
