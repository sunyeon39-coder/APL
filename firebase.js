// firebase.js (GitHub Pages FINAL)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  initializeFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   Firebase Config
   =============================== */
const firebaseConfig = {
  apiKey: "AIzaSyDXZM15ex4GNFdf2xjV0W-xopMHf_AMYGc",
  authDomain: "box-board.firebaseapp.com",
  projectId: "box-board",
  storageBucket: "box-board.appspot.com",
  messagingSenderId: "336632241536",
  appId: "1:336632241536:web:d7b57b91d91596dbf3b565"
};

/* ===============================
   App Init
   =============================== */
const app = initializeApp(firebaseConfig);

/* ===============================
   Firestore Init (Safari / iOS SAFE)
   =============================== */
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});

/* ===============================
   EXPORT (🔥 딱 한 번만)
   =============================== */
export { db };

console.log("🔥 Firestore initialized (GitHub Pages SAFE)");
