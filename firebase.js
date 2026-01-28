// firebase.js (FINAL – AUTH PERSISTENCE FIXED)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXZM15ex4GNFdf2xjVOW-xopMHf_AMYGc",
  authDomain: "box-board.firebaseapp.com",
  projectId: "box-board",
  storageBucket: "box-board.firebasestorage.app",
  messagingSenderId: "336632241536",
  appId: "1:336632241536:web:d7b57b91d91596dbf3b565",
  measurementId: "G-7B9W7N9X9B"
};

// 🔥 App은 단 1번만
const app = initializeApp(firebaseConfig);

// 🔥 Auth도 단 1번
export const auth = getAuth(app);

// 🔥 persistence를 여기서 고정
await setPersistence(auth, browserLocalPersistence);

// Firestore
export const db = getFirestore(app);

console.log("🔥 Firebase Auth + Firestore initialized with persistence");
