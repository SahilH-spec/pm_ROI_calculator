/* ---------- exports: CSV and PDF ---------- */
function notify(msg) {
  var t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(notify.t); notify.t = setTimeout(function () { t.hidden = true; }, 4500);
}
function ascii(s) { return String(s == null ? "" : s).replace(/−/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, ""); }
function slug() { return ascii(state.p.prospect).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function today() { var d = new Date(), z = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); }
function fileName(ext) { return "roi-report" + (slug() ? "-" + slug() : "") + "-" + today() + "." + ext; }

var capPromise = null;
function initDownloads() {
  if (window.claude && window.claude.use) {
    capPromise = Promise.resolve().then(function () { return window.claude.use("downloads"); }).catch(function () { return null; });
    capPromise.then(function (cap) { if (!cap) document.body.classList.add("no-dl"); });
  }
}
function saveFile(name, data, mime) {
  if (capPromise) {
    return capPromise.then(function (cap) {
      if (!cap) { notify("Downloads are not available in this view."); return; }
      return cap.save({ filename: name, data: data }).then(function () { notify("Saved " + name); }, function (err) {
        notify(err && err.code === "declined" ? "Download cancelled." : "Could not save the file: " + ((err && err.message) || "unknown error"));
      });
    });
  }
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  return Promise.resolve();
}

function csvCell(v) {
  if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 100) / 100) : "";
  var s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCSV() {
  var c = compute(); if (!c.ready) { notify("Add units, a team and a price before downloading."); return; }
  var p = state.p, rows = [], R = function () { rows.push(Array.prototype.slice.call(arguments)); }, B = function () { rows.push([]); };
  R("Property ROI report"); R("Prepared", today()); if (p.prospect) R("Prospect", p.prospect);
  R("Scenario shown", SCEN_LABEL[state.scenario]); R("Share of benefit that shows up", state.realization, "%");
  if (state.example) R("Warning", "Contains example data");
  B(); R("INPUTS"); R("Portfolio");
  R("Units under management", p.units); R("Average monthly rent", p.avgRent, "USD"); R("Turnovers per year", p.turns); R("Management fee", p.mgmtFee, "%");
  R("Units added per year", p.growthUnits); R("Current setup", MATURITY_OPTS.filter(function (o) { return o[0] === p.maturity; })[0][1]);
  B(); R("Team"); R.apply(null, ["Role", "People", "Annual salary"].concat(WF.map(function (w) { return w[1] + " (hours per week)"; })));
  p.roles.forEach(function (r) { R.apply(null, [r.name, num(r.fte), num(r.salary)].concat(WF.map(function (w) { return num(r.hours[w[0]]); }))); });
  B(); R("Current tools"); R("Tool", "Monthly cost", "Percent replaced", "Months left on contract");
  p.tools.forEach(function (t) { R(t.name, num(t.monthly), num(t.replacePct), num(t.monthsLeft)); });
  B(); R("Platform quote"); R("Price per unit per month", num(p.perUnit), "USD"); R("Monthly minimum", num(p.minimum), "USD");
  R("Setup, months of fees", num(p.implMonths)); R("Migration hours", num(p.migrationHours)); R("Net change in usage fees per year", num(p.usageDelta), "USD"); R("Hires otherwise planned", num(p.plannedHires), "people");
  B(); R("RESULTS"); R("Measure", "Conservative", "Expected", "Optimistic", "Unit");
  var m = [
    ["Hours freed per year", "freed_hours", 1, "hours"], ["Full-time equivalent freed", "freed_fte", 1, "people"], ["Cash benefit, 3 years", "cash_benefit_3y", 1, "USD"],
    ["  Cancelled tools", "toolB", 1, "USD"], ["  Hires avoided", "hireB", 1, "USD"], ["  Management-fee revenue", "vacB", 1, "USD"],
    ["Cost, 3 years", "cost_3y", 1, "USD"], ["  Subscription", "sub_3y", 1, "USD"], ["  Usage fees", "usage_3y", 1, "USD"], ["  Setup and migration", "one_time_3y", 1, "USD"],
    ["Cash ROI", "cash_roi", 100, "%"], ["Total ROI with redeployed capacity", "total_roi", 100, "%"], ["Net present value, cash", "npv_cash", 1, "USD"],
    ["Payback month", "payback_month_cash", 1, "month, blank if none"], ["Break-even share of benefit", "be", 100, "%"], ["Cash ROI with no hires avoided", "noHireRoi", 100, "%"],
    ["Capacity value per year", "cap_value_yr", 1, "USD"], ["Owner value, 3 years (kept separate)", "owner_vac_3y", 1, "USD"]
  ];
  m.forEach(function (x) { R.apply(null, [x[0]].concat(SCEN_KEYS.map(function (k) { var v = c.res[k][x[1]]; return v == null ? "" : (isFinite(v) ? v * x[2] : ""); }), [x[3]])); });
  B(); R("MONTHLY SCHEDULE"); R("Month", "Cost", "Cash benefit, conservative", "Cash benefit, expected", "Cash benefit, optimistic", "Cumulative net, conservative", "Cumulative net, expected", "Cumulative net, optimistic");
  for (var i = 0; i < 36; i++) R(i + 1, c.res.expected.monthly[i].cost, c.res.conservative.monthly[i].cash, c.res.expected.monthly[i].cash, c.res.optimistic.monthly[i].cash, c.res.conservative.cumulative[i], c.res.expected.cumulative[i], c.res.optimistic.cumulative[i]);
  B(); R("ASSUMPTIONS"); R("Loaded hourly cost = salary x 1.30 / 1880 hours (BLS compensation data)"); R("Wage growth 3.4% a year (BLS ECI); discount rate 10%; subscription escalator 3% a year");
  R("Time saved by workflow, adoption ramp, current-setup factors and hire credit are judgment, not measured data"); R("Cash excludes owner value and freed hours not converted to savings");
  saveFile(fileName("csv"), "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"), "text/csv");
}

