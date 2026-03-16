import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("🔥 index.js loaded");

const APP_TIME_ZONE = "Asia/Seoul";

const root = document.getElementById("indexRoot");
const backBtn = document.getElementById("backBtn");
const topbarTournamentName = document.getElementById("topbarTournamentName");

const eventAdminBtn = document.getElementById("eventAdminBtn");
const eventAdminModal = document.getElementById("eventAdminModal");
const closeEventAdminBtn = document.getElementById("closeEventAdminBtn");

const eventCardSelect = document.getElementById("eventCardSelect");
const eventCardId = document.getElementById("eventCardId");
const eventCardBoxId = document.getElementById("eventCardBoxId");
const eventCardDate = document.getElementById("eventCardDate");
const eventCardTitle = document.getElementById("eventCardTitle");
const eventCardStart = document.getElementById("eventCardStart");
const eventCardClose = document.getElementById("eventCardClose");

const newEventCardBtn = document.getElementById("newEventCardBtn");
const saveEventCardBtn = document.getElementById("saveEventCardBtn");
const deleteEventCardBtn = document.getElementById("deleteEventCardBtn");
const eventCardList = document.getElementById("eventCardList");

let events = [];
let currentTournament = null;
let currentUserProfile = null;
let currentSeatAssignment = null;
let seatSummaryMap = new Map();

let stopTournamentWatch = null;
let stopMySeatNotificationWatch = null;
let stopEventsWatch = null;
let stopLayoutEventsWatch = null;
let periodBlocked = false;

/* ===============================
   ROUTE
=============================== */
function getTournamentId() {
  const params = new URLSearchParams(location.search);
  return (
    params.get("tournamentId") ||
    sessionStorage.getItem("tournamentId") ||
    params.get("eventId") ||
    sessionStorage.getItem("eventId") ||
    ""
  );
}

/* ===============================
   TIME HELPERS
=============================== */
function getNowPartsInAppTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function getNowInAppTime() {
  const p = getNowPartsInAppTimeZone();
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
}

function normalizeDateString(date) {
  return String(date || "").trim().replaceAll(".", "-").replaceAll("/", "-");
}

function parseDateTime(date, time) {
  const safeDate = normalizeDateString(date);
  const safeTime = String(time || "").trim();

  if (!safeDate || !safeTime) return null;

  const [yy, mm, dd] = safeDate.split("-").map(Number);
  const [hh, mi] = safeTime.split(":").map(Number);

  if (!yy || !mm || !dd) return null;
  if (!Number.isFinite(hh) || !Number.isFinite(mi)) return null;

  const d = new Date(yy, mm - 1, dd, hh, mi, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ===============================
   UTIL
=============================== */
function formatDateTitle(dateStr) {
  const safeDate = normalizeDateString(dateStr);
  const d = parseDateTime(safeDate, "00:00");
  if (!d) return String(dateStr || "Unknown Date");

  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric"
  });
}

function parseTournamentDate(str) {
  if (!str || typeof str !== "string") return null;

  const safe = normalizeDateString(str);
  const parts = safe.split("-");
  if (parts.length !== 3) return null;

  let yy = Number(parts[0]);
  const mm = Number(parts[1]);
  const dd = Number(parts[2]);

  if (!yy || !mm || !dd) return null;
  if (yy < 100) yy = 2000 + yy;

  return new Date(yy, mm - 1, dd, 23, 59, 59, 999);
}

