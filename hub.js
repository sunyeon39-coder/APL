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

  /* DOM */
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

  let currentUser = null;
  let tournaments = [];

  /* MENU */
  menuBtn.onclick = () => {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  };

  overlay.onclick = () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  };
  /* ===============================
   PROFILE
=============================== */
const profileBtn = document.getElementById("profileBtn");

if (profileBtn) {
  profileBtn.addEventListener("click", () => {
    // 1안: 프로필 페이지로 이동
    location.href = "profile.html";

    // 2안 (원하면): 모달 열기
    // openProfileModal();
  });
}


  /* AUTH */
  onAuthStateChanged(auth, user => {
    if (!user) return;
    currentUser = user;
  });

  /* RENDER */
  function render() {
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
      row.onclick = () => {
        location.href = `index.html?eventId=${t.id}`;
      };
      tournamentListEl.appendChild(row);
    });
  }

  /* FIRESTORE */
  const eventsRef = collection(db, "events");
  onSnapshot(
    query(eventsRef, orderBy("createdAt", "desc")),
    snap => {
      tournaments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    }
  );

  /* MODAL */
  createEventBtn.onclick = () => {
    eventModal.classList.remove("hidden");
  };

  eventCancelBtn.onclick = () => {
    eventModal.classList.add("hidden");
  };

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
      createdBy: currentUser?.uid || "temp"
    });

    eventName.value = "";
    eventLocation.value = "";
    eventStart.value = "";
    eventEnd.value = "";
    eventModal.classList.add("hidden");
  };

});
