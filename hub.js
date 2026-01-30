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

document.addEventListener("DOMContentLoaded", () => {

  /* ===============================
     DOM
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

  /* ===============================
     STATE
  =============================== */
  let currentUser = null;
  let currentUserRole = "admin"; // 🔥 일단 강제 admin (기존 기능 확인용)
  let tournaments = [];

  /* ===============================
     MENU (≡)
  =============================== */
  if (menuBtn && sideMenu && overlay) {
    menuBtn.onclick = () => {
      sideMenu.classList.add("open");
      overlay.classList.add("show");
    };

    overlay.onclick = () => {
      sideMenu.classList.remove("open");
      overlay.classList.remove("show");
    };
  }

  /* ===============================
     AUTH
  =============================== */
  onAuthStateChanged(auth, user => {
    if (!user) return;
    currentUser = user;
    createEventBtn.classList.remove("hidden");
  });

  /* ===============================
     RENDER
  =============================== */
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

      row.onclick = () => {
        location.href = `index.html?eventId=${t.id}`;
      };

      tournamentListEl.appendChild(row);
    });
  }

  /* ===============================
     FIRESTORE (에러 가드 포함)
  =============================== */
  try {
    const eventsRef = collection(db, "events");

    onSnapshot(
      query(eventsRef, orderBy("createdAt", "desc")),
      snap => {
        tournaments = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        renderTournaments();
      },
      err => {
        console.error("🔥 snapshot error", err);
      }
    );
  } catch (e) {
    console.error("🔥 firestore init error", e);
  }

  /* ===============================
     EVENT MODAL
  =============================== */
  if (createEventBtn) {
    createEventBtn.onclick = () => {
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

      await addDoc(collection(db, "events"), {
        name: eventName.value,
        location: eventLocation.value,
        start: eventStart.value,
        end: eventEnd.value,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || "test"
      });

      eventName.value = "";
      eventLocation.value = "";
      eventStart.value = "";
      eventEnd.value = "";

      eventModal.classList.add("hidden");
    };
  }

});