function isTournamentActive(tournament) {
  if (!tournament) return true;

  const now = getNowInAppTime();
  const start = parseTournamentDate(tournament.startDate);
  const end = parseTournamentDate(tournament.endDate);

  if (!start || !end) return true;

  const startOfDay = new Date(start);
  startOfDay.setHours(0, 0, 0, 0);

  return !(now < startOfDay || now > end);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openModal(el) {
  el?.classList.add("show");
}

function closeModal(el) {
  el?.classList.remove("show");
}

function getStatus(date, start, close) {
  const now = getNowInAppTime();
  const startTime = parseDateTime(date, start);
  const closeTime = parseDateTime(date, close);

  if (!startTime || !closeTime) return "scheduled";

  const openTime = new Date(startTime.getTime() - 30 * 60 * 1000);

  if (now < openTime) return "scheduled";
  if (now >= openTime && now < startTime) return "opened";
  if (now >= startTime && now < closeTime) return "running";
  return "closed";
}

function getStatusLabel(status) {
  if (status === "scheduled") return "SCHEDULED";
  if (status === "opened") return "OPENED";
  if (status === "running") return "RUNNING";
  if (status === "closed") return "CLOSED";
  return "SCHEDULED";
}

function normalizeEvents(docs) {
  return docs
    .map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        boxId: String(data.boxId || "").trim(),
        date: normalizeDateString(data.date || ""),
        title: String(data.title || d.id).trim(),
        start: String(data.start || "").trim(),
        close: String(data.close || "").trim()
      };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start.localeCompare(b.start);
    });
}

function groupByDate(list) {
  const grouped = new Map();
  for (const item of list) {
    if (!grouped.has(item.date)) {
      grouped.set(item.date, []);
    }
    grouped.get(item.date).push(item);
  }
  return [...grouped.entries()];
}

/* ===============================
   SEAT SUMMARY
=============================== */
function buildSeatSummaryMap(docs) {
  const next = new Map();

  docs.forEach((d) => {
    const data = d.data() || {};
    const eventId = String(data.eventId || "").trim();
    const boxId = String(data.boxId || "").trim();
    const seats = Array.isArray(data.seats) ? data.seats : [];

    if (!eventId || !boxId) return;

    const totalSeats = seats.length;
    const occupiedSeats = seats.filter((seat) => {
      const person = String(seat?.person || "").trim();
      return person && person !== "비어있음";
    }).length;

    next.set(`${eventId}__${boxId}`, {
      totalSeats,
      occupiedSeats,
      emptySeats: Math.max(0, totalSeats - occupiedSeats)
    });
  });

  return next;
}

function getSeatSummary(eventId, boxId) {
  return seatSummaryMap.get(`${eventId}__${boxId}`) || {
    totalSeats: 0,
    occupiedSeats: 0,
    emptySeats: 0
  };
}

function formatSeatSummary(eventId, boxId) {
  const summary = getSeatSummary(eventId, boxId);

  if (summary.totalSeats <= 0) return "No Seats";
  return `${summary.totalSeats} Seats · ${summary.occupiedSeats} In Use`;
}

/* ===============================
   FIRESTORE EVENT REFS
=============================== */
function getEventsCollectionRef() {
  const tournamentId = getTournamentId();
  return collection(db, "tournaments", tournamentId, "events");
}

function getEventDocRef(eventId) {
  const tournamentId = getTournamentId();
  return doc(db, "tournaments", tournamentId, "events", eventId);
}

/* ===============================
   MY SEAT ASSIGNMENT WATCH
=============================== */
function bindMySeatAssignment(user) {
  if (!user) return;

  if (stopMySeatNotificationWatch) {
    stopMySeatNotificationWatch();
    stopMySeatNotificationWatch = null;
  }

  const ref = doc(db, "layout_notifications", user.uid);

  stopMySeatNotificationWatch = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        currentSeatAssignment = null;
        render();
        refreshCardStatuses();
        return;
      }

      const data = snap.data() || {};
      if (data.type !== "seat_assigned") {
        currentSeatAssignment = null;
        render();
        refreshCardStatuses();
        return;
      }

      currentSeatAssignment = {
        eventId: String(data.eventId || "").trim(),
        boxId: String(data.boxId || "").trim(),
        seatId: String(data.seatId || "").trim(),
        seatLabel: String(data.seatLabel || "").trim(),
        eventTitle: String(data.eventTitle || "").trim(),
        targetUrl: String(data.targetUrl || "").trim(),
        acknowledged: data.acknowledged === true
      };

      render();
      refreshCardStatuses();
    },
    (err) => {
      console.error("bindMySeatAssignment error:", err);
    }
  );
}

