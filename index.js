// index.js — AUTH + EVENT GATE (LOOP FIXED)

import { auth } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, user => {
  if (!user) {
    location.replace("/login");
    return;
  }

  const params = new URLSearchParams(location.search);
  const eventId =
    params.get("eventId") ||
    sessionStorage.getItem("eventId");

  if (!eventId) {
    // ✅ auth OK + eventId 없음 → 그때만 hub
    location.replace("/hub");
    return;
  }

  // ✅ 정상 진입 → eventId 보존
  sessionStorage.setItem("eventId", eventId);

  console.log("✅ index loaded:", eventId);
});

/* ===============================
   CLICK SAFE (기존 유지)
=============================== */
document.addEventListener("DOMContentLoaded", () => {
  document.body.style.pointerEvents = "auto";
});
