// index.js — ADMIN GATE + CLICK SAFE (EXISTING FILE PATCH)
// ❗ 새 기능 추가 없음 / 기존 app.js 로직 그대로 사용

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 클릭 차단 잔여 제거 (page-enter 안전 해제)
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.remove("page-enter");
  document.documentElement.classList.add("page-ready");
  document.body.style.pointerEvents = "auto";
});

// admin 권한에 따라 버튼 표시 제어
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  let role = "user";
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists() && snap.data().role) {
      role = snap.data().role;
    }
  } catch (e) {
    console.warn("role check failed:", e);
  }

  const adminAreas = document.querySelectorAll(".admin-actions");
  adminAreas.forEach(el => {
    el.style.display = role === "admin" ? "" : "none";
  });
});
