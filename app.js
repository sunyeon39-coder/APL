const waitingList = document.getElementById("waitingList");
const board = document.getElementById("board");
const addBtn = document.getElementById("addBtn");
const nameInput = document.getElementById("nameInput");

let id = 1;

addBtn.onclick = () => {
  if (!nameInput.value.trim()) return;

  const li = document.createElement("li");
  li.className = "waiting-item";
  li.draggable = true;
  li.dataset.id = id++;

  li.innerHTML = `
    <div>
      <strong>${nameInput.value}</strong><br/>
      <span class="timer">대기 00:00</span>
    </div>
    <button>삭제</button>
  `;

  li.querySelector("button").onclick = () => li.remove();

  li.ondragstart = e => {
    e.dataTransfer.setData("text/plain", li.dataset.id);
    li.classList.add("dragging");
  };

  waitingList.appendChild(li);
  nameInput.value = "";
};

board.ondragover = e => e.preventDefault();

board.ondrop = e => {
  e.preventDefault();
  const dragged = document.querySelector(".dragging");
  if (!dragged) return;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h3>${dragged.querySelector("strong").innerText}</h3>
    <div class="timer">대기 00:00</div>
  `;

  board.appendChild(card);
  dragged.remove();
};

setInterval(() => {
  document.querySelectorAll(".timer").forEach(t => {
    let [m, s] = t.innerText.match(/\d+/g).map(Number);
    s++;
    if (s === 60) { s = 0; m++; }
    t.innerText = `대기 ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  });
}, 1000);
