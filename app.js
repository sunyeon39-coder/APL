const waitList=document.getElementById('waitList');
const board=document.getElementById('board');
const nameInput=document.getElementById('nameInput');
const addBtn=document.getElementById('addBtn');
let selected=new Set();let selectMode=true;

addBtn.onclick=()=>{if(!nameInput.value)return;
const d=document.createElement('div');
d.className='item';d.textContent=nameInput.value;d.draggable=true;
d.ondragstart=()=>d.classList.add('dragging');
d.ondragend=()=>d.classList.remove('dragging');
waitList.appendChild(d);nameInput.value='';};

board.ondragover=e=>e.preventDefault();
board.ondrop=e=>{e.preventDefault();
const drag=document.querySelector('.dragging');if(!drag)return;
const c=document.createElement('div');c.className='card';
c.style.left=e.offsetX+'px';c.style.top=e.offsetY+'px';
c.textContent=drag.textContent;
c.onclick=ev=>{if(!selectMode)return;
if(!ev.shiftKey){selected.forEach(x=>x.classList.remove('selected'));selected.clear();}
c.classList.toggle('selected');
selected.has(c)?selected.delete(c):selected.add(c);};
board.appendChild(c);drag.remove();};

document.addEventListener('keydown',e=>{
if(e.key==='Delete'){selected.forEach(c=>c.remove());selected.clear();}});

document.getElementById('btn-select').onclick=e=>{
selectMode=!selectMode;e.target.classList.toggle('active',selectMode);};

document.getElementById('btn-row').onclick=()=>{
let x=40;selected.forEach(c=>{c.style.left=x+'px';c.style.top='40px';x+=180;});};

document.getElementById('btn-col').onclick=()=>{
let y=40;selected.forEach(c=>{c.style.left='40px';c.style.top=y+'px';y+=110;});};

document.getElementById('btn-reset').onclick=()=>{
let x=40,y=40;
board.querySelectorAll('.card').forEach(c=>{
c.style.left=x+'px';c.style.top=y+'px';x+=180;
if(x>board.clientWidth-200){x=40;y+=110;}});};

document.querySelectorAll('.tab').forEach(t=>{
t.onclick=()=>{
document.querySelectorAll('.tab,.tab-content').forEach(e=>e.classList.remove('active'));
t.classList.add('active');
document.getElementById(t.dataset.tab).classList.add('active');};});
