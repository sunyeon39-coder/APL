const waitInput=document.getElementById('waitInput');
const addWait=document.getElementById('addWait');
const waitList=document.getElementById('waitList');
const canvas=document.getElementById('canvas');

const slotButtons=document.querySelectorAll('.slot');
const saveBtn=document.getElementById('saveSlot');
const loadBtn=document.getElementById('loadSlot');

let boxes=[];
let idSeq=1;
let currentSlot=1;

// helpers
function saveSlot(){
  localStorage.setItem('slot_'+currentSlot,JSON.stringify(boxes));
  alert('슬롯 '+currentSlot+' 저장됨');
}

function loadSlot(){
  const raw=localStorage.getItem('slot_'+currentSlot);
  if(!raw){alert('저장된 데이터 없음');return;}
  boxes=[];
  canvas.innerHTML='';
  JSON.parse(raw).forEach(b=>{
    idSeq=Math.max(idSeq,b.id+1);
    createBox(b,true);
  });
}

function createBox(data,fromLoad=false){
  const el=document.createElement('div');
  el.className='box '+data.status;
  el.style.left=data.x+'px';
  el.style.top=data.y+'px';
  el.textContent=data.id+'. '+data.name;
  canvas.appendChild(el);

  boxes.push(data);
  if(!fromLoad) localStorage.setItem('autosave',JSON.stringify(boxes));

  // drag
  let ox,oy,drag=false;
  el.onmousedown=e=>{drag=true;ox=e.offsetX;oy=e.offsetY};
  document.onmousemove=e=>{
    if(!drag) return;
    el.style.left=e.pageX-canvas.offsetLeft-ox+'px';
    el.style.top=e.pageY-canvas.offsetTop-oy+'px';
  };
  document.onmouseup=()=>{
    if(!drag) return;
    drag=false;
    data.x=parseInt(el.style.left);
    data.y=parseInt(el.style.top);
  };

  // status
  el.ondblclick=()=>{
    data.status=data.status==='wait'?'work':data.status==='work'?'done':'wait';
    el.className='box '+data.status;
  };
}

// slot select
slotButtons.forEach(btn=>{
  btn.onclick=()=>{
    slotButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentSlot=btn.dataset.slot;
  };
});

// add wait
addWait.onclick=()=>{
  if(!waitInput.value.trim()) return;
  const li=document.createElement('li');
  li.textContent=waitInput.value;
  li.onclick=()=>{
    createBox({
      id:idSeq++,
      name:waitInput.value,
      x:40,
      y:40,
      status:'wait'
    });
  };
  waitList.appendChild(li);
  waitInput.value='';
};

saveBtn.onclick=saveSlot;
loadBtn.onclick=loadSlot;
