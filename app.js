const waitInput=document.getElementById('waitInput');
const addWait=document.getElementById('addWait');
const waitList=document.getElementById('waitList');
const canvas=document.getElementById('canvas');
const mobileList=document.getElementById('mobileList');

let boxes=[];
let idSeq=1;

// storage
function save(){localStorage.setItem('boxes',JSON.stringify(boxes));}
function load(){
  const raw=localStorage.getItem('boxes');
  if(!raw) return;
  boxes=JSON.parse(raw);
  boxes.forEach(b=>renderBox(b));
  renderMobile();
}

// render pc box
function renderBox(b){
  const el=document.createElement('div');
  el.className='box '+b.status;
  el.style.left=b.x+'px';
  el.style.top=b.y+'px';
  el.textContent=b.id+'. '+b.name;
  canvas.appendChild(el);
}

// render mobile
function renderMobile(){
  mobileList.innerHTML='';
  boxes.forEach(b=>{
    const d=document.createElement('div');
    d.className='m-card '+b.status;
    d.innerHTML=`<div class="m-name">${b.name}</div>
                 <div class="m-status">${label(b.status)}</div>`;
    mobileList.appendChild(d);
  });
}

function label(s){return s==='wait'?'대기':s==='work'?'배치':'완료'}

// add wait
addWait.onclick=()=>{
  if(!waitInput.value.trim()) return;
  const li=document.createElement('li');
  li.textContent=waitInput.value;
  li.onclick=()=>{
    const b={id:idSeq++,name:waitInput.value,x:40,y:40,status:'wait'};
    boxes.push(b);
    renderBox(b);
    renderMobile();
    save();
  };
  waitList.appendChild(li);
  waitInput.value='';
};

load();
