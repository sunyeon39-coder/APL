// State
const board = document.getElementById('board');
const waitList = document.getElementById('waitList');
const waitInput = document.getElementById('waitInput');
const addWait = document.getElementById('addWait');
const search = document.getElementById('search');
let waits = [];
let cards = [];
let selected = new Set();
let zoom = 1;

// Utilities
const save = () => localStorage.setItem('boxBoard', JSON.stringify({waits, cards, zoom}));
const load = () => {
  const raw = localStorage.getItem('boxBoard');
  if(!raw) return;
  const s = JSON.parse(raw);
  waits = s.waits||[];
  cards = s.cards||[];
  zoom = s.zoom||1;
  board.style.transform = `scale(${zoom})`;
  document.getElementById('zoomLabel').textContent = Math.round(zoom*100)+'%';
  renderWaits();
  cards.forEach(c=>renderCard(c));
};

// Waits
function renderWaits(){
  waitList.innerHTML='';
  waits.filter(w=>w.toLowerCase().includes(search.value.toLowerCase())).forEach((name,i)=>{
    const d=document.createElement('div');
    d.className='wait-item';
    d.draggable=true;
    d.innerHTML=`<span>${i+1}. ${name}</span><button>삭제</button>`;
    d.ondragstart=e=>e.dataTransfer.setData('text/plain',name);
    d.querySelector('button').onclick=()=>{waits=waits.filter(x=>x!==name);renderWaits();save();};
    waitList.appendChild(d);
  });
}
addWait.onclick=()=>{ if(!waitInput.value.trim())return; waits.push(waitInput.value.trim()); waitInput.value=''; renderWaits(); save(); };
search.oninput=renderWaits;

// Board DnD
board.ondragover=e=>e.preventDefault();
board.ondrop=e=>{
  const name=e.dataTransfer.getData('text/plain');
  if(!name) return;
  waits=waits.filter(x=>x!==name);
  renderWaits();
  createCard({id:Date.now(),name,x:e.offsetX,y:e.offsetY,w:160,h:90,font:14});
  save();
};

// Cards
function createCard(c){ cards.push(c); renderCard(c); }
function renderCard(c){
  const el=document.createElement('div');
  el.className='card';
  el.style.left=c.x+'px'; el.style.top=c.y+'px';
  el.style.width=c.w+'px'; el.style.height=c.h+'px';
  el.dataset.id=c.id;
  el.innerHTML=`<div class="title" style="font-size:${c.font}px">${c.name}</div>
    <div class="controls">
      <button class="fplus">A+</button><button class="fminus">A-</button>
    </div>
    <div class="resize-handle"></div>`;
  board.appendChild(el);

  // select
  el.onclick=(e)=>{
    if(!e.shiftKey){ selected.forEach(id=>document.querySelector(`[data-id='${id}']`)?.classList.remove('selected')); selected.clear(); }
    if(selected.has(c.id)){ selected.delete(c.id); el.classList.remove('selected'); }
    else{ selected.add(c.id); el.classList.add('selected'); }
    e.stopPropagation();
  };

  // drag
  let ox,oy,drag=false;
  el.onmousedown=e=>{ if(e.target.classList.contains('resize-handle')) return;
    drag=true; ox=e.offsetX; oy=e.offsetY; };
  document.addEventListener('mousemove',e=>{
    if(!drag) return;
    el.style.left=e.pageX-board.offsetLeft-ox+'px';
    el.style.top=e.pageY-board.offsetTop-oy+'px';
  });
  document.addEventListener('mouseup',()=>{ if(drag){ drag=false; c.x=parseInt(el.style.left); c.y=parseInt(el.style.top); save(); }});

  // resize
  const rh=el.querySelector('.resize-handle');
  let rs=false,rw,rh0,rx,ry;
  rh.onmousedown=e=>{ rs=true; rw=c.w; rh0=c.h; rx=e.pageX; ry=e.pageY; e.stopPropagation(); };
  document.addEventListener('mousemove',e=>{
    if(!rs) return;
    c.w=Math.max(120, rw+(e.pageX-rx));
    c.h=Math.max(70, rh0+(e.pageY-ry));
    el.style.width=c.w+'px'; el.style.height=c.h+'px';
  });
  document.addEventListener('mouseup',()=>{ if(rs){ rs=false; save(); }});

  // font size
  el.querySelector('.fplus').onclick=()=>{ c.font=Math.min(28,c.font+1); el.querySelector('.title').style.fontSize=c.font+'px'; save(); };
  el.querySelector('.fminus').onclick=()=>{ c.font=Math.max(10,c.font-1); el.querySelector('.title').style.fontSize=c.font+'px'; save(); };

  // rename
  el.querySelector('.title').ondblclick=()=>{
    const n=prompt('이름 수정',c.name); if(n){ c.name=n; el.querySelector('.title').textContent=n; save(); }
  };
}

// Board click clears selection
board.onclick=()=>{ selected.forEach(id=>document.querySelector(`[data-id='${id}']`)?.classList.remove('selected')); selected.clear(); };

// Keyboard
document.addEventListener('keydown',e=>{
  if(e.key==='Delete'){ cards=cards.filter(c=>!selected.has(c.id));
    selected.forEach(id=>document.querySelector(`[data-id='${id}']`)?.remove());
    selected.clear(); save();
  }
});

// Align & zoom
const alignRow=()=>{ let x=40; cards.forEach(c=>{ c.x=x; c.y=40; x+=c.w+20; const el=document.querySelector(`[data-id='${c.id}']`); el.style.left=c.x+'px'; el.style.top=c.y+'px';}); save();};
const alignCol=()=>{ let y=40; cards.forEach(c=>{ c.x=40; c.y=y; y+=c.h+20; const el=document.querySelector(`[data-id='${c.id}']`); el.style.left=c.x+'px'; el.style.top=c.y+'px';}); save();};
document.getElementById('btn-row').onclick=alignRow;
document.getElementById('btn-col').onclick=alignCol;
document.getElementById('btn-gapX').onclick=()=>{ cards.forEach(c=>{ c.x+=20; document.querySelector(`[data-id='${c.id}']`).style.left=c.x+'px';}); save();};
document.getElementById('btn-gapY').onclick=()=>{ cards.forEach(c=>{ c.y+=20; document.querySelector(`[data-id='${c.id}']`).style.top=c.y+'px';}); save();};
document.getElementById('zoomIn').onclick=()=>{ zoom=Math.min(1.5,zoom+0.1); board.style.transform=`scale(${zoom})`; document.getElementById('zoomLabel').textContent=Math.round(zoom*100)+'%'; save();};
document.getElementById('zoomOut').onclick=()=>{ zoom=Math.max(0.5,zoom-0.1); board.style.transform=`scale(${zoom})`; document.getElementById('zoomLabel').textContent=Math.round(zoom*100)+'%'; save();};
document.getElementById('btn-reset').onclick=()=>{ zoom=1; board.style.transform='scale(1)'; document.getElementById('zoomLabel').textContent='100%'; save();};

// Init
load();
