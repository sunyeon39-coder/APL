
/**
 * ONE-SHOT IMPLEMENTATION (no questions):
 * - E key opens "Edit Text" (board date text) ONLY when NOT typing in inputs.
 * - + Add Box button AND W key open "Create / Edit Box" (box editor)
 * - Save creates a new card (or updates if editing)
 * - Edit pencil on card opens editor with prefilled values
 * - ESC closes whichever modal is open
 * - Clicking outside modal closes
 * - localStorage persists dateText + boxes
 */

const LS_KEY = "boxboard_v1_state";

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

let state = {
  dateText: "asd",
  boxes: [],
  view: "main", // "main" | "layout"
  currentBoxId: null,
};
let editingBoxId = null;

/* ---------- Utilities ---------- */
function isTypingTarget(el){
  if(!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}
function uid(){
  // stable enough for client-only
  return "b_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}
function saveState(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }catch(e){}
}
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== "object") return false;
    if(typeof parsed.dateText === "string") state.dateText = parsed.dateText;
    if(Array.isArray(parsed.boxes)) state.boxes = parsed.boxes;
    // never restore transient UI state
    state.view = "main";
    state.currentBoxId = null;
    return true;
  }catch(e){
    return false;
  }
}

/* ---------- Modal control ---------- */
function openTextModal(){
  closeBoxModal(); // never overlap
  inputDateText.value = state.dateText || "";
  overlayText.classList.remove("hidden");
  overlayText.setAttribute("aria-hidden", "false");
  // focus input so user can type immediately
  setTimeout(()=> inputDateText.focus(), 0);
}
function closeTextModal(){
  overlayText.classList.add("hidden");
  overlayText.setAttribute("aria-hidden", "true");
}
function openBoxModal(box=null){
  closeTextModal(); // never overlap
  overlayBox.classList.remove("hidden");
  overlayBox.setAttribute("aria-hidden", "false");

  if(box){
    editingBoxId = box.id;
    boxTitle.value = box.title || "";
    boxStatus.value = box.status || "Opened";
    boxBuyin.value = box.buyin || "";
    boxTime.value = box.time || "";
    boxExtraLabel.value = box.extraLabel || "Entries";
    boxExtraValue.value = box.extraValue || "";
  }else{
    editingBoxId = null;
    boxTitle.value = "";
    boxStatus.value = "Opened";
    boxBuyin.value = "";
    boxTime.value = "";
    boxExtraLabel.value = "Entries";
    boxExtraValue.value = "";
  }
  setTimeout(()=> boxTitle.focus(), 0);
}
function closeBoxModal(){
  overlayBox.classList.add("hidden");
  overlayBox.setAttribute("aria-hidden", "true");
  editingBoxId = null;
}
function openLayout(boxId){
  state.view = "layout";
  state.currentBoxId = boxId;
  closeBoxModal();
  closeTextModal();
  render();
}

function backToMain(){
  state.view = "main";
  state.currentBoxId = null;
  render();
}

function renderLayout(){
  const appEl = document.getElementById("app");
  const box = (state.boxes || []).find(b=> b.id === state.currentBoxId);
  appEl.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "layout-wrap";

  const top = document.createElement("div");
  top.className = "layout-top";

  const h = document.createElement("div");
  h.className = "layout-title";
  h.textContent = box ? box.title : "Layout";

  const back = document.createElement("button");
  back.className = "btn back-btn";
  back.textContent = "Back";
  back.addEventListener("click", backToMain);

  top.appendChild(h);
  top.appendChild(back);

  const hint = document.createElement("div");
  hint.className = "layout-hint";
  hint.textContent = "(click cards go to layout)";

  const grid = document.createElement("div");
  grid.className = "layout-grid";
  // Placeholder grid (you can replace with real placement logic later)
  for(let i=1;i<=24;i++){
    const cell = document.createElement("div");
    cell.className = "layout-cell";
    cell.textContent = i;
    grid.appendChild(cell);
  }

  wrap.appendChild(top);
  wrap.appendChild(grid);
  appEl.appendChild(wrap);
}


