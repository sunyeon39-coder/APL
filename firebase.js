// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔹 네 Firebase 프로젝트 설정 (기존 그대로 사용)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // 있어도 됨 (안 씀)
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase App 초기화
const app = initializeApp(firebaseConfig);

// 🔥 Firestore ONLY
export const db = getFirestore(app);

// ❌ Storage / Auth / Functions 아무것도 export 안 함
