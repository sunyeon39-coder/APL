// js/hub.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("🔥 hub.js loaded (CLICK → INDEX)");

/* ===============================
   AUTH GUARD
=============================== */
onAuthStateChanged(auth, user => {
  if (!user) {
    console.log("⛔ not logged in");
    location.replace("login.html");
    return;
  }

  console.log("✅ logged in:", user.email);
  subscribeEvents(); // 🔥 로그인 후 실시간 구독
});

/* ===============================
   LOGOUT
=============================== */
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  console.log("👋 logout");
  location.replace("login.html");
});

/* ===============================
   DOM
=============================== */
const eventListEl = document.getElementById("eventList");

/* ===============================
   REALTIME SYNC (QUERY FIXED)
=============================== */
function subscribeEvents() {
  const q = query(
    collection(db, "events"),
    where("createdAt", "!=", null),   // 🔥 핵심
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, snapshot => {
    eventListEl.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();
      renderEventCard(doc.id, data);
    });

    console.log("🔄 events synced:", snapshot.size);
  });
}

/* ===============================
   RENDER
=============================== */
function formatDate(d) {
  const x = new Date(d);
  return `${String(x.getFullYear()).slice(2)}.${String(
    x.getMonth() + 1
  ).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}

function renderEventCard(eventId, e) {
  // 🔥 방어
  if (!e.createdAt) return;

  const row = document.createElement("div");
  row.className = "event-row event-card";
  row.dataset.id = eventId;

  row.innerHTML = `
    <div class="event-left">${e.logo}</div>
    <div class="event-center">
      <h2>${e.title}</h2>
      <div class="location">${e.location ?? ""}</div>
      <div class="date">
        ${formatDate(e.start)} ~ ${formatDate(e.end)}
      </div>
    </div>
    <button class="detail-btn">자세히 보기 →</button>
  `;

  // ✅ 카드 전체 클릭 → index 이동
  row.addEventListener("click", () => {
    console.log("👉 go index:", eventId);
    location.href = `index.html?eventId=${eventId}`;
  });

  eventListEl.appendChild(row);
}
