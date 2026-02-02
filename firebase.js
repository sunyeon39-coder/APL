// firebase.js — FINAL (Mobile + Redirect Safe)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =================================================
   FIREBASE CONFIG
================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyDXZM15ex4GNFdf2xjVOW-xopMHf_AMYGc",
  authDomain: "box-board.firebaseapp.com", // ✅ 정확
  projectId: "box-board",
  storageBucket: "box-board.appspot.com",  // 🔥 반드시 이 값
  messagingSenderId: "336632241536",
  appId: "1:336632241536:web:d7b57b91d91596dbf3b565",
  measurementId: "G-7B9W7N9X9B"
};

/* =================================================
   INIT
================================================= */

// 🔥 App은 단 1번만
const app = initializeApp(firebaseConfig);

// 🔥 Auth
export const auth = getAuth(app);

// 🔥 persistence 설정 (모바일 fallback 포함)
try {
  await setPersistence(auth, browserLocalPersistence);
  console.log("✅ Auth persistence: local");
} catch (err) {
  console.warn("⚠️ local persistence 실패 → session으로 fallback", err);
  await setPersistence(auth, browserSessionPersistence);
}

// 🔥 Firestore
export const db = getFirestore(app);

console.log("🔥 Firebase Auth + Firestore initialized (mobile safe)");
