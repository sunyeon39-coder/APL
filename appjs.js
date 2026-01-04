
// o-button popover responsive sizing

function updateBoxSizeClass(boxEl){
  const w = boxEl.offsetWidth;
  const h = boxEl.offsetHeight;

  boxEl.classList.remove("small","tiny");

  if (w < 180 || h < 100) boxEl.classList.add("small");
  if (w < 140 || h < 80) boxEl.classList.add("tiny");
}

function attachBox(boxEl){
  updateBoxSizeClass(boxEl);
  new ResizeObserver(()=>updateBoxSizeClass(boxEl)).observe(boxEl);
}
