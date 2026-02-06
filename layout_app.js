const seatGrid = document.getElementById("seatGrid");
const waitingGrid = document.getElementById("waitingGrid");

const addSeatBtn = document.getElementById("addSeatBtn");
const addWaitingBtn = document.getElementById("addWaitingBtn");
const waitingInput = document.getElementById("waitingInput");

let seats = [];
let waiting = [];

let selectedSeat = null;
let selectedWaiting = null;

/* ======================
   RENDER
====================== */
function render() {
  seatGrid.innerHTML = "";
  waitingGrid.innerHTML = "";

  seats.forEach((name, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.textContent = name;

    if (selectedSeat === i) card.style.outline = "2px solid #6b7cff";

    card.onclick = () => {
      if (selectedWaiting !== null) {
        seats[i] = waiting[selectedWaiting];
        waiting.splice(selectedWaiting, 1);
        selectedWaiting = null;
      } else {
        selectedSeat = i;
      }
      render();
    };

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.onclick = e => {
      e.stopPropagation();
      seats.splice(i, 1);
      render();
    };

    card.appendChild(del);
    seatGrid.appendChild(card);
  });

  waiting.forEach((name, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.textContent = name;

    if (selectedWaiting === i) card.style.outline = "2px solid #ffd166";

    card.onclick = () => {
      if (selectedSeat !== null) {
        seats[selectedSeat] = name;
        selectedSeat = null;
        waiting.splice(i, 1);
      } else {
        selectedWaiting = i;
      }
      render();
    };

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.onclick = e => {
      e.stopPropagation();
      waiting.splice(i, 1);
      render();
    };

    card.appendChild(del);
    waitingGrid.appendChild(card);
  });
}

/* ======================
   EVENTS
====================== */
addSeatBtn.onclick = () => {
  seats.push("Seat " + (seats.length + 1));
  render();
};

addWaitingBtn.onclick = () => {
  if (!waitingInput.value.trim()) return;
  waiting.push(waitingInput.value.trim());
  waitingInput.value = "";
  render();
};

render();
