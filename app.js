/* =====================================================
   BOX BOARD — CLEAN SINGLE-STRUCTURE VERSION
   ===================================================== */
document.querySelector(".layout-loading")?.classList.add("hidden");

const LS_KEY = "boxboard_v1_state";

/* ===============================
   STATE
   =============================== */
let state = {
  dateText: "",
  boxes: [],
  waiting: [],          // 🔥 대기자 추가
  view: "main",
  currentBoxId: null,
};

let currentTab = 'box';
let editingBoxId = null;

/* ===============================
   UTIL
   =============================== */
const uid = () => "b_" + Math.random().toString(36).slice(2) + Date.now();
const isTyping = (el) =>
  el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);

/* ===============================
   STORAGE
   =============================== */
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify({
    dateText: state.dateText,
    boxes: state.boxes,
    waiting: state.waiting        // 🔥 저장
  }));
}

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return false;
  try{
    const parsed = JSON.parse(raw);
    if(parsed.dateText) state.dateText = parsed.dateText;
    if(Array.isArray(parsed.boxes)) state.boxes = parsed.boxes;
    if(Array.isArray(parsed.waiting)) state.waiting = parsed.waiting; // 🔥 로드
    return true;
  }catch(e){ return false; }
}

/* ===============================
   DOM
   =============================== */
const appEl = document.getElementById("app");
const boardEl = document.getElementById("board");
const dateTextEl = document.getElementById("dateText");

const inputDateText = document.getElementById("inputDateText");
const saveTextBtn = document.getElementById("saveText");
const closeTextBtn = document.getElementById("closeText");

const addBoxBtn = document.getElementById("addBoxBtn");
const boxTitle = document.getElementById("boxTitle");
const boxStatus = document.getElementById("boxStatus");
const boxBuyin = document.getElementById("boxBuyin");
const boxTime = document.getElementById("boxTime");
const boxExtraLabel = document.getElementById("boxExtraLabel");
const boxExtraValue = document.getElementById("boxExtraValue");
const saveBoxBtn = document.getElementById("saveBox");
const cancelBoxBtn = document.getElementById("cancelBox");

/* 🔥 대기자 DOM */
const waitingInput = document.getElementById("waitingNameInput");
const waitingAddBtn = document.getElementById("addWaitingBtn");

if (waitingInput && waitingAddBtn) {
  const addWaiting = () => {
    const name = waitingInput.value.trim();
    if (!name) return;

    state.waiting.push({
      id: "w_" + Date.now(),
      name
    });

    waitingInput.value = "";
    saveState();
    renderWait();
  };

  waitingAddBtn.addEventListener("click", addWaiting);

  waitingInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addWaiting();
    }
  });
}

/* ===============================
   RENDER
   =============================== */
function renderHeader(){
  dateTextEl.textContent = state.dateText || "";
}

function statusClass(s){
  s = (s||"").toLowerCase();
  if(s==="running") return "running";
  if(s==="closed") return "closed";
  return "opened";
}

function renderMain(){
  boardEl.innerHTML = "";

  state.boxes.forEach(b=>{
    const card = document.createElement("section");
    card.className = `card ${statusClass(b.status)}`;
    card.dataset.id = b.id;

    card.innerHTML = `
      <div class="badge">${b.status}</div>
      <h3 class="card-title">${b.title}</h3>
      <div class="meta">
        <div class="pill"><div class="k">Buy-in</div><div class="v">${b.buyin}</div></div>
        <div class="pill"><div class="k">Time</div><div class="v">${b.time}</div></div>
        <div class="pill"><div class="k">${b.extraLabel}</div><div class="v">${b.extraValue}</div></div>
      </div>
    `;

    card.addEventListener("click", () => {
      const boxId = b.id;
      window.location.href = `layout_index.html?boxId=${boxId}`;
    });

    boardEl.appendChild(card);
  });
}

/* ===============================
   🔥 WAITING RENDER (추가)
   =============================== */
