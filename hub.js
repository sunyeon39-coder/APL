import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================
   DOM
========================= */
const tournamentListEl = document.getElementById("tournamentList");
const tournamentEmptyEl = document.getElementById("tournamentEmpty");
const createEventBtn = document.getElementById("createEventBtn");

const eventModal = document.getElementById("eventModal");
const eventName = document.getElementById("eventName");
const eventLocation = document.getElementById("eventLocation");
const eventStart = document.getElementById("eventStart");
const eventEnd = document.getElementById("eventEnd");
const eventSaveBtn = document.getElementById("eventSaveBtn");
const eventCancelBtn = document.getElementById("eventCancelBtn");

/* =========================
   STATE
========================= */
let currentUser = null;
let currentUserRole = "user"; // 기본
let tournaments = [];

/* =========================
   FIRESTORE
========================= */
const eventsRef = collection(db, "events");

/* =========================
   AUTH + ROLE
========================= */
onAuthStateChanged(auth, user => {
  if (!user) return;

  currentUser = user;

  // 🔥 임시 규칙: 이메일로 admin 판별
  if (user.email?.includes("admin")) {
    currentUserRole = "admin";
    createEventBtn.classList.remove("hidden");
  }

  bindEvents();
});

/* =========================
   RENDER
========================= */
function renderTournaments() {
  tournamentListEl.innerHTML = "";

  if (tournaments.length === 0) {
    tournamentEmptyEl.style.display = "block";
    return;
  }

  tournamentEmptyEl.style.display = "none";

  tournaments.forEach(t => {
    const row = document.createElement("div");
    row.className = "tournament-row";
    row.innerHTML = `
      <h3>${t.name}</h3>
      <div class="location">${t.location}</div>
      <div class="date">${t.start} ~ ${t.end}</div>
    `;

    // ✅ STEP 2: 클릭 → index 진입
    row.onclick = () => {
      location.href = `index.html?eventId=${t.id}`;
    };

    tournamentListEl.appendChild(row);
  });
}

/* =========================
   FIRESTORE LISTEN
========================= */
onSnapshot(
  query(eventsRef, orderBy("createdAt", "desc")),
  snap => {
    tournaments = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    renderTournaments();
  }
);

/* =========================
   EVENTS
========================= */
function bindEvents() {
  if (createEventBtn) {
    createEventBtn.onclick = () => {
      if (currentUserRole !== "admin") return;
      eventModal.classList.remove("hidden");
    };
  }

  if (eventCancelBtn) {
    eventCancelBtn.onclick = () => {
      eventModal.classList.add("hidden");
    };
  }

  if (eventSaveBtn) {
    eventSaveBtn.onclick = async () => {
      if (!eventName.value) {
        alert("대회명을 입력하세요");
        return;
      }

      await addDoc(eventsRef, {
        name: eventName.value,
        location: eventLocation.value,
        start: eventStart.value,
        end: eventEnd.value,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });

      eventName.value = "";
      eventLocation.value = "";
      eventStart.value = "";
      eventEnd.value = "";

      eventModal.classList.add("hidden");
    };
  }
}
