// firebase.js — FINAL (auth export guaranteed)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXZM15ex4GNFdf2xjVOW-xopMHf_AMYGc",
  authDomain: "box-board.firebaseapp.com",
  projectId: "box-board",
  storageBucket: "box-board.appspot.com",
  messagingSenderId: "336632241536",
  appId: "1:336632241536:web:d7b57b91d91596dbf3b565",
  measurementId: "G-7B9W7N9X9B"
};

const app = initializeApp(firebaseConfig);

// 🔥 이 두 줄이 없으면 지금 에러가 난다
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("🔥 firebase.js loaded:", { auth, db });
