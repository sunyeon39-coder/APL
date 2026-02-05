// index.js — CLICK SAFE PATCH (FINAL)
// 목적: index 화면에서 클릭이 막히는 문제만 해결
// ⚠️ 기능/UX/UI 변경 없음

document.addEventListener("DOMContentLoaded", () => {
  // page transition 잔여 상태 제거
  document.documentElement.classList.remove("page-enter");
  document.documentElement.classList.add("page-ready");

  // 혹시 남아있는 클릭 방해 레이어 제거
  document.querySelectorAll(
    ".overlay, .loading, .blocker, .page-block, .modal-block"
  ).forEach(el => {
    el.style.pointerEvents = "none";
  });

  // body 클릭 복구
  document.body.style.pointerEvents = "auto";

  console.log("✅ index.js: click restored");
});
