import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===============================
   DOM (즉시)
=============================== */
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

const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const profileBtn = document.getElementById("profileBtn");

/* ===============================
   SAFE INIT
=============================== */
sideMenu?.classList.remove("open");
overlay?.classList.remove("show");

/* ===============================
   STATE
=============================== */
let currentUser = null;
let tournaments = [];

/* ===============================
   MENU (≡)
=============================== */
if (menuBtn && sideMenu && overlay) {
  menuBtn.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  });

  overlay.addEventListener("click", () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  });
}

/* ===============================
   PROFILE
=============================== */
if (profileBtn) {
  profileBtn.addEventListener("click", () => {
    location.href = "profile.html";
  });
}

/* ===============================
   AUTH
=============================== */
onAuthStateChanged(auth, user => {
  if (!user) return;
  currentUser = user;
});

/* ===============================
   RENDER
=============================== */
function renderTournaments() {
  if (!tournamentListEl || !tournamentEmptyEl) return;

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
      <div class="location">${t.location || ""}</div>
      <div class="date">${t.start || ""} ~ ${t.end || ""}</div>
    `;
    row.addEventListener("click", () => {
      location.href = `index.html?eventId=${t.id}`;
    });
    tournamentListEl.appendChild(row);
  });
}

/* ===============================
   FIRESTORE
=============================== */
try {
  const eventsRef = collection(db, "events");
  onSnapshot(
    query(eventsRef, orderBy("createdAt", "desc")),
    snap => {
      tournaments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTournaments();
    },
    err => console.error("🔥 snapshot error", err)
  );

  /* ===============================
     MODAL
  =============================== */
  if (createEventBtn && eventModal) {
    createEventBtn.addEventListener("click", () => {
      eventModal.classList.remove("hidden");
    });
  }

  if (eventCancelBtn && eventModal) {
    eventCancelBtn.addEventListener("click", () => {
      eventModal.classList.add("hidden");
    });
  }

  if (eventSaveBtn) {
    eventSaveBtn.addEventListener("click", async () => {
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
        createdBy: currentUser?.uid || "temp"
      });

      eventName.value = "";
      eventLocation.value = "";
      eventStart.value = "";
      eventEnd.value = "";

      eventModal.classList.add("hidden");
    });
  }

} catch (e) {
  console.error("🔥 firestore init error", e);
}
