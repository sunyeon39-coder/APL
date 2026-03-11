import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("🔥 index.js loaded");

const root = document.getElementById("indexRoot");
const backBtn = document.getElementById("backBtn");
const topbarTournamentName = document.getElementById("topbarTournamentName");

/* ===============================
   테스트 이벤트 데이터
=============================== */
const events = [
  {
    id: "event_1",
    boxId: "box_1",
    date: "2026-02-11",
    title: "#52 Closer Event – Monster Stack",
    start: "21:50",
    close: "22:20"
  },
  {
    id: "event_2",
    boxId: "box_2",
    date: "2026-02-11",
    title: "King's Debut Open DAY 1/C",
    start: "21:30",
    close: "21:33"
  },
  {
    id: "event_3",
    boxId: "box_3",
    date: "2026-02-11",
    title: "Mini Main Day-1E",
    start: "22:10",
    close: "23:00"
  }
];

/* ===============================
   ROUTE
=============================== */
function getTournamentId() {
  const params = new URLSearchParams(location.search);
  return params.get("eventId") || sessionStorage.getItem("eventId") || "";
}

/* ===============================
   UTIL
=============================== */
function parseDateTime(date, time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}

function formatDateTitle(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric"
  });
}

function parseTournamentDate(str) {
  if (!str || typeof str !== "string") return null;

  const parts = str.split(".");
  if (parts.length !== 3) return null;

  const [yy, mm, dd] = parts.map(Number);
  if (!yy || !mm || !dd) return null;

  const fullYear = 2000 + yy;
  return new Date(fullYear, mm - 1, dd, 23, 59, 59, 999);
}

function isTournamentActive(tournament) {
  if (!tournament) return true;

  const now = new Date();
  const start = parseTournamentDate(tournament.startDate);
  const end = parseTournamentDate(tournament.endDate);

  if (!start || !end) return true;

  const startOfDay = new Date(start);
  startOfDay.setHours(0, 0, 0, 0);

  if (now < startOfDay) return false;
  if (now > end) return false;

  return true;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ===============================
   STATUS
=============================== */
function calcStatus(card) {
  const now = new Date();
  const date = card.dataset.date;
  const start = parseDateTime(date, card.dataset.start);
  const close = parseDateTime(date, card.dataset.close);

  const pill = card.querySelector(".pill");
  if (!pill) return;

  card.classList.remove("scheduled", "opened", "running", "closed");

  const openTime = new Date(start.getTime() - 30 * 60 * 1000);

  if (now < openTime) {
    card.classList.add("scheduled");
    pill.textContent = "SCHEDULED";
    pill.className = "pill scheduled";
  } else if (now >= openTime && now < start) {
    card.classList.add("opened");
    pill.textContent = "OPENED";
    pill.className = "pill opened";
  } else if (now >= start && now < close) {
    card.classList.add("running");
    pill.textContent = "RUNNING";
    pill.className = "pill running";
  } else {
    card.classList.add("closed");
    pill.textContent = "CLOSED";
    pill.className = "pill closed";
  }
}

/* ===============================
   RENDER
=============================== */
function render() {
  if (!root) {
    console.warn("❌ indexRoot not found");
    return;
  }

  root.innerHTML = "";

  const grouped = {};

  events.forEach((e) => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  Object.entries(grouped).forEach(([date, list]) => {
    const header = document.createElement("div");
    header.className = "date-header";
    header.innerHTML = `
      <div class="date-title">${formatDateTitle(date)}</div>
      <div class="date-count">${list.length} events</div>
    `;
    root.appendChild(header);

    list.forEach((e) => {
      const card = document.createElement("div");
      card.className = "event-card";
      card.dataset.date = e.date;
      card.dataset.start = e.start;
      card.dataset.close = e.close;
      card.dataset.eventId = e.id;
      card.dataset.boxId = e.boxId;

      card.innerHTML = `
        <div class="event-header">
          <div class="event-title">${escapeHtml(e.title)}</div>
          <span class="pill"></span>
        </div>

        <div class="event-info">
          <div class="info-box">
            <div class="info-label">Time</div>
            ${escapeHtml(e.start)}
          </div>

          <div class="info-box">
            <div class="info-label">Reg Closes</div>
            ${escapeHtml(e.close)}
          </div>

          <div class="info-box">
            <div class="info-label">Table</div>
            <div class="entries-table">Seats Table</div>
          </div>
        </div>
      `;

      root.appendChild(card);
      calcStatus(card);
    });
  });
}

/* ===============================
   TOURNAMENT PERIOD GUARD
=============================== */
let currentTournament = null;
let stopTournamentWatch = null;
let periodBlocked = false;

function routeToHub(message) {
  if (periodBlocked) return;
  periodBlocked = true;

  if (message) {
    alert(message);
  }

  location.replace("./hub.html");
}

async function initTournamentPeriodWatch() {
  const tournamentId = getTournamentId();

  if (!tournamentId) {
    if (topbarTournamentName) {
      topbarTournamentName.textContent = "Tournament Events";
    }
    return;
  }

  sessionStorage.setItem("tournamentId", tournamentId);

  const tournamentRef = doc(db, "tournaments", tournamentId);

  try {
    const snap = await getDoc(tournamentRef);

    if (!snap.exists()) {
      if (topbarTournamentName) {
        topbarTournamentName.textContent = "Tournament Events";
      }
      return;
    }

    currentTournament = {
      id: snap.id,
      ...(snap.data() || {})
    };

    if (topbarTournamentName) {
      topbarTournamentName.textContent =
        currentTournament.name || "Tournament Events";
    }

    if (!isTournamentActive(currentTournament)) {
      routeToHub("대회 기간이 아니거나 종료되어 허브로 이동합니다.");
      return;
    }

    stopTournamentWatch = onSnapshot(
      tournamentRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          routeToHub("대회 정보가 없어 허브로 이동합니다.");
          return;
        }

        currentTournament = {
          id: docSnap.id,
          ...(docSnap.data() || {})
        };

        if (topbarTournamentName) {
          topbarTournamentName.textContent =
            currentTournament.name || "Tournament Events";
        }

        if (!isTournamentActive(currentTournament)) {
          routeToHub("대회 기간이 종료되어 허브로 이동합니다.");
        }
      },
      (error) => {
        console.error("❌ tournament watch error:", error);
      }
    );
  } catch (error) {
    console.error("❌ initTournamentPeriodWatch error:", error);
  }
}

