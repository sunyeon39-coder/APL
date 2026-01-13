let waitId = 1;
let boxId = 1;
const waitList = document.getElementById("waitList");
const board = document.getElementById("board");

const waits = [];
const boxes = [];

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/* 대기 추가 */
document.getElementById("addWait").onclick = () => {
  const input = document.getElementById("waitInput");
  if (!input.value) return;

  const w = {
    id: waitId++,
    name: input.value,
    start: Date.now()
  };
  waits.push(w);
  input.value = "";
  renderWaits();
};

function renderWaits() {
  waitList.innerHTML = "";
  waits.forEach(w => {
    const li = document.createElement("li");
    li.className = "wait-item";
    li.draggable = true;

    const time = document.createElement("span");
    time.className = "wait-time";
    time.textContent = formatTime(Date.now() - w.start);

    setInterval(() => {
      time.textContent = formatTime(Date.now() - w.start);
    }, 1000);

    li.innerHTML = `<strong>${w.id}. ${w.name}</strong>`;
    li.appendChild(time);

    const del = document.createElement("button");
    del.textContent = "삭제";
    del.className = "delete";
    del.onclick = () => {
      const i = waits.indexOf(w);
      waits.splice(i, 1);
      renderWaits();
    };
    li.appendChild(del);

    li.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", JSON.stringify(w));
    });

    waitList.appendChild(li);
  });
}

/* 드롭 → 박스 생성 */
board.addEventListener("dragover", e => e.preventDefault());
board.addEventListener("drop", e => {
  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  const idx = waits.findIndex(w => w.id === data.id);
  if (idx > -1) waits.splice(idx, 1);
  createBox(data.name, data.start, e.offsetX, e.offsetY);
  renderWaits();
});

/* 박스 */
function createBox(name, start, x, y) {
  const box = document.createElement("div");
  box.className = "box";
  box.style.left = x + "px";
  box.style.top = y + "px";

  const title = document.createElement("h3");
  title.textContent = name;
  title.ondblclick = () => {
    const v = prompt("이름 수정", title.textContent);
    if (v) title.textContent = v;
  };

  const time = document.createElement("div");
  time.className = "wait-time";
  setInterval(() => {
    time.textContent = formatTime(Date.now() - start);
  }, 1000);

  const resize = document.createElement("div");
  resize.className = "resize";

  box.append(title, time, resize);
  board.appendChild(box);

  // 이동
  let dragging = false, ox, oy;
  box.onmousedown = e => {
    if (e.target === resize) return;
    dragging = true;
    ox = e.offsetX;
    oy = e.offsetY;
    box.classList.add("selected");
  };

  document.onmousemove = e => {
    if (!dragging) return;
    box.style.left = e.pageX - board.offsetLeft - ox + "px";
    box.style.top = e.pageY - board.offsetTop - oy + "px";
  };

  document.onmouseup = () => dragging = false;

  // 리사이즈
  resize.onmousedown = e => {
    e.stopPropagation();
    const startX = e.pageX;
    const startY = e.pageY;
    const w = box.offsetWidth;
    const h = box.offsetHeight;

    document.onmousemove = ev => {
      box.style.width = w + (ev.pageX - startX) + "px";
      box.style.height = h + (ev.pageY - startY) + "px";
    };
    document.onmouseup = () => document.onmousemove = null;
  };
}
