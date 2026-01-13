const waitList = document.getElementById("waitList");
const board = document.getElementById("board");
const addBtn = document.getElementById("addWait");
const nameInput = document.getElementById("nameInput");

let waits = [];
let boxes = [];
let selectedBoxes = new Set();
let zoom = 1;

/* ====== TIMER ====== */
setInterval(() => {
  waits.forEach(w => w.time++);
  boxes.forEach(b => b.time++);
  renderWaits();
  renderBoxes();
}, 1000);

/* ====== WAIT ====== */
addBtn.onclick = () => {
  if (!nameInput.value) return;
  waits.push({ id: Date.now(), name: nameInput.value, time: 0 });
  nameInput.value = "";
  renderWaits();
};

function renderWaits() {
  waitList.innerHTML = "";
  waits.forEach(w => {
    const li = document.createElement("li");
    li.className = "wait-item";
    li.draggable = true;
    li.ondragstart = e => e.dataTransfer.setData("id", w.id);

    li.innerHTML = `
      <div>
        <b>${w.name}</b><br />
        <span class="timer">대기 ${format(w.time)}</span>
      </div>
      <button>삭제</button>
    `;

    li.querySelector("button").onclick = () => {
      waits = waits.filter(x => x.id !== w.id);
      renderWaits();
    };

    waitList.appendChild(li);
  });
}

/* ====== BOARD DROP ====== */
board.ondragover = e => e.preventDefault();
board.ondrop = e => {
  const id = +e.dataTransfer.getData("id");
  const w = waits.find(x => x.id === id);
  if (!w) return;
  waits = waits.filter(x => x.id !== id);

  boxes.push({
    ...w,
    x: e.offsetX,
    y: e.offsetY,
    width: 160,
    height: 80,
    font: 14
  });

  renderWaits();
  renderBoxes();
};

/* ====== BOX ====== */
function renderBoxes() {
  board.innerHTML = "";
  boxes.forEach(b => {
    const div = document.createElement("div");
    div.className = "box";
    if (selectedBoxes.has(b)) div.classList.add("selected");

    div.style.left = b.x + "px";
    div.style.top = b.y + "px";
    div.style.width = b.width + "px";
    div.style.height = b.height + "px";
    div.style.fontSize = b.font + "px";

    div.innerHTML = `
      <b contenteditable>${b.name}</b><br/>
      <span class="timer">${format(b.time)}</span>
      <div class="resize"></div>
    `;

    /* MOVE */
    div.onmousedown = e => {
      if (!e.shiftKey) selectedBoxes.clear();
      selectedBoxes.add(b);
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = b.x;
      const oy = b.y;

      document.onmousemove = ev => {
        b.x = ox + (ev.clientX - sx);
        b.y = oy + (ev.clientY - sy);
        renderBoxes();
      };
      document.onmouseup = () => (document.onmousemove = null);
    };

    /* RESIZE */
    div.querySelector(".resize").onmousedown = e => {
      e.stopPropagation();
      const sw = b.width;
      const sh = b.height;
      const sx = e.clientX;
      const sy = e.clientY;

      document.onmousemove = ev => {
        b.width = sw + (ev.clientX - sx);
        b.height = sh + (ev.clientY - sy);
        renderBoxes();
      };
      document.onmouseup = () => (document.onmousemove = null);
    };

    board.appendChild(div);
  });
}

/* ====== UTIL ====== */
function format(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `00:${m}:${s}`;
}