/* ===============================
   RENDER
=============================== */
function render() {
  if (!root) return;

  root.innerHTML = "";

  if (!events.length) {
    root.innerHTML = `
      <div class="date-header">
        <div class="date-title">No events</div>
        <div class="date-count">0 events</div>
      </div>
    `;
    return;
  }

  const groups = groupByDate(events);

  groups.forEach(([date, list]) => {
    const header = document.createElement("section");
    header.className = "date-header";
    header.innerHTML = `
      <div class="date-title">${escapeHtml(formatDateTitle(date))}</div>
      <div class="date-count">${list.length} events</div>
    `;
    root.appendChild(header);

    list.forEach((e) => {
      const status = getStatus(e.date, e.start, e.close);
      const seatSummaryText = formatSeatSummary(e.id, e.boxId);

      const assignedHere =
        currentSeatAssignment &&
        currentSeatAssignment.eventId === e.id &&
        currentSeatAssignment.boxId === e.boxId;

      const assignmentBadge = assignedHere
        ? `<div class="my-seat-badge">내 배치됨 · Seat ${escapeHtml(currentSeatAssignment.seatLabel || "")}</div>`
        : "";

      const card = document.createElement("div");
      card.className = `event-card ${status}`;
      card.dataset.date = e.date;
      card.dataset.start = e.start;
      card.dataset.close = e.close;
      card.dataset.eventId = e.id;
      card.dataset.boxId = e.boxId;

      card.innerHTML = `
        <div class="event-header">
          <div>
            <div class="event-title">${escapeHtml(e.title)}</div>
            ${assignmentBadge}
          </div>
          <span class="pill ${status}">${escapeHtml(getStatusLabel(status))}</span>
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
            <div class="entries-table">${escapeHtml(seatSummaryText)}</div>
          </div>
        </div>
      `;

      root.appendChild(card);
    });
  });
}

function refreshCardStatuses() {
  document.querySelectorAll(".event-card").forEach((card) => {
    const status = getStatus(
      card.dataset.date,
      card.dataset.start,
      card.dataset.close
    );

    card.classList.remove("scheduled", "opened", "running", "closed");
    card.classList.add(status);

    const pill = card.querySelector(".pill");
    if (pill) {
      pill.className = `pill ${status}`;
      pill.textContent = getStatusLabel(status);
    }
  });
}

/* ===============================
   ADMIN MODAL HELPERS
=============================== */
function resetEventForm() {
  eventCardId.value = "";
  eventCardBoxId.value = "";
  eventCardDate.value = "";
  eventCardTitle.value = "";
  eventCardStart.value = "";
  eventCardClose.value = "";
}

function makeNextEventDefaults() {
  const nextNo = events.length + 1;
  const tournamentId = getTournamentId();
  const now = getNowInAppTime();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  eventCardId.value = `event_${nextNo}`;
  eventCardBoxId.value = `box_${nextNo}`;
  eventCardDate.value = `${yyyy}-${mm}-${dd}`;
  eventCardTitle.value = `${tournamentId || "Event"} ${nextNo}`;
  eventCardStart.value = "21:00";
  eventCardClose.value = "21:30";
}

function syncSelectedEventForm() {
  const selected = events.find((e) => e.id === eventCardSelect.value);

  if (!selected) {
    resetEventForm();
    return;
  }

  eventCardId.value = selected.id || "";
  eventCardBoxId.value = selected.boxId || "";
  eventCardDate.value = selected.date || "";
  eventCardTitle.value = selected.title || "";
  eventCardStart.value = selected.start || "";
  eventCardClose.value = selected.close || "";
}

function populateEventSelect(preferredId = "") {
  if (!eventCardSelect) return;

  if (!events.length) {
    eventCardSelect.innerHTML = `<option value="">카드 없음</option>`;
    resetEventForm();
    return;
  }

  eventCardSelect.innerHTML = events.map((e) => `
    <option value="${escapeHtml(e.id)}">${escapeHtml(e.title)} (${escapeHtml(e.start)})</option>
  `).join("");

  const targetId = preferredId && events.some((e) => e.id === preferredId)
    ? preferredId
    : events[0].id;

  eventCardSelect.value = targetId;
  syncSelectedEventForm();
}

