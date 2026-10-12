/* ---------- start-up ---------- */
tipEl = $("#tip");
document.addEventListener("input", onInput);
document.addEventListener("change", function (e) { if (e.target.type === "radio") onInput(e); });
document.addEventListener("click", onClick);
document.addEventListener("pointerover", function (e) { var b = helpBtn(e); if (b && e.pointerType !== "touch" && !pinned) showTip(b); });
document.addEventListener("pointerout", function (e) { var b = helpBtn(e); if (b && e.pointerType !== "touch" && !pinned) hideTip(); });
document.addEventListener("focusin", function (e) { var b = helpBtn(e); if (b) showTip(b); });
document.addEventListener("focusout", function (e) { if (helpBtn(e)) hideTip(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(); });
window.addEventListener("scroll", function () { if (tipFor) hideTip(); }, { passive: true });
document.addEventListener("toggle", function (e) { if (e.target.id) state.open[e.target.id] = e.target.open; }, true);
initDownloads();
render(false);

var rzT, lastW = window.innerWidth;
window.addEventListener("resize", function () {
  clearTimeout(rzT);
  rzT = setTimeout(function () { if (state.step === STEPS.length - 1 && Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; renderResults(); } }, 150);
});