/* ===============================
   SHARED WAITING (FIRESTORE)
   admin은 자동등록 제외
   uid 기준 중복 방지
=============================== */
async function autoJoinSharedWaitingOnIndex(user) {
  const tournamentId = getTournamentId();
  if (!user || !tournamentId) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn("❌ user profile not found");
      return;
    }

    const userProfile = userSnap.data() || {};
    console.log("INDEX role check:", userProfile.role, user.uid, user.email);

    if (userProfile.role === "admin") {
      console.log("ℹ️ admin user - skip auto waiting join");
      return;
    }

    const nickname = String(userProfile.nickname || "").trim();
    const email = String(userProfile.email || user.email || "").trim();

    console.log("INDEX nickname/email:", nickname, email);

    if (!nickname) {
      console.warn("❌ nickname missing");
      return;
    }

    const waitingRef = doc(db, "layout_shared", "global_waiting");
    console.log("INDEX auto waiting target:", waitingRef.path);

    const waitingSnap = await getDoc(waitingRef);

    const waitingState = waitingSnap.exists()
      ? (waitingSnap.data() || {})
      : {
          version: 2,
          waiting: [],
          updatedAt: Date.now()
        };

    const waitingList = Array.isArray(waitingState.waiting)
      ? waitingState.waiting
      : [];

    const alreadyInWaiting = waitingList.some((item) => {
      if (!item || typeof item !== "object") return false;
      if (item.uid && item.uid === user.uid) return true;
      return false;
    });

    console.log("INDEX alreadyInWaiting:", alreadyInWaiting);

    if (alreadyInWaiting) {
      console.log("ℹ️ already in shared waiting:", nickname);
      return;
    }

    waitingList.push({
      id: `w_${user.uid}`,
      uid: user.uid,
      email,
      name: nickname,
      addedAt: Date.now(),
      source: "auto",
      tournamentId
    });

    await setDoc(
      waitingRef,
      {
        ...waitingState,
        version: 2,
        waiting: waitingList,
        updatedAt: Date.now()
      },
      { merge: true }
    );
console.log("INDEX role check:", userProfile.role, user.uid, user.email);
    console.log("✅ shared waiting joined:", nickname);
  } catch (error) {
    console.error("❌ autoJoinSharedWaitingOnIndex error:", error);
  }
}

/* ===============================
   CLICK → LAYOUT
=============================== */
root?.addEventListener("click", (e) => {
  const card = e.target.closest(".event-card");
  if (!card) return;

  if (currentTournament && !isTournamentActive(currentTournament)) {
    routeToHub("대회 기간이 종료되어 허브로 이동합니다.");
    return;
  }

  const tournamentId = getTournamentId();
  const eventId = card.dataset.eventId;
  const boxId = card.dataset.boxId;

  if (!eventId || !boxId) {
    console.warn("❌ Missing eventId or boxId");
    return;
  }

  sessionStorage.setItem("tournamentId", tournamentId);
  sessionStorage.setItem("eventId", eventId);
  sessionStorage.setItem("boxId", boxId);

  location.href =
    `layout.html?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}&boxId=${encodeURIComponent(boxId)}`;
});

/* ===============================
   BACK
=============================== */
backBtn?.addEventListener("click", () => {
  sessionStorage.removeItem("boxId");
  location.href = "./hub.html";
});

/* ===============================
   AUTH
=============================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("./login.html");
    return;
  }

  await initTournamentPeriodWatch();
  await autoJoinSharedWaitingOnIndex(user);
});

/* ===============================
   INIT
=============================== */
render();

setInterval(() => {
  document.querySelectorAll(".event-card").forEach(calcStatus);
}, 1000);

setInterval(() => {
  if (currentTournament && !isTournamentActive(currentTournament)) {
    routeToHub("대회 기간이 종료되어 허브로 이동합니다.");
  }
}, 60000);

window.addEventListener("beforeunload", () => {
  if (stopTournamentWatch) stopTournamentWatch();
});