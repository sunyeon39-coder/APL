// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  initializeFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔹 네 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDXZM15ex4GNFdf2xjVOW-xopMHf_AMYGc",
  authDomain: "box-board.firebaseapp.com",
  projectId: "box-board",
  storageBucket: "box-board.firebasestorage.app",
  messagingSenderId: "336632241536",
  appId: "1:336632241536:web:d7b57b91d91596dbf3b565",
  measurementId: "G-7B9W7N9X9B"
};

// 🔹 App 초기화
const app = initializeApp(firebaseConfig);

// 🔥 Firestore (Safari safe)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

console.log("🔥 Firestore initialized with long polling (Safari safe)");

export { db };