function exportPDF() {
  var J = window.jspdf && window.jspdf.jsPDF;
  if (!J) { notify("The PDF library did not load. Check the connection and try again."); return; }
  var c = compute(); if (!c.ready) { notify("Add units, a team and a price before downloading."); return; }
  var doc = new J({ unit: "pt", format: "letter" }), W = 612, H = 792, M = 48, CW = W - 2 * M, y = M, pageNo = 1;
  var INK = [20, 48, 77], SOFT = [71, 102, 133], LIGHT = [223, 236, 249], LINE = [197, 218, 240], WASH = [244, 248, 253], MID = [122, 165, 209];
  var p = state.p, r = c.sel, s = state.scenario;
  var A = function (t) { return ascii(t); };
  function footer() {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor.apply(doc, SOFT);
    doc.text("Model estimate, not a guarantee. Time-savings percentages are judgment; see assumptions.", M, H - 28);
    doc.text("Page " + pageNo, W - M, H - 28, { align: "right" });
  }
  function page() { footer(); doc.addPage(); pageNo++; y = M; }
  function need(h) { if (y + h > H - 48) page(); }
  function txt(str, o) {
    o = o || {}; doc.setFont(o.font || "helvetica", o.style || "normal"); doc.setFontSize(o.size || 10); doc.setTextColor.apply(doc, o.color || INK);
    var lines = doc.splitTextToSize(A(str), o.w || CW), lh = (o.size || 10) * 1.35;
    need(lines.length * lh); lines.forEach(function (l) { doc.text(l, o.x == null ? M : o.x, y + (o.size || 10)); y += lh; });
    y += o.after == null ? 4 : o.after;
  }
  function h2(str) { need(40); y += 8; txt(str, { font: "times", size: 16, after: 6 }); }
  function table(widths, head, rows, o) {
    o = o || {}; var fs = o.size || 9, x0 = M, aligns = o.align || [];
    function rowH(cells) { return Math.max.apply(null, cells.map(function (t, i) { return doc.splitTextToSize(A(t), widths[i] - 10).length; })) * (fs * 1.3) + 6; }
    function draw(cells, isHead, shade) {
      var h = rowH(cells); need(h);
      if (isHead) { doc.setFillColor.apply(doc, LIGHT); doc.rect(x0, y, widths.reduce(function (a, b) { return a + b; }, 0), h, "F"); }
      else if (shade) { doc.setFillColor.apply(doc, WASH); doc.rect(x0, y, widths.reduce(function (a, b) { return a + b; }, 0), h, "F"); }
      doc.setFont("helvetica", isHead ? "bold" : "normal"); doc.setFontSize(fs); doc.setTextColor.apply(doc, INK);
      var cx = x0; cells.forEach(function (t, i) {
        var lines = doc.splitTextToSize(A(t), widths[i] - 10);
        lines.forEach(function (l, li) { doc.text(l, aligns[i] === "r" ? cx + widths[i] - 5 : cx + 5, y + 4 + fs + li * fs * 1.3, { align: aligns[i] === "r" ? "right" : "left" }); });
        cx += widths[i];
      });
      doc.setDrawColor.apply(doc, LINE); doc.setLineWidth(0.5); doc.line(x0, y + h, x0 + widths.reduce(function (a, b) { return a + b; }, 0), y + h);
      y += h;
    }
    var total = rowH(head) + rows.reduce(function (a, row) { return a + rowH(row); }, 0), tH = o.title ? 34 : 0;
    if (total + tH <= H - 2 * M - 40 && y + total + tH > H - 48) page();
    if (o.title) h2(o.title);
    draw(head, true); rows.forEach(function (row, i) { draw(row, false, o.shade === i); }); y += 8;
  }

  // ---- page 1: summary ----
  txt("Property ROI report", { font: "times", size: 26, after: 4 });
  txt((p.prospect ? p.prospect + "  |  " : "") + today() + "  |  " + SCEN_LABEL[s] + " scenario, " + state.realization + "% of modeled benefit", { size: 10, color: SOFT, after: 10 });
  if (state.example) { doc.setFillColor.apply(doc, LIGHT); doc.rect(M, y, CW, 24, "F"); txt("This report contains example data. Replace it with the prospect's numbers before sharing.", { x: M + 8, w: CW - 16, size: 9.5, after: 12 }); y += 4; }
  var be = r.be;
  txt(be <= 1 ? "Pays for itself if " + pct(be) + " of the modeled cash benefit shows up." : "Not paid back in 36 months. It would need " + pct(be) + " of the modeled cash benefit.", { font: "times", size: 18, after: 12 });
  var kp = [["Cash ROI, 3 years", pct(r.cash_roi, true)], ["Net present value", money(r.npv_cash)], ["Payback", r.payback_month_cash ? "Month " + r.payback_month_cash : "None in 36 months"], ["Break-even", pct(be)]], kw = CW / 4;
  need(60); kp.forEach(function (k, i) {
    doc.setFillColor.apply(doc, i % 2 ? WASH : LIGHT); doc.rect(M + i * kw, y, kw, 54, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor.apply(doc, SOFT); doc.text(A(k[0]), M + i * kw + 8, y + 16);
    doc.setFont("times", "normal"); doc.setFontSize(18); doc.setTextColor.apply(doc, INK); doc.text(A(k[1]), M + i * kw + 8, y + 40);
  }); y += 68;
  h2("Three buckets");
  txt("Cash: " + money(r.cash_benefit_3y - r.cost_3y) + " net over 3 years (" + money(r.cash_benefit_3y) + " in, " + money(r.cost_3y) + " out). " + pct(r.hireShare) + " of the benefit depends on hires avoided; with none, cash ROI is " + pct(r.noHireRoi, true) + ".");
  txt("Capacity: " + int(r.freed_hours) + " hours a year, about " + one(r.freed_fte) + " full-time people (" + pct(r.g) + " of team time) once fully adopted, worth " + money(r.cap_value_yr) + " a year at loaded cost. This is cash only if a hire is skipped.");
  txt("Owner value: " + money(r.owner_vac_3y) + " of rent recovered for owners over 3 years. Kept separate and never added to the company's return.");
  table([CW * 0.7, CW * 0.3], ["Item", "Amount"], [["Cancelled tools", money(r.toolB)], ["Hires avoided (growth and planned)", money(r.hireB)], ["Management-fee revenue from fewer vacant days", money(r.vacB)], ["Total cash benefit", money(r.cash_benefit_3y)], ["Subscription", money(r.sub_3y)], ["Usage fees", money(r.usage_3y)], ["Setup and migration", money(r.one_time_3y)], ["Total cost", money(r.cost_3y)]], { align: ["l", "r"], title: "Cash in and out, 3 years" });
  var cmp = [["Hours freed per year", function (x) { return int(x.freed_hours); }], ["Cash benefit, 3 years", function (x) { return money(x.cash_benefit_3y); }], ["Cost, 3 years", function (x) { return money(x.cost_3y); }], ["Cash ROI", function (x) { return pct(x.cash_roi, true); }], ["Total ROI with redeployed capacity", function (x) { return pct(x.total_roi, true); }], ["Net present value", function (x) { return money(x.npv_cash); }], ["Payback", function (x) { return x.payback_month_cash ? "Month " + x.payback_month_cash : "None"; }], ["Break-even share of benefit", function (x) { return pct(x.be); }], ["Cash ROI with no hires avoided", function (x) { return pct(x.noHireRoi, true); }]];
  table([CW * 0.4, CW * 0.2, CW * 0.2, CW * 0.2], ["Measure"].concat(SCEN_KEYS.map(function (k) { return SCEN_LABEL[k]; })), cmp.map(function (row) { return [row[0]].concat(SCEN_KEYS.map(function (k) { return row[1](c.res[k]); })); }), { align: ["l", "r", "r", "r"], title: "Scenarios side by side" });

  // ---- chart ----
  need(300); h2("Cumulative net cash by month");
  var g = chartGeom(c), cx0 = M + 44, cy0 = y + 6, cw = CW - 44 - 90, ch = 190, sc = g.sc;
  var X = function (m) { return cx0 + m / 36 * cw; }, Y = function (v) { return cy0 + (sc.hi - v) / (sc.hi - sc.lo) * ch; };
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setLineWidth(0.4);
  for (var v = sc.lo; v <= sc.hi + sc.step / 2; v += sc.step) { doc.setDrawColor.apply(doc, LIGHT); doc.line(cx0, Y(v), cx0 + cw, Y(v)); doc.setTextColor.apply(doc, SOFT); doc.text(A(kfmt(v)), cx0 - 6, Y(v) + 3, { align: "right" }); }
  doc.setDrawColor.apply(doc, MID); doc.setLineWidth(0.8); doc.line(cx0, Y(0), cx0 + cw, Y(0));
  for (var mo = 0; mo <= 36; mo += 6) { doc.setTextColor.apply(doc, SOFT); doc.text(String(mo), X(mo), cy0 + ch + 14, { align: "center" }); }
  doc.text("Months after go-live", cx0 + cw / 2, cy0 + ch + 28, { align: "center" });
  var ends = [];
  SCEN_KEYS.forEach(function (k) {
    var cum = [0].concat(c.res[k].cumulative), sel = k === s;
    doc.setDrawColor.apply(doc, sel ? INK : MID); doc.setLineWidth(sel ? 1.8 : 1.1);
    doc.setLineDashPattern(k === "conservative" ? [] : k === "expected" ? [6, 4] : [2, 3], 0);
    for (var i = 1; i <= 36; i++) doc.line(X(i - 1), Y(cum[i - 1]), X(i), Y(cum[i]));
    doc.setLineDashPattern([], 0); ends.push({ k: k, y: Y(cum[36]) });
  });
  ends.sort(function (a, b) { return a.y - b.y; }); for (var e = 1; e < ends.length; e++) if (ends[e].y - ends[e - 1].y < 11) ends[e].y = ends[e - 1].y + 11;
  ends.forEach(function (l) { doc.setFont("helvetica", l.k === s ? "bold" : "normal"); doc.setFontSize(8.5); doc.setTextColor.apply(doc, INK); doc.text(SCEN_LABEL[l.k], cx0 + cw + 6, l.y + 3); });
  y = cy0 + ch + 44;
  table([CW * 0.25, CW * 0.25, CW * 0.25, CW * 0.25], ["Month"].concat(SCEN_KEYS.map(function (k) { return SCEN_LABEL[k]; })), [6, 12, 18, 24, 30, 36].map(function (m) { return [String(m)].concat(SCEN_KEYS.map(function (k) { return money(c.res[k].cumulative[m - 1]); })); }), { align: ["l", "r", "r", "r"] });

  // ---- inputs ----
  table([CW * 0.6, CW * 0.4], ["Portfolio", "Value"], [["Units under management", int(num(p.units))], ["Average monthly rent", money(num(p.avgRent))], ["Turnovers per year", int(num(p.turns))], ["Management fee", num(p.mgmtFee) + "%"], ["Units added per year", int(num(p.growthUnits))], ["Current setup", MATURITY_OPTS.filter(function (o) { return o[0] === p.maturity; })[0][1]]], { align: ["l", "r"], title: "Inputs" });
  table([CW * 0.4, CW * 0.15, CW * 0.2, CW * 0.25], ["Role", "People", "Salary", "Hours per week"], p.roles.map(function (rr) { return [rr.name, one(num(rr.fte)), money(num(rr.salary)), int(WF.reduce(function (a, w) { return a + num(rr.hours[w[0]]); }, 0))]; }), { align: ["l", "r", "r", "r"] });
  var wfRows = WF.map(function (w) { return [w[1]].concat(p.roles.map(function (rr) { return rr.hours[w[0]] ? int(num(rr.hours[w[0]])) : "-"; })); }), rw = (CW * 0.4) / Math.max(1, p.roles.length);
  table([CW * 0.48].concat(p.roles.map(function () { return CW * 0.52 / Math.max(1, p.roles.length); })), ["Hours per week by workflow"].concat(p.roles.map(function (rr) { var n = rr.name || "Role"; return n.length > 9 ? n.split(" ")[0].slice(0, 9) : n; })), wfRows, { align: ["l"].concat(p.roles.map(function () { return "r"; })), size: 8.5 });
  if (p.tools.length) table([CW * 0.4, CW * 0.2, CW * 0.2, CW * 0.2], ["Tool", "Monthly cost", "Replaced", "Months left"], p.tools.map(function (t) { return [t.name, money(num(t.monthly)), num(t.replacePct) + "%", String(num(t.monthsLeft))]; }), { align: ["l", "r", "r", "r"] });
  table([CW * 0.6, CW * 0.4], ["Platform quote", "Value"], [["Price per unit per month", money2(num(p.perUnit))], ["Monthly minimum", money(num(p.minimum))], ["Setup, months of fees", one(num(p.implMonths))], ["Migration hours", int(num(p.migrationHours))], ["Net change in usage fees per year", money(num(p.usageDelta))], ["Hires otherwise planned", one(num(p.plannedHires))]], { align: ["l", "r"] });

  // ---- checks and assumptions ----
  var fl = flagsFor(c); if (fl.length) { h2("Check before you present"); fl.forEach(function (f) { txt("- " + f, { size: 9.5 }); }); }
  table([CW * 0.28, CW * 0.44, CW * 0.28], ["Item", "Value", "Source"], [
    ["Loaded hourly cost", "Salary x 1.30 / 1,880 hours", "BLS compensation data"], ["Hours worked per year", "47 weeks", "Judgment"], ["Wage growth", "3.4% a year", "BLS Employment Cost Index"],
    ["Discount rate", "10% a year", "Judgment"], ["Subscription escalator", "3% a year", "Judgment"], ["Adoption ramp", "25%, 60%, 85%, then 100% of savings, by quarter", "Judgment"],
    ["Time saved by workflow", "Re-entry 40%, owner reports 35%, rent 30%, accounting 25%, renewals 20%, leasing, maintenance, inspections 15%, communications 10%, before the scenario multiplier (0.6, 1.0, 1.5)", "Judgment; no independent study found"],
    ["Current-setup factors", "100%, 85%, 55%, 30% of savings kept", "Judgment"], ["Hire credit", "50% conservative, 100% expected and optimistic", "Judgment"], ["Vacant days saved per turn", "0, 0, 2 by scenario", "Judgment; no causal evidence for more"],
    ["Default role salaries", "BLS median wages, May 2024", "BLS Occupational Outlook Handbook"], ["Reference platform rates", "$1.49, $3.20, $5.00 per unit; quote-only now", "Third-party reported, 2024"]
  ], { size: 8.5, title: "Assumptions and sources" });
  footer();
  saveFile(fileName("pdf"), doc.output("arraybuffer"), "application/pdf");
}
