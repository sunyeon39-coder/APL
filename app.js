/* =================================================
   BoxBoard – MINIMAL + STABLE (MOBILE SAFE)
   ================================================= */

const LS_KEY = "boxboard_v1_state";

/* ---------- DOM ---------- */
const boardEl = document.getElementById("board");
const dateTextEl = document.getElementById("dateText");

const overlayText = document.getElementById("overlayText");
const overlayBox  = document.getElementById("overlayBox");

const inputDateText = document.getElementById("inputDateText");
const saveTextBtn   = document.getElementById("saveText");
const closeTextBtn  = document.getElementById("closeText");

const addBoxBtn     = document.getElementById("addBoxBtn");
const boxTitle      = document.getElementById("boxTitle");
const boxStatus     = document.getElementById("boxStatus");
const boxBuyin      = document.getElementById("boxBuyin");
const boxTime       = document.getElementById("boxTime");
const boxExtraLabel = document.getElementById("boxExtraLabel");
const boxExtraValue = document.getElementById("boxExtraValue");
const saveBoxBtn    = document.getElementById("saveBox");
const cancelBoxBtn  = document.getElementById("cancelBox");

/* ---------- STATE ---------- */
let state = {
  dateText: " ",
  boxes: []
};

let editingBoxId = null;

/* ---------- UTIL ---------- */
function uid(){
  return "b_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isTyping(el){
  if(!el) return false;
  const t = el.tagName?.toLowerCase();
  return ["input","textarea","select"].includes(t) || el.isContentEditable;
}

function saveState(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const parsed = JSON.parse(raw);
    if(!parsed) return false;
    state.dateText = parsed.dateText || " ";
    state.boxes = Array.isArray(parsed.boxes) ? parsed.boxes : [];
    return true;
  }catch(e){ return false; }
}

/* ---------- MODAL ---------- */
function openTextModal(){
  if(!overlayText) return;
  inputDateText.value = state.dateText || "";
  overlayText.classList.remove("hidden");
  overlayText.setAttribute("aria-hidden","false");
  setTimeout(()=>inputDateText.focus(),0);
}

function closeTextModal(){
  if(!overlayText) return;
  overlayText.classList.add("hidden");
  overlayText.setAttribute("aria-hidden","true");
}

function openBoxModal(box=null){
  if(!overlayBox) return;
  overlayBox.classList.remove("hidden");
  overlayBox.setAttribute("aria-hidden","false");

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
  setTimeout(()=>boxTitle.focus(),0);
}

function closeBoxModal(){
  if(!overlayBox) return;
  overlayBox.classList.add("hidden");
  overlayBox.setAttribute("aria-hidden","true");
  editingBoxId = null;
}

/* ---------- RENDER ---------- */
function applyHeader(){
  dateTextEl.textContent = state.dateText || " ";
}

function statusClass(s){
  s = (s||"").toLowerCase();
  if(s==="running") return "running";
  if(s==="closed") return "closed";
  return "opened";
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    '"':"&quot;","'":"&#039;"
  }[m]));
}

function render(){
  applyHeader();
  boardEl.innerHTML = "";

  state.boxes.forEach(b=>{
    const card = document.createElement("section");
    card.className = `card ${statusClass(b.status)}`;
    card.dataset.boxId = b.id;

    card.innerHTML = `
      <div class="badge">${escapeHtml(b.status||"Opened")}</div>
      <div class="card-title">${escapeHtml(b.title||"")}</div>
      <div class="meta">
        <div class="pill"><div class="k">Buy-in</div><div class="v">${escapeHtml(b.buyin||"")}</div></div>
        <div class="pill"><div class="k">Time</div><div class="v">${escapeHtml(b.time||"")}</div></div>
        <div class="pill"><div class="k">${escapeHtml(b.extraLabel||"Entries")}</div><div class="v">${escapeHtml(b.extraValue||"")}</div></div>
      </div>
    `;
    boardEl.appendChild(card);
  });
}

/* ---------- EVENTS ---------- */

/* 카드 클릭 → layout 이동 (모바일 tap 포함) */
document.addEventListener("click", e=>{
  const card = e.target.closest(".card");
  if(!card) return;
  if(e.target.closest(".hover-btn")) return;

  const boxId = card.dataset.boxId;
  if(!boxId) return;

  location.href = `layout_index.html?boxId=${encodeURIComponent(boxId)}`;
}, true);

/* 키보드 단축키 (모바일 키보드 영향 없음) */
document.addEventListener("keydown", e=>{
  if(isTyping(document.activeElement)) return;
  const k = e.key.toLowerCase();

  if(k==="e") openTextModal();
  if(k==="w") openBoxModal(null);
  if(k==="escape"){
    closeTextModal();
    closeBoxModal();
  }
});

/* 버튼 */
addBoxBtn?.addEventListener("click", ()=>openBoxModal(null));
saveTextBtn?.addEventListener("click", ()=>{
  state.dateText = inputDateText.value.trim() || " ";
  saveState(); render(); closeTextModal();
});
closeTextBtn?.addEventListener("click", closeTextModal);

saveBoxBtn?.addEventListener("click", ()=>{
  const data = {
    id: editingBoxId || uid(),
    title: boxTitle.value.trim() || "(untitled)",
    status: boxStatus.value || "Opened",
    buyin: boxBuyin.value.trim(),
    time: boxTime.value.trim(),
    extraLabel: boxExtraLabel.value,
    extraValue: boxExtraValue.value.trim()
  };
  if(editingBoxId){
    state.boxes = state.boxes.map(b=>b.id===editingBoxId?data:b);
  }else{
    state.boxes.push(data);
  }
  saveState(); render(); closeBoxModal();
});
cancelBoxBtn?.addEventListener("click", closeBoxModal);

/* overlay 바깥 터치 → 닫기 (모바일 핵심) */
overlayText?.addEventListener("click",e=>{
  if(e.target===overlayText) closeTextModal();
});
overlayBox?.addEventListener("click",e=>{
  if(e.target===overlayBox) closeBoxModal();
});

/* ---------- BOOTSTRAP ---------- */
if(!loadState()){
  state = {
    dateText:"asd",
    boxes:[{
      id:uid(),
      title:"Sample Box 1",
      status:"Opened",
      buyin:"1,000,000",
      time:"12:00",
      extraLabel:"Entries",
      extraValue:"0"
    }]
  };
  saveState();
}
render();