/* Close when clicking outside modal */
overlayText.addEventListener("click", (e)=>{
  if(e.target === overlayText) closeTextModal();
});
overlayBox.addEventListener("click", (e)=>{
  if(e.target === overlayBox) closeBoxModal();
});

/* ESC closes current modal */
document.addEventListener("keydown", (e)=>{
  const key = (e.key || "").toLowerCase();
  const ae = document.activeElement;
  const tag = ae && ae.tagName ? ae.tagName.toLowerCase() : "";
  const isTyping = tag === "input" || tag === "textarea" || tag === "select" || (ae && ae.isContentEditable);

  // If user is typing in an input, never trigger global hotkeys.
  if(isTyping) return;

  // ESC closes any open modal
  if(key === "escape"){
    closeBoxModal();
    closeTextModal();
    return;
  }

  // E = edit header text (date/title)
  if(key === "e"){
    if(!document.getElementById("overlayBox").classList.contains("show")) openTextModal();
    return;
  }

  // W = create new box (only on main view)
  if(key === "w"){
    if(state.view === "main" && !document.getElementById("overlayText").classList.contains("show")){
      openBoxModal(null);
    }
    return;
  }

  // B = back from layout
  if(key === "b"){
    if(state.view === "layout") backToMain();
    return;
  }
});

/* ---------- Text modal actions ---------- */
saveTextBtn.addEventListener("click", ()=>{
  state.dateText = inputDateText.value.trim();
  if(state.dateText === "") state.dateText = " ";
  applyHeader();
  saveState();
  closeTextModal();
});
closeTextBtn.addEventListener("click", closeTextModal);

/* ---------- Box modal actions ---------- */
addBoxBtn.addEventListener("click", ()=> openBoxModal(null));
cancelBoxBtn.addEventListener("click", closeBoxModal);

saveBoxBtn.addEventListener("click", ()=>{
  const data = {
    id: editingBoxId || uid(),
    title: boxTitle.value.trim() || "(untitled)",
    status: boxStatus.value || "Opened",
    buyin: boxBuyin.value.trim(),
    time: boxTime.value.trim(),
    extraLabel: boxExtraLabel.value || "Entries",
    extraValue: boxExtraValue.value.trim(),
  };

  if(editingBoxId){
    state.boxes = state.boxes.map(b => b.id === editingBoxId ? data : b);
  }else{
    state.boxes.push(data);
  }

  saveState();
  render();
  closeBoxModal();
});

/* ---------- Rendering ---------- */
function applyHeader(){
  dateTextEl.textContent = state.dateText || "";
}

function statusClass(status){
  const s = (status || "").toLowerCase();
  if(s === "running") return "running";
  if(s === "closed") return "closed";
  return "opened";
}