function renderEventAdminList() {
  if (!eventCardList) return;

  if (!events.length) {
    eventCardList.innerHTML = `<div class="empty-list">카드가 없습니다.</div>`;
    return;
  }

  eventCardList.innerHTML = events.map((e) => `
    <div class="event-admin-row" data-id="${escapeHtml(e.id)}">
      <div class="event-admin-main">
        <div class="event-admin-name">${escapeHtml(e.title)}</div>
        <div class="event-admin-meta">
          ${escapeHtml(e.date)} · ${escapeHtml(e.start)} ~ ${escapeHtml(e.close)} · ${escapeHtml(e.boxId)}
        </div>
      </div>
      <button class="event-admin-pick" type="button" data-pick-id="${escapeHtml(e.id)}">선택</button>
    </div>
  `).join("");
}

/* ===============================
   LOAD / WATCH EVENTS
=============================== */
async function loadEvents() {
  const snap = await getDocs(getEventsCollectionRef());
  events = normalizeEvents(snap.docs);
}

function bindEventsRealtime() {
  if (stopEventsWatch) {
    stopEventsWatch();
    stopEventsWatch = null;
  }

  stopEventsWatch = onSnapshot(
    getEventsCollectionRef(),
    (snap) => {
      events = normalizeEvents(snap.docs);
      render();
      refreshCardStatuses();

      if (eventCardSelect && eventAdminModal?.classList.contains("show")) {
        const selectedId = eventCardId?.value?.trim() || eventCardSelect.value || "";
        populateEventSelect(selectedId);
        renderEventAdminList();
      }
    },
    (err) => {
      console.error("bindEventsRealtime error:", err);
    }
  );
}

function bindLayoutSeatSummaryRealtime() {
  if (stopLayoutEventsWatch) {
    stopLayoutEventsWatch();
    stopLayoutEventsWatch = null;
  }

  stopLayoutEventsWatch = onSnapshot(
    collection(db, "layout_events"),
    (snap) => {
      seatSummaryMap = buildSeatSummaryMap(snap.docs);
      render();
      refreshCardStatuses();
    },
    (err) => {
      console.error("bindLayoutSeatSummaryRealtime error:", err);
    }
  );
}

/* ===============================
   SAVE / DELETE EVENT CARD
=============================== */
async function saveEventCard() {
  const id = eventCardId.value.trim();

  if (!id) {
    alert("카드 ID를 입력하세요.");
    return;
  }

  try {
    await setDoc(
      getEventDocRef(id),
      {
        boxId: eventCardBoxId.value.trim(),
        date: normalizeDateString(eventCardDate.value.trim()),
        title: eventCardTitle.value.trim(),
        start: eventCardStart.value.trim(),
        close: eventCardClose.value.trim()
      },
      { merge: true }
    );

    alert("카드가 저장되었습니다.");
  } catch (err) {
    console.error(err);
    alert("카드 저장에 실패했습니다.");
  }
}

async function deleteEventCardCurrent() {
  const id = eventCardId.value.trim();

  if (!id) {
    alert("삭제할 카드가 없습니다.");
    return;
  }

  const ok = confirm(`"${id}" 카드를 삭제할까요?`);
  if (!ok) return;

  try {
    await deleteDoc(getEventDocRef(id));
    alert("카드가 삭제되었습니다.");
  } catch (err) {
    console.error(err);
    alert("카드 삭제에 실패했습니다.");
  }
}

