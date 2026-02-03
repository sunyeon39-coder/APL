// firebase.js — FINAL STABLE

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔥 Firebase Config */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "box-board.firebaseapp.com",
  projectId: "box-board",
  storageBucket: "box-board.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

/* 🔥 Init */
const app = initializeApp(firebaseConfig);

/* 🔥 Export (Auth / Firestore ONLY) */
export const auth = getAuth(app);
export const db = getFirestore(app);