function renderWait(){
  boardEl.innerHTML = "";

  if (!state.waiting.length) {
    boardEl.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  state.waiting.forEach((w, idx)=>{
    const card = document.createElement("section");
    card.className = "card waiting-card";

    card.innerHTML = `
      <button class="wait-delete">×</button>
      <h3>${w.name}</h3>
    `;

    // 🔥 삭제 버튼
    card.querySelector(".wait-delete").onclick = (e)=>{
      e.stopPropagation();
      state.waiting.splice(idx,1);
      saveState();
      renderWait();
    };

    boardEl.appendChild(card);
  });
}

function render(){
  renderHeader();

  if (currentTab === 'box') {
    renderMain();
  } else if (currentTab === 'wait') {
    renderWait();
  }
}

/* ===============================
   EVENTS
   =============================== */
saveTextBtn.onclick = ()=>{
  state.dateText = inputDateText.value.trim();
  saveState();
  renderHeader();
};

addBoxBtn.onclick = ()=>{};
cancelBoxBtn.onclick = ()=>{};

saveBoxBtn.onclick = ()=>{
  const data = {
    id: editingBoxId || uid(),
    title: boxTitle.value || "(untitled)",
    status: boxStatus.value,
    buyin: boxBuyin.value,
    time: boxTime.value,
    extraLabel: boxExtraLabel.value,
    extraValue: boxExtraValue.value,
  };
  if(editingBoxId)
    state.boxes = state.boxes.map(b=>b.id===editingBoxId?data:b);
  else
    state.boxes.push(data);

  saveState();
  render();
};

/* ===============================
   🔥 WAITING ADD (BUTTON + ENTER)
   =============================== */
if (waitingInput && waitingAddBtn) {
  const addWaiting = ()=>{
  const name = waitingInput.value.trim();
  if (!name) return;

  state.waiting.push({
    id: "w_" + Date.now(),
    name
  });

  waitingInput.value = "";
  saveState();

  // 🔥 핵심
  currentTab = "wait";
  render();
};


  waitingAddBtn.addEventListener("click", addWaiting);

  waitingInput.addEventListener("keydown", e=>{
    if (e.key === "Enter") {
      e.preventDefault();
      addWaiting();
    }
  });
}

/* ===============================
   KEYBOARD
   =============================== */
document.addEventListener("keydown",(e)=>{
  if(isTyping(document.activeElement)) return;
  const k = e.key.toLowerCase();

  if(k==="w") currentTab = "wait", render();
  if(k==="b") currentTab = "box", render();
});

/* ===============================
   BOOT
   =============================== */
if(!loadState() || !state.boxes || state.boxes.length === 0){
  state.boxes = [
    {
      id: uid(),
      title: "Sample Box 1",
      status: "Opened",
      buyin: "1,000,000 KRW",
      time: "12:00",
      extraLabel: "Entries",
      extraValue: "0"
    }
  ];
  saveState();
}
render();
/* ===============================
   WAITING PATCH — FORCE BIND (SAFE)
   =============================== */
(function(){
  // ✅ 네 실제 HTML ID
  const input = document.getElementById("waitingNameInput");
  const btn   = document.getElementById("addWaitingBtn") || document.getElementById("addWaitingBtn".replace("Btn","Btn")); // (그냥 안전)

  // 버튼 id가 addWaitingBtn 인 걸 확인했으니 그대로 사용
  // 혹시 너가 addWaitingBtn / addWaitingBtn 혼용했을까봐 위처럼 썼지만,
  // 아래에서 다시 제대로 잡음:
  const addBtn = document.getElementById("addWaitingBtn");

  if (!input || !addBtn) {
    console.warn("[WAITING PATCH] input/button not found", { input, addBtn });
    return;
  }

  console.log("[WAITING PATCH] bound OK");

  // state.waiting 없으면 만들어줌 (기존 구조 안 깨짐)
  if (!Array.isArray(state.waiting)) state.waiting = [];

  // renderWait 없으면 최소 렌더러 만들어줌 (기존 renderWait 있으면 안 건드림)
  if (typeof renderWait !== "function") {
    window.renderWait = function(){
      // boardEl 없으면 못 그림
      const host = document.getElementById("board");
      if (!host) return;

      host.innerHTML = "";
      if (!state.waiting.length) {
        host.innerHTML = `<div class="empty">대기자 없음</div>`;
        return;
      }

      state.waiting.forEach((w, idx) => {
        const card = document.createElement("section");
        card.className = "card waiting-card";
        card.innerHTML = `
          <button class="wait-delete">×</button>
          <h3>${w.name}</h3>
        `;
        card.querySelector(".wait-delete").addEventListener("click", (e)=>{
          e.stopPropagation();
          state.waiting.splice(idx, 1);
          saveState();
          renderWait();
        });
        host.appendChild(card);
      });
    };
  }

  function addWaiting(){
    const name = input.value.trim();
    if (!name) return;

    state.waiting.push({ id: "w_" + Date.now(), name, startedAt: Date.now() });
    input.value = "";

    saveState();

    // ✅ 안 보이는 문제 방지: wait 탭으로 강제 전환 + render 호출
    currentTab = "wait";
    if (typeof render === "function") render();
    else renderWait();

    console.log("[WAITING PATCH] added:", name, "count:", state.waiting.length);
  }

  // ✅ 기존에 같은 이벤트가 여러 번 붙어도 문제 줄이기 위해 clone 방식으로 초기화
  const newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);

  newBtn.addEventListener("click", addWaiting);
  input.addEventListener("keydown", (e)=>{
    if (e.key === "Enter") {
      e.preventDefault();
      addWaiting();
    }
  });
})();
