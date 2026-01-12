(() => {
  const STORE_KEY = "boxboard_pc_v2";
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2,10);
  const now = () => Date.now();
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));

  const state = {
    zoom: 0.70,
    gapX: 280,
    gapY: 170,
    boxScale: 1.0,
    boxes: [],
    waiting: [],
    selected: new Set(),
    sidebarHidden: false
  };

  function fmt(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const hh = String(Math.floor(s/3600)).padStart(2,"0");
    const mm = String(Math.floor((s%3600)/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    return `${hh}:${mm}:${ss}`;
  }
  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function save(){
    localStorage.setItem(STORE_KEY, JSON.stringify({
      zoom: state.zoom, gapX: state.gapX, gapY: state.gapY, boxScale: state.boxScale,
      boxes: state.boxes, waiting: state.waiting, sidebarHidden: state.sidebarHidden
    }));
  }
  function load(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return;
      const p = JSON.parse(raw);
      state.zoom = p.zoom ?? state.zoom;
      state.gapX = p.gapX ?? state.gapX;
      state.gapY = p.gapY ?? state.gapY;
      state.boxScale = p.boxScale ?? state.boxScale;
      state.boxes = Array.isArray(p.boxes) ? p.boxes : state.boxes;
      state.waiting = Array.isArray(p.waiting) ? p.waiting : state.waiting;
      state.sidebarHidden = !!p.sidebarHidden;
    }catch(e){}
  }

  const sidebar = $("#sidebar");
  const board = $("#board");
  const zoomPct = $("#zoomPct");

  const toggleSide = $("#toggleSide");
  const alignH = $("#alignH");
  const alignV = $("#alignV");
  const openGapX = $("#openGapX");
  const openGapY = $("#openGapY");

  const zoomIn = $("#zoomIn");
  const zoomOut = $("#zoomOut");
  const resetUi = $("#resetUi");

  const addBoxBtn = $("#addBox");
  const resetBoxesBtn = $("#resetBoxes");

  const gapXRange = $("#gapX");
  const gapYRange = $("#gapY");
  const boxScaleRange = $("#boxScale");

  const autoGrid = $("#autoGrid");
  const clearSel = $("#clearSel");

  const waitName = $("#waitName");
  const addWait = $("#addWait");
  const waitSearch = $("#waitSearch");
  const waitList = $("#waitList");

  const exportJson = $("#exportJson");
  const importJson = $("#importJson");
  const jsonArea = $("#jsonArea");

  const tabs = $$(".tab");
  const panels = $$(".panel");

  function setTab(name){
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    panels.forEach(p => p.classList.toggle("active", p.dataset.panel === name));
  }

  function applyZoom(){
    zoomPct.textContent = Math.round(state.zoom*100) + "%";
    board.style.transform = `scale(${state.zoom})`;
  }
  function applySidebar(){
    sidebar.classList.toggle("hidden", state.sidebarHidden);
  }

  function filteredWaiting(){
    const q = (waitSearch.value || "").trim().toLowerCase();
    if(!q) return state.waiting;
    return state.waiting.filter(w => w.name.toLowerCase().includes(q));
  }

  function renderWaiting(){
    waitList.innerHTML = "";
    const items = filteredWaiting();
    items.forEach((w, idx) => {
      const el = document.createElement("div");
      el.className = "waitItem";
      el.draggable = true;
      el.dataset.id = w.id;
      el.innerHTML = `
        <div class="num">${idx+1}</div>
        <div class="meta">
          <div class="name">${escapeHtml(w.name)}</div>
          <div class="timer">대기 ${fmt(now()-w.startMs)}</div>
        </div>
        <button class="del">삭제</button>
      `;
      el.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", w.id));
      el.querySelector(".del").addEventListener("click", () => {
        state.waiting = state.waiting.filter(x => x.id !== w.id);
        save(); renderWaiting();
      });
      waitList.appendChild(el);
    });
  }

  function addWaitItem(){
    const name = (waitName.value || "").trim();
    if(!name) return;
    state.waiting.push({ id: uid(), name, startMs: now() });
    waitName.value = "";
    save(); renderWaiting();
  }

  function nextSeat(){
    const used = new Set(state.boxes.map(b => Number(b.seat)).filter(n => !Number.isNaN(n)));
    let n=1; while(used.has(n)) n++;
    return n;
  }

  function addBox(){
    const seat = nextSeat();
    state.boxes.push({
      id: uid(),
      seat,
      name: "",
      startMs: 0,
      x: 40 + (state.boxes.length%6) * state.gapX,
      y: 40 + Math.floor(state.boxes.length/6) * state.gapY
    });
    save(); renderBoxes();
  }

  function resetBoxes(){
    if(!confirm("박스를 초기화할까요?")) return;
    state.boxes = [];
    state.selected.clear();
    save(); renderAll();
  }

  function clearBox(id){
    const b = state.boxes.find(x => x.id === id);
    if(!b) return;
    b.name = "";
    b.startMs = 0;
    save(); renderBoxes();
  }

  function sendBoxToWaiting(id){
    const b = state.boxes.find(x => x.id === id);
    if(!b || !b.name) return;
    state.waiting.unshift({ id: uid(), name: b.name, startMs: now() });
    b.name = ""; b.startMs = 0;
    save(); renderAll();
  }

  function assignWaitingToBox(waitId, boxId){
    const w = state.waiting.find(x => x.id === waitId);
    const b = state.boxes.find(x => x.id === boxId);
    if(!w || !b) return;

    if(b.name){
      state.waiting.unshift({ id: uid(), name: b.name, startMs: now() });
    }
    b.name = w.name;
    b.startMs = now();
    state.waiting = state.waiting.filter(x => x.id !== waitId);

    save(); renderAll();
  }

  function updateSelectedStyles(){
    $$(".box", board).forEach(el => el.classList.toggle("selected", state.selected.has(el.dataset.id)));
  }

  function renderBoxes(){
    $$(".box", board).forEach(n => n.remove());

    state.boxes.forEach((b) => {
      const el = document.createElement("div");
      el.className = "box";
      el.dataset.id = b.id;

      const w = Math.round(240 * state.boxScale);
      const h = Math.round(92 * state.boxScale);
      el.style.width = w + "px";
      el.style.height = h + "px";
      el.style.left = b.x + "px";
      el.style.top = b.y + "px";

      const nameText = (b.name && b.name.trim()) ? b.name : "비어있음";
      const t = b.startMs ? fmt(now()-b.startMs) : "00:00:00";

      el.innerHTML = `
        <div class="seat">${escapeHtml(b.seat)}</div>
        <div class="content">
          <div class="name" title="${escapeHtml(nameText)}">${escapeHtml(nameText)}</div>
          <div class="sub">
            <div class="badge">대기 ${t}</div>
            <div class="mini">
              <button class="toWait" title="대기로">↩</button>
              <button class="clear" title="비우기">×</button>
            </div>
          </div>
        </div>
      `;

      el.addEventListener("mousedown", (e) => {
        if(e.button !== 0) return;
        board.focus();
        const id = b.id;

        if(e.shiftKey){
          if(state.selected.has(id)) state.selected.delete(id);
          else state.selected.add(id);
        }else{
          if(!state.selected.has(id)){
            state.selected.clear();
            state.selected.add(id);
          }
        }
        updateSelectedStyles();
      });

      el.addEventListener("dblclick", (e) => {
        if(e.target.closest("button")) return;
        const newName = prompt("이름 수정", b.name || "");
        if(newName === null) return;
        b.name = newName.trim();
        if(b.name) b.startMs = b.startMs || now();
        save(); renderBoxes();
      });

      el.querySelector(".toWait").addEventListener("click", (e) => { e.stopPropagation(); sendBoxToWaiting(b.id); });
      el.querySelector(".clear").addEventListener("click", (e) => { e.stopPropagation(); clearBox(b.id); });
      el.querySelector(".name").addEventListener("dblclick", (e) => { e.stopPropagation(); sendBoxToWaiting(b.id); });

      el.addEventListener("dragover", (e) => { e.preventDefault(); el.style.borderColor = "rgba(86,156,255,0.55)"; });
      el.addEventListener("dragleave", () => { el.style.borderColor = ""; });
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.style.borderColor = "";
        const wid = e.dataTransfer.getData("text/plain");
        if(wid) assignWaitingToBox(wid, b.id);
      });

      el.addEventListener("mousedown", (e) => startDrag(e, b.id));

      board.appendChild(el);
    });

    updateSelectedStyles();
  }

  let drag = null;
  function startDrag(e, id){
    const target = e.target.closest(".box");
    if(!target) return;
    if(e.target.closest("button")) return;

    if(!state.selected.has(id) && !e.shiftKey){
      state.selected.clear();
      state.selected.add(id);
      updateSelectedStyles();
    }
    const orig = Array.from(state.selected).map(pid => {
      const pb = state.boxes.find(x => x.id === pid);
      return { id: pid, x: pb?.x ?? 0, y: pb?.y ?? 0 };
    });
    drag = { sx: e.clientX, sy: e.clientY, orig };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function onMove(e){
    if(!drag) return;
    const dx = (e.clientX - drag.sx) / state.zoom;
    const dy = (e.clientY - drag.sy) / state.zoom;
    drag.orig.forEach(o => {
      const b = state.boxes.find(x => x.id === o.id);
      if(!b) return;
      b.x = Math.round(o.x + dx);
      b.y = Math.round(o.y + dy);
    });
    renderBoxes();
  }
  function onUp(){
    if(!drag) return;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    save();
    drag = null;
  }

  function alignSelectedHorizontal(){
    const ids = Array.from(state.selected);
    if(ids.length < 2) return;
    const boxes = ids.map(id => state.boxes.find(b => b.id===id)).filter(Boolean).sort((a,b)=>a.x-b.x);
    const minX = Math.min(...boxes.map(b=>b.x));
    const minY = Math.min(...boxes.map(b=>b.y));
    let x = minX;
    boxes.forEach(b => { b.x = x; b.y = minY; x += state.gapX; });
    save(); renderBoxes();
  }
  function alignSelectedVertical(){
    const ids = Array.from(state.selected);
    if(ids.length < 2) return;
    const boxes = ids.map(id => state.boxes.find(b => b.id===id)).filter(Boolean).sort((a,b)=>a.y-b.y);
    const minX = Math.min(...boxes.map(b=>b.x));
    const minY = Math.min(...boxes.map(b=>b.y));
    let y = minY;
    boxes.forEach(b => { b.y = y; b.x = minX; y += state.gapY; });
    save(); renderBoxes();
  }

  function autoGridLayout(){
    if(!state.boxes.length) return;
    const cols = 6;
    const startX = 40;
    const startY = 40;
    state.boxes.forEach((b, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      b.x = startX + c * state.gapX;
      b.y = startY + r * state.gapY;
    });
    save(); renderBoxes();
  }

  function exportAll(){
    jsonArea.value = JSON.stringify({
      boxes: state.boxes,
      waiting: state.waiting,
      settings: { zoom: state.zoom, gapX: state.gapX, gapY: state.gapY, boxScale: state.boxScale }
    }, null, 2);
    setTab("box");
  }
  function importAll(){
    try{
      const raw = jsonArea.value.trim();
      if(!raw) return;
      const p = JSON.parse(raw);
      if(p.settings){
        state.zoom = p.settings.zoom ?? state.zoom;
        state.gapX = p.settings.gapX ?? state.gapX;
        state.gapY = p.settings.gapY ?? state.gapY;
        state.boxScale = p.settings.boxScale ?? state.boxScale;
      }
      if(Array.isArray(p.boxes)) state.boxes = p.boxes;
      if(Array.isArray(p.waiting)) state.waiting = p.waiting;
      save(); renderAll();
      alert("불러오기 완료");
    }catch(e){
      alert("JSON 파싱 실패");
    }
  }

  function renderAll(){
    applySidebar();
    applyZoom();
    gapXRange.value = String(state.gapX);
    gapYRange.value = String(state.gapY);
    boxScaleRange.value = String(Math.round(state.boxScale*100));
    renderWaiting();
    renderBoxes();
  }

  function wire(){
    tabs.forEach(t => t.addEventListener("click", () => setTab(t.dataset.tab)));

    toggleSide.addEventListener("click", () => {
      state.sidebarHidden = !state.sidebarHidden;
      save(); applySidebar();
    });

    addWait.addEventListener("click", addWaitItem);
    waitName.addEventListener("keydown", (e)=> { if(e.key==="Enter") addWaitItem(); });
    waitSearch.addEventListener("input", renderWaiting);

    addBoxBtn.addEventListener("click", addBox);
    resetBoxesBtn.addEventListener("click", resetBoxes);

    function setZoom(z){
      state.zoom = clamp(z, 0.25, 1.6);
      save(); applyZoom();
    }
    zoomIn.addEventListener("click", () => setZoom(state.zoom + 0.05));
    zoomOut.addEventListener("click", () => setZoom(state.zoom - 0.05));
    resetUi.addEventListener("click", () => {
      if(!confirm("UI 설정(줌/간격/크기)을 초기화할까요?")) return;
      state.zoom = 0.70; state.gapX = 280; state.gapY = 170; state.boxScale = 1.0;
      save(); renderAll();
    });

    board.addEventListener("wheel", (e) => {
      if(!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      setZoom(state.zoom + (delta > 0 ? -0.05 : 0.05));
    }, { passive:false });

    alignH.addEventListener("click", alignSelectedHorizontal);
    alignV.addEventListener("click", alignSelectedVertical);

    openGapX.addEventListener("click", () => setTab("layout"));
    openGapY.addEventListener("click", () => setTab("layout"));

    gapXRange.addEventListener("input", () => { state.gapX = Number(gapXRange.value); save(); });
    gapYRange.addEventListener("input", () => { state.gapY = Number(gapYRange.value); save(); });
    boxScaleRange.addEventListener("input", () => { state.boxScale = Number(boxScaleRange.value)/100; save(); renderBoxes(); });

    autoGrid.addEventListener("click", autoGridLayout);
    clearSel.addEventListener("click", () => { state.selected.clear(); updateSelectedStyles(); });

    board.addEventListener("mousedown", (e) => {
      if(e.target === board){
        state.selected.clear();
        updateSelectedStyles();
      }
    });

    board.addEventListener("keydown", (e) => {
      if(e.key === "Tab"){
        e.preventDefault();
        state.sidebarHidden = !state.sidebarHidden;
        save(); applySidebar();
        return;
      }
      if(e.key === "Delete" || e.key === "Backspace"){
        if(state.selected.size){
          if(confirm("선택한 박스를 삭제할까요?")){
            const del = new Set(state.selected);
            state.boxes = state.boxes.filter(b => !del.has(b.id));
            state.selected.clear();
            save(); renderBoxes();
          }
        }
      }
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a"){
        e.preventDefault();
        state.selected = new Set(state.boxes.map(b => b.id));
        updateSelectedStyles();
      }
      if(e.key === "Escape"){
        state.selected.clear();
        updateSelectedStyles();
      }
    });

    exportJson.addEventListener("click", exportAll);
    importJson.addEventListener("click", importAll);

    setInterval(() => {
      const items = filteredWaiting();
      $$(".waitItem .timer").forEach((el, idx) => {
        const w = items[idx];
        if(w) el.textContent = "대기 " + fmt(now()-w.startMs);
      });
      $$(".box").forEach(el => {
        const b = state.boxes.find(x => x.id === el.dataset.id);
        if(!b) return;
        const badge = el.querySelector(".badge");
        if(!badge) return;
        const t = b.startMs ? fmt(now()-b.startMs) : "00:00:00";
        badge.textContent = "대기 " + t;
      });
    }, 500);
  }

  load();
  wire();
  renderAll();

  if(state.boxes.length === 0){
    for(let i=0;i<6;i++) addBox();
    save();
    renderBoxes();
  }
})();