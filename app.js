/* =====================================================
   BOX BOARD — CLEAN STABLE VERSION
   ===================================================== */

const LS_KEY = "boxboard_v1_state";

/* ===============================
   STATE
   =============================== */
const state = {
  dateText: "",
  boxes: [],
  waiting: [],
};

let currentTab = "box"; // box | wait
let editingBoxId = null;

/* ===============================
   UTIL
   =============================== */
const uid = () => "b_" + Math.random().toString(36).slice(2) + Date.now();
const isTyping = el =>
  el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);

/* ===============================
   STORAGE
   =============================== */
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return false;
  try{
    Object.assign(state, JSON.parse(raw));
    return true;
  }catch{
    return false;
  }
}

/* ===============================
   DOM
   =============================== */
const boardEl   = document.getElementById("board");
const dateText = document.getElementById("dateText");

const addBoxBtn     = document.getElementById("addBoxBtn");
const saveBoxBtn    = document.getElementById("saveBox");
const cancelBoxBtn  = document.getElementById("cancelBox");

const boxTitle      = document.getElementById("boxTitle");
const boxStatus     = document.getElementById("boxStatus");
const boxBuyin      = document.getElementById("boxBuyin");
const boxTime       = document.getElementById("boxTime");
const boxExtraLabel = document.getElementById("boxExtraLabel");
const boxExtraValue = document.getElementById("boxExtraValue");

/* waiting */
const waitingInput  = document.getElementById("waitingNameInput");
const waitingBtn    = document.getElementById("addWaitingBtn");
/* ===============================
   OVERLAY (기존 모달 연결용)
   =============================== */
const overlayBox  = document.getElementById("overlayBox");
const overlayText = document.getElementById("overlayText");

/* ===============================
   RENDER
   =============================== */
function renderHeader(){
  if(dateText) dateText.textContent = state.dateText || "";
}

function renderBoxes(){
  boardEl.innerHTML = "";

  state.boxes.forEach(box=>{
    const card = document.createElement("section");
    card.className = "card";
    card.innerHTML = `
      <div class="badge">${box.status}</div>
      <h3 class="card-title">${box.title}</h3>
      <div class="meta">
        <div class="pill"><b>Buy-in</b> ${box.buyin}</div>
        <div class="pill"><b>Time</b> ${box.time}</div>
        <div class="pill"><b>${box.extraLabel}</b> ${box.extraValue}</div>
      </div>
    `;

    card.onclick = ()=>{
      location.href = `layout_index.html?boxId=${box.id}`;
    };

    boardEl.appendChild(card);
  });
}

function renderWaiting(){
  boardEl.innerHTML = "";

  if(!state.waiting.length){
    boardEl.innerHTML = `<div class="empty">대기자 없음</div>`;
    return;
  }

  state.waiting.forEach((w, i)=>{
    const card = document.createElement("section");
    card.className = "card waiting-card";
    card.innerHTML = `
      <button class="wait-delete">×</button>
      <h3>${w.name}</h3>
    `;

    card.querySelector(".wait-delete").onclick = e=>{
      e.stopPropagation();
      state.waiting.splice(i,1);
      saveState();
      render();
    };

    boardEl.appendChild(card);
  });
}

function render(){
  renderHeader();
  if(currentTab === "box") renderBoxes();
  else renderWaiting();
}

/* ===============================
   EVENTS
   =============================== */
   function closeBoxModal(){
  if (!overlayBox) return;
  overlayBox.classList.add("hidden");
  overlayBox.setAttribute("aria-hidden", "true");
}

function closeTextModal(){
  if (!overlayText) return;
  overlayText.classList.add("hidden");
  overlayText.setAttribute("aria-hidden", "true");
}

   function openTextModal(){
  if (!overlayText) return;

  overlayText.classList.remove("hidden");
  overlayText.setAttribute("aria-hidden", "false");

  // 🔥 핵심: 텍스트 입력값만 세팅
  if (inputDateText) {
    inputDateText.value = state.dateText || "";
  }
}


   function openBoxModal(){
  if (!overlayBox) return;

  overlayBox.classList.remove("hidden");
  overlayBox.setAttribute("aria-hidden", "false");

  editingBoxId = null;

  // 입력 초기화 (기존 동작 유지)
  boxTitle.value = "";
  boxStatus.value = "Opened";
  boxBuyin.value = "";
  boxTime.value = "";
  boxExtraLabel.value = "Entries";
  boxExtraValue.value = "";
}

if(waitingBtn && waitingInput){
  const addWaiting = ()=>{
    const name = waitingInput.value.trim();
    if(!name) return;

    state.waiting.push({ id: uid(), name });
    waitingInput.value = "";

    currentTab = "wait";
    saveState();
    render();
  };

  waitingBtn.onclick = addWaiting;
  waitingInput.onkeydown = e=>{
    if(e.key === "Enter"){
      e.preventDefault();
      addWaiting();
    }
  };
}

saveBoxBtn.onclick = ()=>{
  const box = {
    id: editingBoxId || uid(),
    title: boxTitle.value || "(untitled)",
    status: boxStatus.value,
    buyin: boxBuyin.value,
    time: boxTime.value,
    extraLabel: boxExtraLabel.value,
    extraValue: boxExtraValue.value
  };

  if(editingBoxId){
    state.boxes = state.boxes.map(b=>b.id===editingBoxId?box:b);
  }else{
    state.boxes.push(box);
  }

  editingBoxId = null;
  currentTab = "box";
  saveState();
  render();
};

addBoxBtn.onclick = ()=>{
  openBoxModal();
};


document.addEventListener("keydown", e => {
  if (isTyping(document.activeElement)) return;

  const key = e.key.toLowerCase();
if (key === "escape") {
    e.preventDefault();

    // 텍스트 모달 우선
    if (overlayText && !overlayText.classList.contains("hidden")) {
      closeTextModal();
      return;
    }

    // 그 다음 박스 모달
    if (overlayBox && !overlayBox.classList.contains("hidden")) {
      closeBoxModal();
      return;
    }
  }
  if (key === "w") {
    e.preventDefault();
    openBoxModal();     // ✅ 박스 모달
  }

  if (key === "e") {
    e.preventDefault();
    openTextModal();    // ✅ 텍스트 모달
  }

  if (key === "b") {
    currentTab = "box";
    render();
  }
});

/* ===============================
   BOOT
   =============================== */
if(!loadState() || !state.boxes.length){
  state.boxes = [{
    id: uid(),
    title: "Sample Box",
    status: "Opened",
    buyin: "1,000,000 KRW",
    time: "12:00",
    extraLabel: "Entries",
    extraValue: "0"
  }];
  saveState();
}

render();