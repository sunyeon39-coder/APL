/* BoxBoard layout.js
   - seats: 이벤트별 분리 저장 (eventId + boxId)
   - waiting: 전역 공유
   - ✅ waiting/seat 각각 독립 타이머
   - ✅ 30/60/90/120분 경과 색: 초록/노랑/주황/빨강
   - ✅ PC 캔버스 seat 더블클릭 => 사람 빼기(전역 대기 복귀)
   - ✅ Seat 라벨 커스텀(숫자/영어/텍스트)
*/

(() => {
  "use strict";

  /* ===============================
     DOM
  =============================== */
  const app = document.getElementById("app");
  const menuBtn = document.getElementById("menuBtn");
  const backBtn = document.getElementById("backBtn");
  const pcPanel = document.getElementById("pcPanel");
  const panelContent = document.getElementById("panelContent");
  const mobileSheet = document.getElementById("mobileSheet");

  const mobileAddSeatBtn = document.getElementById("mobileAddSeat");
  const mobileAddWaitingBtn = document.getElementById("mobileAddWaiting");

  const tabs = Array.from(document.querySelectorAll(".tab"));

  /* ===============================
     DEVICE
  =============================== */
  const isMobile = () => window.innerWidth <= 900;

  /* ===============================
     ROUTE
  =============================== */
  function getParam(name) {
    const params = new URLSearchParams(location.search);
    return params.get(name) || sessionStorage.getItem(name) || "";
  }
  const EVENT_ID = getParam("eventId") || "default";
  const BOX_ID = getParam("boxId") || "default";

  /* ===============================
     STORAGE KEYS
  =============================== */
  const EVENT_KEY = `boxboard_event_${EVENT_ID}__${BOX_ID}_v2`; // v2 (timer 필드 추가)
  const WAITING_KEY = `boxboard_waiting_global_v2`;

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function loadEventState() {
    const raw = localStorage.getItem(EVENT_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  }

  function loadWaitingState() {
    const raw = localStorage.getItem(WAITING_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  }

 // ✅ 모든 이벤트의 seat 점유 현황을 localStorage에서 스캔 (seatedAt 포함)
function scanAllSeatOccupancy() {
  const items = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;

    // 우리가 쓰는 이벤트 저장 키만 대상으로
    // 예: boxboard_event_<eventId>__<boxId>_v2
    if (!k.startsWith("boxboard_event_")) continue;
    if (!k.endsWith("_v2")) continue;

    const raw = localStorage.getItem(k);
    const st = raw ? safeParse(raw) : null;
    if (!st || !Array.isArray(st.seats)) continue;

    const evId = st.eventId || "(event?)";
    const bxId = st.boxId || "(box?)";

    st.seats.forEach(seat => {
      const person = (seat && seat.person) ? String(seat.person) : "";
      if (!person || person === "비어있음") return;

      const label = seat.label ?? seat.no ?? "?";
      const seatedAt = Number(seat.seatedAt || 0) || Date.now(); // 없으면 지금으로 fallback

      items.push({
        name: person,
        eventId: evId,
        boxId: bxId,
        seatLabel: String(label),
        seatId: String(seat.id || ""),
        seatedAt
      });
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return items;
}

  function saveEventState() {
    try { localStorage.setItem(EVENT_KEY, JSON.stringify(eventState)); } catch {}
  }

  function saveWaitingState() {
    try { localStorage.setItem(WAITING_KEY, JSON.stringify(waitingState)); } catch {}
  }

  /* ===============================
     STATE
  =============================== */
  const eventState =
    loadEventState() || {
      version: 2,
      eventId: EVENT_ID,
      boxId: BOX_ID,
      nextSeatNo: 1,
      nextSeatOrder: 1,
      // seat: {id,label,no,order, person, seatedAt, x,y}
      seats: [],
      updatedAt: Date.now()
    };

  const waitingState =
    loadWaitingState() || {
      version: 2,
      // waiting: {id,name, addedAt}
      waiting: [],
      updatedAt: Date.now()
    };

  const ui = {
    activeTab: "wait",
    selectedSeatId: null,
    selectedWaitingId: null,
    dragging: null
  };

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
  }

  function touchEvent() {
    eventState.updatedAt = Date.now();
    saveEventState();
  }
  function touchWaiting() {
    waitingState.updatedAt = Date.now();
    saveWaitingState();
  }

  /* ===============================
     TIMER / COLOR
  =============================== */
  const MIN = 60 * 1000;
  const TH_30 = 30 * MIN;
  const TH_60 = 60 * MIN;
  const TH_90 = 90 * MIN;
  const TH_120 = 120 * MIN;

  function timerClass(ms) {
    if (ms < TH_30) return "t-green";
    if (ms < TH_60) return "t-yellow";
    if (ms < TH_90) return "t-orange";
    return "t-red"; // 90분 이상은 빨강(120 넘어도 계속 빨강)
  }

function fmtElapsed(ms) {
  ms = Math.max(0, ms | 0);

  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

  /* ===============================
     HELPERS
  =============================== */
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isEmptyPerson(p) {
    return !p || p === "비어있음";
  }

  // ✅ Seat에서 빼면 전역 대기로 복귀 (addedAt 새로 시작)
  function returnPersonToWaiting(name) {
    const n = String(name || "").trim();
    if (!n) return;
    waitingState.waiting.push({ id: uid("w"), name: n, addedAt: Date.now() });
    touchWaiting();
  }

  /* ===============================
     CORE - SEAT (event)
  =============================== */
  function promptSeatLabel(defaultLabel) {
    const msg = `Seat 라벨을 입력하세요 (숫자/영어/원하는 텍스트)\n예: 1, A, VIP, Table1`;
    const input = prompt(msg, defaultLabel);
    if (input === null) return null;
    const v = String(input).trim();
    return v || defaultLabel;
  }

  function addSeat() {
    const id = uid("seat");
    const no = eventState.nextSeatNo++;
    const order = eventState.nextSeatOrder++;

    const labelDefault = String(no);
    const label = promptSeatLabel(labelDefault);
    if (label === null) {
      eventState.nextSeatNo--;
      eventState.nextSeatOrder--;
      return;
    }

    const base = 60 + ((no - 1) % 6) * 200;
    const row = Math.floor((no - 1) / 6);
    const x = 40 + (base % 900);
    const y = 110 + row * 110;

    eventState.seats.push({
      id, label, no, order,
      person: "비어있음",
      seatedAt: null,
      x, y
    });

    touchEvent();
    render();
  }

  function renameSeat(seatId) {
    const s = eventState.seats.find(x => x.id === seatId);
    if (!s) return;
    const next = promptSeatLabel(String(s.label ?? s.no));
    if (next === null) return;
    s.label = next;
    touchEvent();
    render();
  }

  function deleteSeat(seatId) {
    const idx = eventState.seats.findIndex(s => s.id === seatId);
    if (idx < 0) return;

    const seat = eventState.seats[idx];

    if (!isEmptyPerson(seat.person)) {
      returnPersonToWaiting(seat.person);
    }

    eventState.seats.splice(idx, 1);
    if (ui.selectedSeatId === seatId) ui.selectedSeatId = null;
    touchEvent();
    render();
  }

  // ✅ 사람 빼기: 전역 대기로 보내고 Seat 비우기 + seatedAt 초기화
  function clearSeat(seatId) {
    const s = eventState.seats.find(x => x.id === seatId);
    if (!s) return;

    if (!isEmptyPerson(s.person)) {
      returnPersonToWaiting(s.person);
    }

    s.person = "비어있음";
    s.seatedAt = null;
    touchEvent();
    render();
  }

  /* ===============================
     CORE - WAITING (global)
  =============================== */
  function addWaiting(name) {
    const n = String(name || "").trim();
    if (!n) return;
    waitingState.waiting.push({ id: uid("w"), name: n, addedAt: Date.now() });
    touchWaiting();
    render();
  }

  function deleteWaiting(waitingId) {
    const idx = waitingState.waiting.findIndex(w => w.id === waitingId);
    if (idx >= 0) {
      waitingState.waiting.splice(idx, 1);
      if (ui.selectedWaitingId === waitingId) ui.selectedWaitingId = null;
      touchWaiting();
      render();
    }
  }

  // ✅ 전역 대기자 → Seat 배치 (Seat 타이머는 별개로 now부터 시작)
  function assignWaitingToSeat(waitingId, seatId) {
    const wIdx = waitingState.waiting.findIndex(w => w.id === waitingId);
    const seat = eventState.seats.find(s => s.id === seatId);
    if (wIdx < 0 || !seat) return;

    const w = waitingState.waiting[wIdx];

    // Seat에 기존 사람이 있으면 그 사람은 대기로 복귀(새 타이머)
    if (!isEmptyPerson(seat.person)) {
      returnPersonToWaiting(seat.person);
    }

    seat.person = w.name;
    seat.seatedAt = Date.now(); // ✅ 착석 타이머 시작

    // 전역 대기에서 제거
    waitingState.waiting.splice(wIdx, 1);
    ui.selectedWaitingId = null;

    touchWaiting();
    touchEvent();
    render();
  }

  /* ===============================
     RENDER
  =============================== */
  function render() {
    app.innerHTML = "";
    if (isMobile()) renderMobile();
    else renderPC();
    renderPanel();
    updateTimers(); // 렌더 직후 1회 반영
  }

  function renderPC() {
    const canvas = document.createElement("div");
    canvas.className = "canvas pc-canvas";
    canvas.innerHTML = `
      <div class="canvas-hint">
        <div class="hint-pill">EVENT: ${escapeHtml(EVENT_ID)}</div>
        <div class="hint-pill">BOX: ${escapeHtml(BOX_ID)}</div>
      </div>
    `;

    eventState.seats.forEach(seat => {
      const el = document.createElement("div");
      el.className = "seat-box" + (ui.selectedSeatId === seat.id ? " selected" : "");
      el.style.left = `${seat.x}px`;
      el.style.top = `${seat.y}px`;
      el.dataset.seatId = seat.id;

      // 타이머 칩(착석중일 때만)
      const hasPerson = !isEmptyPerson(seat.person);
      const start = hasPerson ? (seat.seatedAt || Date.now()) : null;

      el.innerHTML = `
        <div class="seat-title">Seat ${escapeHtml(seat.label ?? seat.no)}</div>
        <div class="seat-person">
          ${escapeHtml(seat.person)}
          ${
            hasPerson
              ? `<span class="time-chip" data-timer="seat" data-start="${start}" data-target="seat:${seat.id}">0분</span>`
              : ``
          }
        </div>
      `;

      // click: select / assign
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        ui.selectedSeatId = seat.id;

        if (ui.selectedWaitingId) {
          assignWaitingToSeat(ui.selectedWaitingId, seat.id);
          return;
        }
        render();
      });

      // ✅ dblclick: 사람 빼기
      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        clearSeat(seat.id);
      });

      // drag
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);

        ui.dragging = {
          id: seat.id,
          ox: e.clientX - seat.x,
          oy: e.clientY - seat.y
        };
      });

      el.addEventListener("pointermove", (e) => {
        if (!ui.dragging || ui.dragging.id !== seat.id) return;
        const s = eventState.seats.find(x => x.id === seat.id);
        if (!s) return;

        s.x = Math.max(10, Math.min(e.clientX - ui.dragging.ox, canvas.clientWidth - 200));
        s.y = Math.max(10, Math.min(e.clientY - ui.dragging.oy, canvas.clientHeight - 90));
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y}px`;
      });

      el.addEventListener("pointerup", () => {
        if (!ui.dragging || ui.dragging.id !== seat.id) return;
        ui.dragging = null;
        touchEvent();
      });

      canvas.appendChild(el);
    });

    canvas.addEventListener("click", () => {
      ui.selectedSeatId = null;
      render();
    });

    app.appendChild(canvas);
  }

  function renderMobile() {
    const wrap = document.createElement("div");
    wrap.className = "mobile";

    const seatCard = document.createElement("div");
    seatCard.className = "card";
    seatCard.innerHTML = `<h3>Seat 목록</h3>`;

    if (eventState.seats.length === 0) {
      seatCard.innerHTML += `<div class="row"><div>Seat</div><div class="muted">없음</div></div>`;
    } else {
      eventState.seats
        .slice()
        .sort((a, b) => (a.order ?? a.no) - (b.order ?? b.no))
        .forEach((s) => {
          const hasPerson = !isEmptyPerson(s.person);
          const start = hasPerson ? (s.seatedAt || Date.now()) : null;
          seatCard.innerHTML += `
            <div class="row">
              <div>Seat ${escapeHtml(s.label ?? s.no)}</div>
              <div>
                ${escapeHtml(s.person)}
                ${hasPerson ? `<span class="time-chip" data-timer="seat" data-start="${start}" data-target="seat:${s.id}">0분</span>` : ``}
              </div>
            </div>`;
        });
    }

    const waitCard = document.createElement("div");
    waitCard.className = "card";
    waitCard.innerHTML = `<h3>대기 (공유)</h3>`;

    if (waitingState.waiting.length === 0) {
      waitCard.innerHTML += `<div class="row"><div>대기</div><div class="muted">없음</div></div>`;
    } else {
      waitingState.waiting.forEach((w) => {
        const start = w.addedAt || Date.now();
        waitCard.innerHTML += `
          <div class="row">
            <div>
              ${escapeHtml(w.name)}
              <span class="time-chip" data-timer="wait" data-start="${start}" data-target="wait:${w.id}">0분</span>
            </div>
            <div class="muted">대기</div>
          </div>`;
      });
    }

    wrap.append(seatCard, waitCard);
    app.appendChild(wrap);
  }

  function renderPanel() {
    if (isMobile()) return;

    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === ui.activeTab));

    if (ui.activeTab === "wait") renderWaitPanel();
    else if (ui.activeTab === "seat") renderSeatPanel();
    else renderBoxPanel();
  }

  function renderWaitPanel() {
    const selected = ui.selectedWaitingId;
    const html = [];

    html.push(`<div class="panel-title">대기 관리 (공유)</div>`);
    html.push(`<input id="waitNameInput" placeholder="대기자 이름 입력" />`);
    html.push(`<button id="addWaitBtn" class="btn primary" style="width:100%; margin-bottom:12px;">+ 대기 추가</button>`);

    if (waitingState.waiting.length === 0) {
      html.push(`<div class="row"><div class="left"><div>대기자 없음</div><div class="badge">어떤 이벤트에서 추가해도 공유됩니다</div></div></div>`);
    } else {
      waitingState.waiting.forEach((w) => {
        const isSel = selected === w.id;
        const start = w.addedAt || Date.now();
        html.push(`
          <div class="row" data-wid="${w.id}" style="cursor:pointer;">
            <div class="left">
              <div style="font-weight:900;">${escapeHtml(w.name)}</div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <div class="badge ${isSel ? "sel" : ""}">${isSel ? "선택됨" : "클릭"}</div>
                <span class="time-chip" data-timer="wait" data-start="${start}" data-target="wait:${w.id}">0분</span>
              </div>
            </div>
            <button class="btn small danger" data-del-w="${w.id}">삭제</button>
          </div>
        `);
      });
    }

    panelContent.innerHTML = html.join("");

    const input = document.getElementById("waitNameInput");
    const addBtn = document.getElementById("addWaitBtn");

    addBtn.onclick = () => {
      addWaiting(input.value);
      input.value = "";
      input.focus();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addBtn.click();
    });

    panelContent.querySelectorAll("[data-wid]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target && e.target.matches("[data-del-w]")) return;
        const wid = el.getAttribute("data-wid");
        ui.selectedWaitingId = ui.selectedWaitingId === wid ? null : wid;
        ui.selectedSeatId = null;
        render();
      });
    });

    panelContent.querySelectorAll("[data-del-w]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteWaiting(btn.getAttribute("data-del-w"));
      });
    });
  }

  function renderSeatPanel() {
  const html = [];

  // ✅ 오른쪽 현황칸에 들어갈 데이터 만들기
  const seatedAll = scanAllSeatOccupancy();      // 전 이벤트 착석자
  const waitingAll = waitingState.waiting || []; // 전역 대기자(공유)

  // 왼쪽(Seat 관리)
  const left = [];
  left.push(`<div class="panel-title">Seat 관리 (이벤트별)</div>`);
  left.push(`<button id="addSeatBtn" class="btn primary" style="width:100%; margin-bottom:12px;">+ Seat 추가</button>`);
  left.push(`<div class="badge" style="margin-bottom:12px;">Seat 더블클릭 → 사람 빼기(대기 복귀) / 라벨은 "라벨" 버튼</div>`);

  if (eventState.seats.length === 0) {
    left.push(`<div class="row"><div class="left"><div>Seat 없음</div><div class="badge">현재 이벤트(${escapeHtml(EVENT_ID)})에만 생성됩니다</div></div></div>`);
  } else {
    eventState.seats
      .slice()
      .sort((a, b) => (a.order ?? a.no) - (b.order ?? b.no))
      .forEach((s) => {
        const isSel = ui.selectedSeatId === s.id;
        const hasPerson = !isEmptyPerson(s.person);
        const start = hasPerson ? (s.seatedAt || Date.now()) : null;

        left.push(`
          <div class="row" data-sid="${s.id}" style="cursor:pointer;">
            <div class="left">
              <div style="font-weight:900;">Seat ${escapeHtml(s.label ?? s.no)}</div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <div class="badge ${isSel ? "sel" : ""}">${escapeHtml(s.person)}</div>
                ${hasPerson ? `<span class="time-chip" data-timer="seat" data-start="${start}" data-target="seat:${s.id}">00:00:00</span>` : ``}
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn small" data-rename="${s.id}">라벨</button>
              <button class="btn small" data-clear="${s.id}">빼기</button>
              <button class="btn small danger" data-del="${s.id}">삭제</button>
            </div>
          </div>
        `);
      });
  }

  // 오른쪽(전역 현황)
  const right = [];
  right.push(`<div class="panel-box">`);
  right.push(`<h4>전역 현황 (대기/배치)</h4>`);

  // 1) 전역 대기자 리스트
  right.push(`<div class="badge" style="margin-bottom:8px;">대기: ${waitingAll.length}명</div>`);
  if (waitingAll.length === 0) {
    right.push(`<div class="mini-row"><div class="mini-left"><div class="mini-name">대기자 없음</div><div class="mini-loc">—</div></div></div>`);
  } else {
    waitingAll
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"))
      .forEach(w => {
        const start = w.addedAt || Date.now();
        right.push(`
          <div class="mini-row">
            <div class="mini-left">
              <div class="mini-name">${escapeHtml(w.name)}</div>
              <div class="mini-loc">대기(공유)</div>
            </div>
            <span class="time-chip" data-timer="wait" data-start="${start}" data-target="wait:${w.id}">00:00:00</span>
          </div>
        `);
      });
  }

// 2) 전 이벤트 착석자 리스트 (✅ 타이머 표시)
right.push(`<div class="badge" style="margin:12px 0 8px;">배치: ${seatedAll.length}명</div>`);
if (seatedAll.length === 0) {
  right.push(`<div class="mini-row"><div class="mini-left"><div class="mini-name">배치된 사람 없음</div><div class="mini-loc">—</div></div></div>`);
} else {
  seatedAll.forEach(x => {
    const start = x.seatedAt || Date.now();
    right.push(`
      <div class="mini-row">
        <div class="mini-left">
          <div class="mini-name">${escapeHtml(x.name)}</div>
          <div class="mini-loc">${escapeHtml(x.eventId)} / ${escapeHtml(x.boxId)} — Seat ${escapeHtml(x.seatLabel)}</div>
        </div>
        <span class="time-chip" data-timer="seat" data-start="${start}" data-target="seat-global:${escapeHtml(x.eventId)}:${escapeHtml(x.boxId)}:${escapeHtml(x.seatId)}">00:00:00</span>
      </div>
    `);
  });
}

  right.push(`</div>`);

  // 합치기 (요청: 배치(Seat) 옆에 칸)
  html.push(`<div class="panel-split">`);
  html.push(`<div>${left.join("")}</div>`);
  html.push(`${right.join("")}`);
  html.push(`</div>`);

  panelContent.innerHTML = html.join("");

  // 버튼 바인딩
  document.getElementById("addSeatBtn").onclick = addSeat;

  panelContent.querySelectorAll("[data-sid]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target && (e.target.matches("[data-del]") || e.target.matches("[data-clear]") || e.target.matches("[data-rename]"))) return;
      const sid = el.getAttribute("data-sid");
      ui.selectedSeatId = ui.selectedSeatId === sid ? null : sid;
      ui.selectedWaitingId = null;
      render();
    });
  });

  panelContent.querySelectorAll("[data-rename]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      renameSeat(btn.getAttribute("data-rename"));
    });
  });

  panelContent.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSeat(btn.getAttribute("data-del"));
    });
  });

  panelContent.querySelectorAll("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSeat(btn.getAttribute("data-clear"));
    });
  });
}


  /* ===============================
     TIMER UPDATER (매초 UI만 갱신)
  =============================== */
  function updateTimers() {
    const now = Date.now();

    // time chips
    document.querySelectorAll(".time-chip[data-start][data-timer]").forEach((chip) => {
      const start = Number(chip.dataset.start || 0);
      if (!start) return;
      const ms = now - start;
      chip.textContent = fmtElapsed(ms);

      const cls = timerClass(ms);
      chip.classList.remove("t-green", "t-yellow", "t-orange", "t-red");
      chip.classList.add(cls);
    });

    // seat-box highlight (착석중일 때만)
    document.querySelectorAll(".seat-box[data-seatid]").forEach((box) => {
      const id = box.dataset.seatid;
      const seat = eventState.seats.find(s => s.id === id);
      if (!seat || isEmptyPerson(seat.person) || !seat.seatedAt) {
        box.classList.remove("t-green", "t-yellow", "t-orange", "t-red");
        return;
      }
      const ms = now - seat.seatedAt;
      const cls = timerClass(ms);
      box.classList.remove("t-green", "t-yellow", "t-orange", "t-red");
      box.classList.add(cls);
    });
  }

  let timerHandle = null;
  function startTick() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(updateTimers, 1000);
  }

  /* ===============================
     EVENTS
  =============================== */
  menuBtn.onclick = () => {
    if (isMobile()) mobileSheet.classList.toggle("open");
    else pcPanel.classList.toggle("open");
  };

  if (backBtn) {
    backBtn.onclick = () => {
      sessionStorage.setItem("eventId", EVENT_ID);
      sessionStorage.setItem("boxId", BOX_ID);
      location.href = `./index.html?eventId=${encodeURIComponent(EVENT_ID)}&boxId=${encodeURIComponent(BOX_ID)}`;
    };
  }

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      ui.activeTab = t.dataset.tab;
      ui.selectedWaitingId = null;
      renderPanel();
      updateTimers();
    });
  });

  if (mobileAddSeatBtn) {
    mobileAddSeatBtn.onclick = () => {
      addSeat();
      mobileSheet.classList.remove("open");
    };
  }

  if (mobileAddWaitingBtn) {
    mobileAddWaitingBtn.onclick = () => {
      const name = prompt("대기자 이름");
      if (name) addWaiting(name);
      mobileSheet.classList.remove("open");
    };
  }

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (ui.selectedWaitingId) {
      deleteWaiting(ui.selectedWaitingId);
      return;
    }
    if (ui.selectedSeatId) {
      deleteSeat(ui.selectedSeatId);
      return;
    }
  });

  window.addEventListener("resize", () => render());

  window.addEventListener("storage", (e) => {
    if (e.key === EVENT_KEY) {
      const next = loadEventState();
      if (!next) return;
      if (next.updatedAt && next.updatedAt > eventState.updatedAt) {
        eventState.version = next.version || 2;
        eventState.eventId = next.eventId || EVENT_ID;
        eventState.boxId = next.boxId || BOX_ID;
        eventState.nextSeatNo = next.nextSeatNo || eventState.nextSeatNo;
        eventState.nextSeatOrder = next.nextSeatOrder || eventState.nextSeatOrder;
        eventState.seats = Array.isArray(next.seats) ? next.seats : [];
        eventState.updatedAt = next.updatedAt || Date.now();
        render();
      }
    }

    if (e.key === WAITING_KEY) {
      const nextW = loadWaitingState();
      if (!nextW) return;
      if (nextW.updatedAt && nextW.updatedAt > waitingState.updatedAt) {
        waitingState.version = nextW.version || 2;
        waitingState.waiting = Array.isArray(nextW.waiting) ? nextW.waiting : [];
        waitingState.updatedAt = nextW.updatedAt || Date.now();
        render();
      }
    }
  });

  /* ===============================
     INIT (마이그레이션)
  =============================== */
  // 기존 데이터(addedAt/seatedAt) 없으면 자동 채우기
  waitingState.waiting.forEach(w => {
    if (!w.addedAt) w.addedAt = Date.now();
  });
  eventState.seats.forEach(s => {
    if (!isEmptyPerson(s.person) && !s.seatedAt) s.seatedAt = Date.now();
    if (isEmptyPerson(s.person)) s.seatedAt = null;
    if (s.label == null) s.label = String(s.no ?? "");
  });

  saveEventState();
  saveWaitingState();

  render();
  startTick();
})();