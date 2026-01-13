const waitInput = document.getElementById("waitInput");
const addWaitBtn = document.getElementById("addWait");
const waitList = document.getElementById("waitList");
const board = document.getElementById("board");

let waits = [];
let cards = [];
let zoom = 1;

function renderWaits() {
  waitList.innerHTML = "";
  waits.forEach((name, i) => {
    const div = document.createElement("div");
    div.className = "wait-item";
    div.draggable = true;
    div.innerHTML = `<span>${i + 1}. ${name}</span><button>삭제</button>`;

    div.ondragstart = e => {
      e.dataTransfer.setData("text/plain", name);
    };

    div.querySelector("button").onclick = () => {
      waits.splice(i, 1);
      renderWaits();
    };

    waitList.appendChild(div);
  });
}

addWaitBtn.onclick = () => {
  if (!waitInput.value.trim()) return;
  waits.push(waitInput.value.trim());
  waitInput.value = "";
  renderWaits();
};

board.ondragover = e => e.preventDefault();

board.ondrop = e => {
  const name = e.dataTransfer.getData("text/plain");
  const idx = waits.indexOf(name);
  if (idx === -1) return;
  waits.splice(idx, 1);
  renderWaits();
  createCard(name, e.offsetX, e.offsetY);
};

function createCard(name, x, y) {
  const div = document.createElement("div");
  div.className = "card";
  div.style.left = x + "px";
  div.style.top = y + "px";
  div.innerHTML = `<strong>${name}</strong>`;

  let offsetX, offsetY;

  div.onmousedown = e => {
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    document.onmousemove = ev => {
      div.style.left = ev.pageX - board.offsetLeft - offsetX + "px";
      div.style.top = ev.pageY - board.offsetTop - offsetY + "px";
    };
    document.onmouseup = () => {
      document.onmousemove = null;
    };
  };

  board.appendChild(div);
}