function renderMain(){
  boardEl.innerHTML = "";
  state.boxes.forEach((b)=>{
    const card = document.createElement("section");
    card.className = `card ${statusClass(b.status)}`;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = b.status || "Opened";
    card.appendChild(badge);

    const h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = b.title || "";
    card.appendChild(h3);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <div class="pill"><div class="k">Buy-in</div><div class="v">${escapeHtml(b.buyin || "")}</div></div>
      <div class="pill"><div class="k">Time</div><div class="v">${escapeHtml(b.time || "")}</div></div>
      <div class="pill"><div class="k">${escapeHtml(b.extraLabel || "Entries")}</div><div class="v">${escapeHtml(b.extraValue || "")}</div></div>
    `;
    card.appendChild(meta);
// === Safari-style hover bar ===
const hoverBar = document.createElement('div');
hoverBar.className = 'card-hover-bar';

const hoverTitle = document.createElement('div');
hoverTitle.className = 'card-hover-title';
hoverTitle.textContent = b.title || 'Untitled';

const closeBtn = document.createElement('div');
closeBtn.className = 'card-hover-close';
closeBtn.textContent = '×';

closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirm('Delete this box?')) {
    card.remove();
  }
});

hoverBar.appendChild(hoverTitle);
hoverBar.appendChild(closeBtn);
card.appendChild(hoverBar);

boardEl.appendChild(card);
  });
}


function render(){
  // Header text
  document.getElementById("dateText").textContent = state.dateText || "";
  // Route
  if(state.view === "layout" && state.currentBoxId){
    renderLayout();
  }else{
    state.view = "main";
    state.currentBoxId = null;
    renderMain();
  }
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m)=> ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/* ---------- Bootstrap ---------- */
const loaded = loadState();
if(!loaded){
  // Seed with the 4 sample cards matching your screenshot (editable immediately)
  state = {
    dateText: "asd",
    boxes: [
      {
        id: uid(),
        title: "#52 Closer Event - Monster Stack",
        status: "Opened",
        buyin: "1,100,000 KRW",
        time: "11:18",
        extraLabel: "Entries",
        extraValue: "138",
      },
      {
        id: uid(),
        title: "#41 Challenger Event DAY 2",
        status: "Opened",
        buyin: "2,000,000 KRW",
        time: "12:00",
        extraLabel: "Reg Closes",
        extraValue: "12:00",
      },
      {
        id: uid(),
        title: "King's Debut Open DAY 1/C",
        status: "Running",
        buyin: "5,000 USDT",
        time: "13:00",
        extraLabel: "Entries",
        extraValue: "148",
      },
      {
        id: uid(),
        title: "S2 - NLH 8 Handed Turbo",
        status: "Running",
        buyin: "8,000 USDT",
        time: "15:30",
        extraLabel: "Reg Closes",
        extraValue: "19:20",
      },
    ]
  };
  saveState();
}

applyHeader();
render();


/* === PATCH: Dashboard section card click -> open layout view (same page) === */
(function(){
  function openLayoutView(){
    const dashboardView = document.getElementById('dashboardView');
    const appRoot = document.getElementById('appRoot');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (appRoot){
      appRoot.classList.remove('hidden');
      appRoot.classList.add('screen');
    }
  }

  document.addEventListener('click', function(e){
    const card = e.target && e.target.closest && e.target.closest('.sectionCard');
    if (!card) return;
    if (e.target.closest('button, a, input, textarea, select')) return;
    openLayoutView();
  }, true);
})();
/* === END PATCH === */
/* === Dashboard card click -> open layout view === */
(function(){
  function openLayoutView(){
    const dashboardView = document.getElementById('dashboardView');
    const appRoot = document.getElementById('appRoot');

    if (dashboardView) dashboardView.classList.add('hidden');
    if (appRoot) appRoot.classList.remove('hidden');
  }

  document.addEventListener('click', function(e){
    const card = e.target.closest('.card'); // ⭐ 핵심 수정
    if (!card) return;

    // 카드 안 버튼 클릭은 무시
    if (e.target.closest('button')) return;

    openLayoutView();
  }, true);
})();



/* =========================================================
   DASHBOARD CARD (PHOTO-STYLE) NAVIGATION – EXTRACTED & CLEAN
   Purpose:
   - Handle card click -> board view
   - Handle back button -> dashboard view
   - Screen fade transition only (NO layout / NO state mutation)
   ========================================================= */

(function(){
  const dashboardView = document.getElementById('dashboardView');
  const boardView = document.getElementById('appRoot');
  const backBtn = document.getElementById('backToDashboard');

  if(!dashboardView || !boardView) return;

  // Card click → enter board
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.sectionCard');
    if(!card) return;

    dashboardView.classList.add('hidden');
    boardView.classList.remove('hidden');
    boardView.classList.add('screen');
  });

  // Back button → return to dashboard
  if(backBtn){
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      boardView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      dashboardView.classList.add('screen');
    });
  }
})();
