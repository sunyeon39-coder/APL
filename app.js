/* =====================================================
   BOX BOARD — CLEAN SINGLE-STRUCTURE VERSION
   ===================================================== */

const LS_KEY = "boxboard_v1_state";
// 🔥 메인 페이지 로딩 오버레이 강제 해제
document.addEventListener("DOMContentLoaded", () => {
  console.log("[layout] boot");

  // 1️⃣ boxId
  const params = new URLSearchParams(window.location.search);
  const boxId = params.get("boxId");
  console.log("[layout] boxId:", boxId);

  if (!boxId) {
    alert("Invalid layout link");
    return;
  }

  // 2️⃣ state
  const raw = localStorage.getItem("boxboard_v1_state");
  if (!raw) {
    alert("No board data");
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    alert("Broken board data");
    return;
  }

  if (!Array.isArray(state.boxes)) {
    alert("Invalid board structure");
    return;
  }

  // 3️⃣ find box
  const box = state.boxes.find(b => b.id === boxId);
  console.log("[layout] found box:", box);

  if (!box) {
    alert("Board not found");
    return;
  }

  // 4️⃣ render
  renderLayout(box);

  // 5️⃣ loader OFF
  const loader = document.getElementById("layoutLoading");
  if (loader) loader.classList.add("hidden");
});



/* ---------- DOM ---------- */
const appEl = document.getElementById("app");
const boardEl = document.getElementById("board");
const dateTextEl = document.getElementById("dateText");

const overlayText = document.getElementById("overlayText");
const overlayBox = document.getElementById("overlayBox");

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

/* ---------- STATE ---------- */
let state = {
  dateText: "",
  boxes: [],
  view: "main",        // main | layout
  currentBoxId: null,
};

let currentTab = 'box';
let editingBoxId = null;

/* ---------- UTIL ---------- */
const uid = () => "b_" + Math.random().toString(36).slice(2) + Date.now();
const isTyping = (el) =>
  el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);

function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify({
    dateText: state.dateText,
    boxes: state.boxes
  }));
}

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return false;
  try{
    const parsed = JSON.parse(raw);
    if(parsed.dateText) state.dateText = parsed.dateText;
    if(Array.isArray(parsed.boxes)) state.boxes = parsed.boxes;
    return true;
  }catch(e){ return false; }
}

/* ---------- MODALS ---------- */
function openTextModal(){
  inputDateText.value = state.dateText || "";
  overlayText.classList.remove("hidden");
  setTimeout(()=>inputDateText.focus(),0);
}
function closeTextModal(){ overlayText.classList.add("hidden"); }

function openBoxModal(box=null){
  overlayBox.classList.remove("hidden");
  editingBoxId = box?.id || null;

  boxTitle.value = box?.title || "";
  boxStatus.value = box?.status || "Opened";
  boxBuyin.value = box?.buyin || "";
  boxTime.value = box?.time || "";
  boxExtraLabel.value = box?.extraLabel || "Entries";
  boxExtraValue.value = box?.extraValue || "";

  setTimeout(()=>boxTitle.focus(),0);
}
function closeBoxModal(){
  overlayBox.classList.add("hidden");
  editingBoxId = null;
}

/* ---------- NAV ---------- */
function openLayout(boxId){
  state.view = "layout";
  state.currentBoxId = boxId;
  render();
}
function backToMain(){
  state.view = "main";
  state.currentBoxId = null;

  currentTab = 'box'; 
  render();
}

/* ---------- RENDER ---------- */
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

    // ✅ 카드 클릭 → layout 이동 (여기만 존재)
    card.addEventListener("click", () => {
      const loader = document.getElementById("layoutLoading");
      if (loader) loader.classList.remove("hidden");

      const boxId = b.id;
      requestAnimationFrame(() => {
        window.location.href = `layout_index.html?boxId=${boxId}`;
      });
    });

    boardEl.appendChild(card);
  });
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;

  const boxId = card.dataset.id;
  if (!boxId) {
    console.error("no boxId on card");
    return;
  }

  window.location.href =
    `layout_index.html?boxId=${boxId}&from=board`;
});



function renderLayout(){
  const box = state.boxes.find(b=>b.id===state.currentBoxId);
  appEl.innerHTML = `
    <div class="layout-wrap">
      <div class="layout-top">
        <div class="layout-title">${box?.title || "Layout"}</div>
        <button class="btn back-btn">Back</button>
      </div>
      <div class="layout-grid">
        ${Array.from({length:24},(_,i)=>`<div class="layout-cell">${i+1}</div>`).join("")}
      </div>
    </div>
  `;
  document.querySelector(".back-btn").onclick = backToMain;
}

function render(){
  renderHeader();

  if (state.view === "layout") {
    renderLayout();
    return;
  }

  if (currentTab === 'box') {
    renderMain();
  } else if (currentTab === 'wait') {
    renderWait();
  } else if (currentTab === 'seat') {
    renderSeat();
  }
}

/* ---------- EVENTS ---------- */
saveTextBtn.onclick = ()=>{
  state.dateText = inputDateText.value.trim();
  saveState(); closeTextModal(); renderHeader();
};
closeTextBtn.onclick = closeTextModal;

addBoxBtn.onclick = ()=>openBoxModal(null);
cancelBoxBtn.onclick = closeBoxModal;

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

  saveState(); closeBoxModal(); render();
};

/* ---------- KEYBOARD ---------- */
document.addEventListener("keydown",(e)=>{
  if(isTyping(document.activeElement)) return;
  const k = e.key.toLowerCase();

  if(k==="escape"){ closeBoxModal(); closeTextModal(); }
  if(k==="e") openTextModal();
  if(k==="w" && state.view==="main") openBoxModal(null);
  if(k==="b" && state.view==="layout") backToMain();
});

/* ---------- BOOTSTRAP ---------- */
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