/* ===============================
   TOURNAMENT PERIOD GUARD
=============================== */
function routeToHub(message) {
  if (periodBlocked) return;
  periodBlocked = true;

  if (message) alert(message);
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
      topbarTournamentName.textContent = currentTournament.name || "Tournament Events";
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
          topbarTournamentName.textContent = currentTournament.name || "Tournament Events";
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
   SHARED WAITING
=============================== */
async function isUserAlreadySeated(userUid) {
  if (!userUid) return false;

  try {
    const snap = await getDocs(collection(db, "layout_events"));

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const seats = Array.isArray(data.seats) ? data.seats : [];

      const found = seats.some((seat) => {
        if (!seat || typeof seat !== "object") return false;
        return String(seat.personUid || "").trim() === String(userUid).trim();
      });

      if (found) return true;
    }

    return false;
  } catch (err) {
    console.error("❌ isUserAlreadySeated error:", err);
    return false;
  }
}

async function autoJoinSharedWaitingOnIndex(user) {
  const tournamentId = getTournamentId();
  if (!user || !tournamentId) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userProfile = userSnap.data() || {};
    currentUserProfile = userProfile;

    if (userProfile.role === "admin") return;

    const nickname = String(userProfile.nickname || "").trim();
    const email = String(userProfile.email || user.email || "").trim();
    if (!nickname) return;

    const waitingRef = doc(db, "layout_shared", "global_waiting");
    const alreadySeated = await isUserAlreadySeated(user.uid);
    if (alreadySeated) return;

    const waitingSnap = await getDoc(waitingRef);
    const waitingState = waitingSnap.exists()
      ? (waitingSnap.data() || {})
      : { version: 2, waiting: [], updatedAt: Date.now() };

    const waitingList = Array.isArray(waitingState.waiting)
      ? waitingState.waiting
      : [];

    const alreadyInWaiting = waitingList.some((item) => {
      if (!item || typeof item !== "object") return false;
      return item.uid && item.uid === user.uid;
    });

    if (alreadyInWaiting) return;

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

  location.href = `layout.html?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}&boxId=${encodeURIComponent(boxId)}`;
});

/* ===============================
   BACK
=============================== */
backBtn?.addEventListener("click", () => {
  sessionStorage.removeItem("boxId");
  location.href = "./hub.html";
});

/* ===============================
   EVENT ADMIN MODAL
=============================== */
eventAdminBtn?.addEventListener("click", async () => {
  await loadEvents();
  populateEventSelect();
  renderEventAdminList();
  openModal(eventAdminModal);
});

closeEventAdminBtn?.addEventListener("click", () => {
  closeModal(eventAdminModal);
});

eventAdminModal?.addEventListener("click", (e) => {
  if (e.target === eventAdminModal) {
    closeModal(eventAdminModal);
  }
});

eventCardSelect?.addEventListener("change", syncSelectedEventForm);

newEventCardBtn?.addEventListener("click", () => {
  resetEventForm();
  makeNextEventDefaults();
});

saveEventCardBtn?.addEventListener("click", saveEventCard);
deleteEventCardBtn?.addEventListener("click", deleteEventCardCurrent);

eventCardList?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pick-id]");
  if (!btn) return;

  eventCardSelect.value = btn.dataset.pickId;
  syncSelectedEventForm();
});

/* ===============================
   INIT
=============================== */
async function init() {
  await loadEvents();
  render();
  refreshCardStatuses();
  bindEventsRealtime();
  bindLayoutSeatSummaryRealtime();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("./login.html");
    return;
  }

  bindMySeatAssignment(user);

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  currentUserProfile = userSnap.exists() ? (userSnap.data() || {}) : null;

  if (currentUserProfile?.role === "admin") {
    eventAdminBtn?.classList.remove("hidden");
  }

  await initTournamentPeriodWatch();
  await autoJoinSharedWaitingOnIndex(user);
  await init();
});

setInterval(() => {
  refreshCardStatuses();
}, 1000);

setInterval(() => {
  if (currentTournament && !isTournamentActive(currentTournament)) {
    routeToHub("대회 기간이 종료되어 허브로 이동합니다.");
  }
}, 60000);

window.addEventListener("beforeunload", () => {
  if (stopTournamentWatch) stopTournamentWatch();
  if (stopMySeatNotificationWatch) stopMySeatNotificationWatch();
  if (stopEventsWatch) stopEventsWatch();
  if (stopLayoutEventsWatch) stopLayoutEventsWatch();
});
