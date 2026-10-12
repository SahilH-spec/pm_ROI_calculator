/* ---------- app state and helpers ---------- */
var E = window.ROIEngine;
var MINUS = "−";
var SCEN_KEYS = ["conservative", "expected", "optimistic"];
var SCEN_LABEL = { conservative: "Conservative", expected: "Expected", optimistic: "Optimistic" };
var TIERS = { entry: { label: "Entry", perUnit: 1.49, minimum: 298 }, mid: { label: "Mid", perUnit: 3.20, minimum: 960 }, top: { label: "Top", perUnit: 5.00, minimum: 7500 } };
var WF = [
  ["rent", "Rent collection and delinquency"], ["acct", "Accounting and reconciliation"], ["owner", "Owner statements and reporting"],
  ["leasing", "Leasing"], ["maint", "Maintenance coordination"], ["comms", "Tenant communications"],
  ["renewals", "Renewals"], ["inspect", "Inspections"], ["reentry", "Duplicate data re-entry"]
];
var MATURITY_OPTS = [
  ["M0", "Spreadsheets or paper", "QuickBooks, spreadsheets, paper files."],
  ["M1", "Older or basic system", "A basic property system plus several add-ons."],
  ["M2", "Modern, mostly integrated", "A current system with most tools connected."],
  ["M3", "Already on a comparable platform", "Well adopted, little left to gain."]
];
var STEPS = [
  { title: "Portfolio", sub: "Size and shape" },
  { title: "Team", sub: "Who does the work" },
  { title: "Time", sub: "Where the hours go" },
  { title: "Tools", sub: "What they pay for today" },
  { title: "Quote", sub: "What the platform costs" },
  { title: "Results", sub: "The business case" }
];

var BLS = { pm: 66700, lease: 47460, maint: 50340, book: 49210 };
var uid = 0;
function nid() { return ++uid; }

function hrs(a) { var o = {}; WF.forEach(function (w, i) { o[w[0]] = a[i] || 0; }); return o; }

function exampleState() {
  return {
    prospect: "", units: 500, avgRent: 1600, turns: 175, mgmtFee: 8, growthUnits: 50, maturity: "M2",
    roles: [
      { id: nid(), name: "Property managers", salary: BLS.pm, fte: 2, hours: hrs([8, 6, 8, 10, 20, 12, 4, 6, 6]) },
      { id: nid(), name: "Leasing and admin", salary: BLS.lease, fte: 2, hours: hrs([6, 2, 0, 40, 10, 14, 6, 0, 2]) },
      { id: nid(), name: "Maintenance coordinator", salary: BLS.maint, fte: 1, hours: hrs([0, 2, 0, 0, 30, 6, 0, 0, 2]) },
      { id: nid(), name: "Bookkeeper or accountant", salary: BLS.book, fte: 1, hours: hrs([6, 22, 8, 0, 0, 0, 0, 0, 4]) }
    ],
    tools: [
      { id: nid(), name: "Accounting", monthly: 250, replacePct: 80, monthsLeft: 0 },
      { id: nid(), name: "Screening", monthly: 150, replacePct: 50, monthsLeft: 0 },
      { id: nid(), name: "E-sign", monthly: 90, replacePct: 100, monthsLeft: 0 },
      { id: nid(), name: "Maintenance dispatch", monthly: 200, replacePct: 50, monthsLeft: 0 },
      { id: nid(), name: "Marketing and leads", monthly: 300, replacePct: 30, monthsLeft: 0 }
    ],
    perUnit: TIERS.mid.perUnit, minimum: TIERS.mid.minimum, implMonths: 2, migrationHours: 60, usageDelta: 3000, plannedHires: 0.5
  };
}
function blankState() {
  return {
    prospect: "", units: "", avgRent: "", turns: "", mgmtFee: "", growthUnits: "", maturity: "M1",
    roles: [
      { id: nid(), name: "Property managers", salary: BLS.pm, fte: "", hours: {} },
      { id: nid(), name: "Leasing and admin", salary: BLS.lease, fte: "", hours: {} },
      { id: nid(), name: "Maintenance coordinator", salary: BLS.maint, fte: "", hours: {} },
      { id: nid(), name: "Bookkeeper or accountant", salary: BLS.book, fte: "", hours: {} }
    ],
    tools: [],
    perUnit: TIERS.entry.perUnit, minimum: TIERS.entry.minimum, implMonths: 2, migrationHours: 60, usageDelta: "", plannedHires: ""
  };
}

var state = { step: 0, scenario: "conservative", realization: 100, tier: "mid", example: true, p: exampleState(), open: {} };

function num(x) { x = Number(x); return isFinite(x) ? x : 0; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(x) { if (!isFinite(x)) return "n/a"; var r = Math.round(x); return (r < 0 ? MINUS : "") + "$" + Math.abs(r).toLocaleString("en-US"); }
function money2(x) { if (!isFinite(x)) return "n/a"; var r = Math.round(x * 100) / 100; return (r < 0 ? MINUS : "") + "$" + Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(x, signed) { if (!isFinite(x)) return "n/a"; var r = Math.round(x * 100); return (signed && r > 0 ? "+" : "") + (r < 0 ? MINUS : "") + Math.abs(r) + "%"; }
function int(x) { return Math.round(x).toLocaleString("en-US"); }
function one(x) { return (Math.round(x * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function getPath(path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, state.p); }
function setPath(path, v) { var parts = path.split("."), o = state.p; for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; }

/* ---------- model input and results ---------- */
function engineInput() {
  var p = state.p;
  return {
    units: num(p.units), avgRent: num(p.avgRent), turns: num(p.turns), mgmtFee: num(p.mgmtFee) / 100,
    growthUnits: num(p.growthUnits), maturity: p.maturity, perUnit: num(p.perUnit), minimum: num(p.minimum),
    implMonths: num(p.implMonths), migrationHours: num(p.migrationHours), usageDelta: num(p.usageDelta), plannedHires: num(p.plannedHires),
    roles: p.roles.map(function (r) { return { name: r.name || "Role", salary: num(r.salary), fte: num(r.fte), hours: r.hours }; }),
    tools: p.tools.map(function (t) { return { name: t.name, monthly: num(t.monthly), replacePct: num(t.replacePct) / 100, monthsLeft: num(t.monthsLeft) }; })
  };
}
function totalFte() { return state.p.roles.reduce(function (a, r) { return a + num(r.fte); }, 0); }

function compute() {
  var p = engineInput();
  var ready = p.units > 0 && totalFte() > 0 && (p.perUnit > 0 || p.minimum > 0);
  if (!ready) return { ready: false, p: p };
  var bs = state.realization / 100, res = {};
  SCEN_KEYS.forEach(function (s) {
    var r = E.run(p, s, { benefitScale: bs });
    r.be = r.breakeven_cash * bs;
    r.toolB = r.tool_3y * bs;
    r.hireB = E.SCEN[s].hire_credit * (r.growth_3y + r.planned_3y) * bs;
    r.vacB = r.pmc_vac_3y * bs;
    r.hireShare = r.cash_benefit_3y ? r.hireB / r.cash_benefit_3y : 0;
    r.noHireRoi = r.cost_3y ? (r.toolB + r.vacB - r.cost_3y) / r.cost_3y : 0;
    res[s] = r;
  });
  return { ready: true, p: p, res: res, sel: res[state.scenario] };
}

function flagsFor(c) {
  var out = [], p = state.p, e = c.p, fte = totalFte();
  if (c.ready) {
    var upf = e.units / fte;
    if (upf < 30 || upf > 110) out.push("Units per full-time person is " + one(upf) + ". Most portfolios fall between roughly 30 and 110, so check the unit and headcount numbers.");
    p.roles.forEach(function (r) {
      var tot = WF.reduce(function (a, w) { return a + num(r.hours[w[0]]); }, 0), cap = num(r.fte) * 40;
      if (cap > 0 && tot > cap * 1.1) out.push((r.name || "A role") + " has " + int(tot) + " hours a week entered against " + int(cap) + " available (" + one(num(r.fte)) + " people at 40 hours).");
    });
    var eff = c.sel.monthly_sub / e.units;
    if (e.perUnit > 0 && eff > 2 * e.perUnit) out.push("The monthly minimum makes the effective price " + money2(eff) + " per unit, " + one(eff / e.perUnit) + " times the quoted rate.");
    if (p.usageDelta === "") out.push("Net change in usage fees is empty, so it counts as zero. This is the input most likely to change the answer; ask about payments and screening.");
    if (num(p.growthUnits) === 0 && num(p.plannedHires) === 0) out.push("No growth and no planned hires entered. Without one of them the cash case is limited to cancelled tools; the case is capacity, not cash.");
    if (c.sel.hireShare > 0.7) out.push(pct(c.sel.hireShare) + " of the cash benefit in this scenario depends on hires the company has to actually skip.");
    if (c.sel.cap_bound) out.push("Modeled time savings reached the ceiling for this scenario, so the hours entered were scaled down.");
  }
  if (state.example) out.push("This report contains example data. Use Clear all and enter the prospect's numbers before presenting.");
  return out;
}

/* ---------- small html builders ---------- */
function help(key, label) {
  return '<button type="button" class="help" data-help="' + key + '" aria-label="About ' + esc(label) + '" aria-expanded="false">?</button>';
}
function field(o) {
  var id = "f-" + o.path.replace(/\./g, "-");
  var v = getPath(o.path);
  return '<div class="field"><div class="label-row"><label for="' + id + '">' + o.label + "</label>" + help(o.help, o.label) + "</div>" +
    '<div class="input">' + (o.prefix ? '<span class="adorn l">' + o.prefix + "</span>" : "") +
    '<input id="' + id + '" type="number" inputmode="decimal" min="' + (o.min == null ? 0 : o.min) + '" step="' + (o.step || "any") + '" data-bind="' + o.path + '" value="' + esc(v) + '"' + (o.ph ? ' placeholder="' + o.ph + '"' : "") + ">" +
    (o.suffix ? '<span class="adorn r">' + o.suffix + "</span>" : "") + "</div>" + (o.hint ? '<p class="hint">' + o.hint + "</p>" : "") + "</div>";
}
function head(title, lead, ask) {
  return '<div class="step-head"><h2 id="step-title" tabindex="-1">' + title + "</h2><p>" + lead + "</p>" +
    (ask ? '<p class="ask"><b>Ask on the call:</b> ' + ask + "</p>" : "") + "</div>";
}
function pager() {
  var s = state.step;
  return '<div class="pager"><button type="button" class="btn quiet" data-action="prev"' + (s === 0 ? " disabled" : "") + ">Back</button>" +
    (s < STEPS.length - 1 ? '<button type="button" class="btn" data-action="next">' + (s === STEPS.length - 2 ? "See results" : "Next: " + STEPS[s + 1].title) + "</button>" : "") + "</div>";
}

/* ---------- steps ---------- */
function stepPortfolio() {
  return head("Portfolio", "Start with the size and shape of the business. These numbers set the price of the platform and how much growth the team can absorb.",
    "How many doors do you manage today, and how many are you adding this year?") +
    '<div class="grid">' +
    '<div class="field" style="grid-column: 1 / -1; max-width: 520px"><div class="label-row"><label for="f-prospect">Prospect or company name</label>' + help("prospect", "Prospect or company name") + '</div><div class="input"><input id="f-prospect" type="text" data-bind="prospect" value="' + esc(state.p.prospect) + '" placeholder="Optional"></div></div>' +
    field({ label: "Units under management", help: "units", path: "units", ph: "e.g. 500" }) +
    field({ label: "Average monthly rent", help: "avgRent", path: "avgRent", prefix: "$", ph: "e.g. 1,600" }) +
    field({ label: "Turnovers per year", help: "turns", path: "turns", ph: "e.g. 175" }) +
    field({ label: "Management fee", help: "mgmtFee", path: "mgmtFee", suffix: "%", ph: "e.g. 8" }) +
    field({ label: "Units added per year", help: "growthUnits", path: "growthUnits", ph: "e.g. 50" }) +
    "</div>" +
    '<h3 class="section-title">Current setup ' + help("maturity", "Current setup") + "</h3>" +
    '<div class="cards" role="radiogroup" aria-label="Current setup">' +
    MATURITY_OPTS.map(function (o) {
      return '<label class="card-opt"><input type="radio" name="maturity" value="' + o[0] + '" data-bind="maturity"' + (state.p.maturity === o[0] ? " checked" : "") + '><span class="face"><b>' + o[1] + "</b><span>" + o[2] + "</span></span></label>";
    }).join("") + "</div>" + pager();
}

function stepTeam() {
  var rows = state.p.roles.map(function (r, i) {
    return "<tr><td><input type=\"text\" data-bind=\"roles." + i + ".name\" value=\"" + esc(r.name) + '" aria-label="Role name"></td>' +
      '<td class="num"><input class="n" type="number" inputmode="decimal" min="0" step="any" data-bind="roles.' + i + '.fte" value="' + esc(r.fte) + '" aria-label="People in ' + esc(r.name) + '" placeholder="0"></td>' +
      '<td class="num"><input class="n" style="width:120px" type="number" inputmode="decimal" min="0" step="any" data-bind="roles.' + i + '.salary" value="' + esc(r.salary) + '" aria-label="Annual salary for ' + esc(r.name) + '"></td>' +
      '<td class="num cell-note" id="rate-' + i + '"></td>' +
      '<td><button type="button" class="row-x" data-action="rm-role" data-i="' + i + '" aria-label="Remove ' + esc(r.name) + '">&times;</button></td></tr>';
  }).join("");
  return head("Team", "List the roles that touch these workflows. Salaries start at national medians, so replace them with what this company actually pays.",
    "Who handles rent, leasing, maintenance and the books, and roughly what do they earn?") +
    '<div class="table-wrap" style="max-width:880px"><table><thead><tr><th><span class="th-flex">Role ' + help("roleName", "Role") + '</span></th><th class="num"><span class="th-flex">People ' + help("fte", "People") + '</span></th><th class="num"><span class="th-flex">Annual salary ' + help("salary", "Annual salary") + '</span></th><th class="num">Loaded cost per hour</th><th></th></tr></thead><tbody>' + rows +
    '</tbody><tfoot><tr><td>Total</td><td class="num" id="tot-fte"></td><td colspan="3" id="tot-upf" class="num"></td></tr></tfoot></table></div>' +
    '<div class="table-actions"><button type="button" class="btn quiet small" data-action="add-role">Add a role</button></div>' + pager();
}

function stepTime() {
  var roles = state.p.roles;
  if (!roles.length) return head("Time", "Add a role on the previous step first.") + pager();
  var thead = "<tr><th class=\"sticky-col\"><span class=\"th-flex\">Hours per week, whole role " + help("hours", "Hours per week") + "</span></th>" +
    roles.map(function (r) { return '<th class="num">' + esc(r.name || "Role") + "</th>"; }).join("") + "</tr>";
  var body = WF.map(function (w) {
    return '<tr><td class="sticky-col"><span class="th-flex">' + w[1] + " " + help("wf_" + w[0], w[1]) + "</span></td>" +
      roles.map(function (r, i) {
        return '<td class="num"><input class="n" style="width:84px" type="number" inputmode="decimal" min="0" step="any" data-bind="roles.' + i + ".hours." + w[0] + '" value="' + esc(r.hours[w[0]] == null || r.hours[w[0]] === 0 ? "" : r.hours[w[0]]) + '" placeholder="0" aria-label="' + esc(w[1] + ", " + (r.name || "role")) + ' hours per week"></td>';
      }).join("") + "</tr>";
  }).join("");
  var foot = '<tr><td class="sticky-col">Total hours per week</td>' + roles.map(function (r, i) { return '<td class="num" id="ht-' + i + '"></td>'; }).join("") + "</tr>" +
    '<tr><td class="sticky-col">Share of a 40-hour week</td>' + roles.map(function (r, i) { return '<td class="num" id="hs-' + i + '"></td>'; }).join("") + "</tr>";
  return head("Time", "Estimate where each role spends a typical week. The model removes a share of each workflow, with the biggest cuts in re-entry, owner reporting and rent collection.",
    "Walk me through a normal week: where does the time go, and what do you retype between systems?") +
    '<div class="table-wrap" style="max-width:100%"><table><thead>' + thead + "</thead><tbody>" + body + "</tbody><tfoot>" + foot + "</tfoot></table></div>" +
    '<p class="hint" style="max-width:62ch;margin-top:10px">Totals near or above 100% of a full week usually mean the numbers are doubled up. Leave blanks as zero.</p>' + pager();
}

function stepTools() {
  var rows = state.p.tools.map(function (t, i) {
    return '<tr><td><input type="text" data-bind="tools.' + i + '.name" value="' + esc(t.name) + '" aria-label="Tool name"></td>' +
      '<td class="num"><div class="input" style="width:120px;margin-left:auto"><span class="adorn l">$</span><input type="number" inputmode="decimal" min="0" step="any" data-bind="tools.' + i + '.monthly" value="' + esc(t.monthly) + '" aria-label="Monthly cost of ' + esc(t.name) + '"></div></td>' +
      '<td class="num"><div class="input" style="width:100px;margin-left:auto"><input type="number" inputmode="decimal" min="0" max="100" step="any" data-bind="tools.' + i + '.replacePct" value="' + esc(t.replacePct) + '" aria-label="Percent of ' + esc(t.name) + ' replaced"><span class="adorn r">%</span></div></td>' +
      '<td class="num"><input class="n" style="width:80px" type="number" inputmode="decimal" min="0" step="1" data-bind="tools.' + i + '.monthsLeft" value="' + esc(t.monthsLeft) + '" aria-label="Months left on contract for ' + esc(t.name) + '"></td>' +
      '<td><button type="button" class="row-x" data-action="rm-tool" data-i="' + i + '" aria-label="Remove ' + esc(t.name) + '">&times;</button></td></tr>';
  }).join("");
  return head("Tools", "List the software they pay for today that a single platform could replace in full or in part. Savings only begin when each contract ends.",
    "What do you pay for accounting, screening, e-sign, maintenance and listings, and when does each contract renew?") +
    '<div class="table-wrap" style="max-width:880px"><table><thead><tr><th><span class="th-flex">Tool ' + help("toolName", "Tool") + '</span></th><th class="num"><span class="th-flex">Monthly cost ' + help("toolMonthly", "Monthly cost") + '</span></th><th class="num"><span class="th-flex">Replaced ' + help("toolReplace", "Share replaced") + '</span></th><th class="num"><span class="th-flex">Months left ' + help("toolMonths", "Months left on contract") + '</span></th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="5" class="cell-note" style="padding:18px">No tools yet. Add the first one below, or skip this step if they use none.</td></tr>') +
    '</tbody><tfoot><tr><td>Total</td><td class="num" id="tot-tool-cost"></td><td colspan="3" class="num" id="tot-tool-save"></td></tr></tfoot></table></div>' +
    '<div class="table-actions"><button type="button" class="btn quiet small" data-action="add-tool">Add a tool</button></div>' + pager();
}

function stepQuote() {
  return head("Quote", "Enter what the platform will actually cost. The model charges the larger of price times units or the monthly minimum, then adds one-time setup and usage fees.",
    "What are the price per unit and the monthly minimum on the quote, and what would payments and screening cost under it?") +
    '<div class="label-row" style="margin-bottom:8px"><span class="lbl">Start from a reference rate</span>' + help("tier", "Reference rate") + "</div>" +
    '<div class="seg" role="group" aria-label="Reference rate" id="tier-seg">' + Object.keys(TIERS).map(function (k) {
      return '<button type="button" data-action="tier" data-k="' + k + '" aria-pressed="false">' + TIERS[k].label + " (" + money2(TIERS[k].perUnit) + ")</button>";
    }).join("") + '<button type="button" data-action="tier" data-k="custom" aria-pressed="false">Custom</button></div>' +
    '<div class="grid" style="margin-top:20px">' +
    field({ label: "Price per unit per month", help: "perUnit", path: "perUnit", prefix: "$" }) +
    field({ label: "Monthly minimum", help: "minimum", path: "minimum", prefix: "$" }) +
    field({ label: "Setup, in months of fees", help: "implMonths", path: "implMonths", suffix: "months" }) +
    field({ label: "Staff hours to migrate", help: "migrationHours", path: "migrationHours", suffix: "hours" }) +
    field({ label: "Net change in usage fees per year", help: "usageDelta", path: "usageDelta", prefix: "$", hint: "Payments and screening. Positive means higher cost.", ph: "0" }) +
    field({ label: "Hires you would otherwise make", help: "plannedHires", path: "plannedHires", suffix: "people", hint: "This year, if nothing changed.", ph: "0" }) +
    "</div>" +
    '<div class="callout" style="margin-top:24px" id="quote-note"></div>' + pager();
}

/* ---------- results ---------- */
function stepResults() {
  return '<div class="step-head"><h2 id="step-title" tabindex="-1">Results</h2><p>Cash is what changes on the company\'s own P&amp;L. Capacity is time freed. Owner value is kept apart because it lands with the property owner.</p></div>' +
    '<div class="controls"><div class="field"><div class="label-row"><span class="lbl">Scenario</span>' + help("scenario", "Scenario") + '</div><div class="seg" role="group" aria-label="Scenario" id="res-seg">' +
    SCEN_KEYS.map(function (k) { return '<button type="button" data-action="scen" data-k="' + k + '" aria-pressed="' + (state.scenario === k) + '">' + SCEN_LABEL[k] + "</button>"; }).join("") + "</div></div>" +
    '<div class="field"><div class="label-row"><label for="realization">Share of benefit that shows up</label>' + help("realization", "Share of benefit that shows up") + '</div><div class="range"><input id="realization" type="range" min="10" max="100" step="5" value="' + state.realization + '"><output id="realization-out">' + state.realization + '%</output></div></div>' +
    '<div class="field"><div class="label-row"><span class="lbl">Download</span></div><div class="export"><button type="button" class="btn small" data-action="pdf">PDF report</button>' + help("exportPdf", "PDF report") +
    '<button type="button" class="btn quiet small" data-action="csv">CSV data</button>' + help("exportCsv", "CSV data") + '</div></div></div>' +
    '<div id="res-body"></div>' + '<div class="pager"><button type="button" class="btn quiet" data-action="prev">Back</button></div>';
}

function flowRows(rows, cls, max) {
  return rows.map(function (r) {
    return '<div class="flow-row ' + cls + '"><span>' + r[0] + '</span><span class="amt">' + money(r[1]) + '</span><span class="bar"><i style="width:' + (max ? Math.max(0, Math.min(100, r[1] / max * 100)) : 0) + '%"></i></span></div>';
  }).join("");
}

function resultsBody(c) {
  if (!c.ready) return '<div class="empty"><h3>Add a few numbers first</h3><p>Results need units under management, at least one person on the team, and a price. Go back to Portfolio and Team, or load the example from the top of the page.</p></div>';
  var r = c.sel, s = state.scenario, be = r.be, rl = state.realization;
  var headline = be <= 1 ? "Pays for itself if " + pct(be) + " of the modeled cash benefit shows up." : "Not paid back in 36 months. It would need " + pct(be) + " of the modeled cash benefit.";
  var benefitRows = [["Cancelled tools", r.toolB], ["Hires avoided (growth and planned)", r.hireB], ["Management-fee revenue from fewer vacant days", r.vacB]];
  var costRows = [["Subscription (36 months)", r.sub_3y], ["Usage fees", r.usage_3y], ["Setup and migration", r.one_time_3y]];
  var maxFlow = Math.max.apply(null, benefitRows.concat(costRows).map(function (x) { return x[1]; }).concat([1]));
  var tbl = [
    ["Hours freed per year", function (x) { return int(x.freed_hours); }],
    ["Full-time equivalent", function (x) { return one(x.freed_fte); }],
    ["Cash benefit, 3 years", function (x) { return money(x.cash_benefit_3y); }],
    ["Cost, 3 years", function (x) { return money(x.cost_3y); }],
    ["Cash ROI", function (x) { return pct(x.cash_roi, true); }],
    ["Total ROI with redeployed capacity", function (x) { return pct(x.total_roi, true); }],
    ["Net present value (cash)", function (x) { return money(x.npv_cash); }],
    ["Payback", function (x) { return x.payback_month_cash ? "Month " + x.payback_month_cash : "Not within 36 months"; }],
    ["Break-even share of benefit", function (x) { return pct(x.be); }],
    ["Cash ROI with no hires avoided", function (x) { return pct(x.noHireRoi, true); }]
  ];
  var flags = flagsFor(c);
  var assum = [
    ["Loaded hourly cost", "Salary x 1.30 / 1,880 hours", "A: BLS compensation data"],
    ["Hours worked per year", "47 weeks", "J: judgment"],
    ["Wage growth", "3.4% a year", "A: BLS Employment Cost Index"],
    ["Discount rate", "10% a year", "J: judgment"],
    ["Subscription escalator", "3% a year", "J: judgment"],
    ["Adoption ramp", "25%, 60%, 85%, then 100% of savings, by quarter", "J: judgment"],
    ["Time saved by workflow (before scenario)", "Re-entry 40%, owner reports 35%, rent 30%, accounting 25%, renewals 20%, leasing, maintenance, inspections 15%, communications 10%", "J: judgment, no independent study found"],
    ["Current-setup factors", "100%, 85%, 55%, 30% of the savings kept", "J: judgment"],
    ["Hire credit", "50% conservative, 100% otherwise", "J: judgment"],
    ["Vacant days saved per turn", "0, 0, 2 by scenario", "J: no causal evidence for more"],
    ["Default role salaries", "BLS medians, May 2024", "A: BLS Occupational Outlook Handbook"],
    ["Reference rates", "$1.49, $3.20, $5.00 per unit; quote-only now", "C: third-party reported, 2024"]
  ];
  return '<div class="note" style="margin-bottom:6px">' + SCEN_LABEL[s] + " scenario, " + rl + "% of modeled benefit</div>" +
    '<p class="headline" style="margin-bottom:24px">' + headline + "</p>" +
    '<div class="kpis">' +
    kpi("Cash ROI, 3 years", pct(r.cash_roi, true), "Net " + money(r.cash_benefit_3y - r.cost_3y), "cashRoi") +
    kpi("Net present value", money(r.npv_cash), "Cash only, 10% discount", "npv") +
    kpi("Payback", r.payback_month_cash ? "Month " + r.payback_month_cash : "None", r.payback_month_cash ? "Within 36 months" : "Not within 36 months", "payback") +
    kpi("Break-even", pct(be), "Share of benefit needed", "breakeven") + "</div>" +
    '<div class="buckets">' +
    '<div class="bucket"><h3>Cash</h3><div class="big">' + money(r.cash_benefit_3y - r.cost_3y) + '</div><p>' + money(r.cash_benefit_3y) + " in, " + money(r.cost_3y) + " out over 3 years. " + pct(r.hireShare) + " of the benefit depends on hires avoided. With none, cash ROI is " + pct(r.noHireRoi, true) + ".</p></div>" +
    '<div class="bucket"><h3>Capacity ' + help("capacity", "Capacity") + '</h3><div class="big">' + int(r.freed_hours) + ' hours a year</div><p>About ' + one(r.freed_fte) + " full-time people, or " + pct(r.g) + " of team time, once fully adopted. Worth " + money(r.cap_value_yr) + " a year at loaded cost, but only cash if a hire is skipped.</p></div>" +
    '<div class="bucket separate"><h3>Owner value ' + help("owner", "Owner value") + '</h3><div class="big">' + money(r.owner_vac_3y) + '</div><p>Rent recovered for owners over 3 years. Kept separate and never added to the company\'s return.</p></div></div>' +
    '<h3 class="section-title">Where the money moves, 3 years</h3>' +
    '<div class="flows"><div><div class="note">Cash in</div>' + flowRows(benefitRows, "", maxFlow) + '<div class="flow-total"><span>Total</span><span>' + money(r.cash_benefit_3y) + "</span></div></div>" +
    '<div><div class="note">Cash out</div>' + flowRows(costRows, "cost", maxFlow) + '<div class="flow-total"><span>Total</span><span>' + money(r.cost_3y) + "</span></div></div></div>" +
    '<h3 class="section-title">Cumulative net cash by month</h3>' + chartHTML(c) +
    '<h3 class="section-title">Compare scenarios</h3>' +
    '<div class="table-wrap"><table class="wide"><thead><tr><th>Measure</th>' + SCEN_KEYS.map(function (k) { return '<th class="num"' + (k === s ? ' style="background:var(--blue-light)"' : "") + ">" + SCEN_LABEL[k] + "</th>"; }).join("") + "</tr></thead><tbody>" +
    tbl.map(function (row) { return "<tr><td>" + row[0] + "</td>" + SCEN_KEYS.map(function (k) { return '<td class="num"' + (k === s ? ' style="background:var(--blue-wash)"' : "") + ">" + row[1](c.res[k]) + "</td>"; }).join("") + "</tr>"; }).join("") +
    "</tbody></table></div>" +
    '<h3 class="section-title">Check before you present</h3><ul class="flags">' + (flags.length ? flags.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") : '<li class="ok">No input problems found.</li>') + "</ul>" +
    '<details id="d-assum"' + (state.open["d-assum"] ? " open" : "") + '><summary>Assumptions and sources</summary><div class="table-wrap"><table><thead><tr><th>Item</th><th>Value</th><th>Source (A government, C vendor or secondary, J judgment)</th></tr></thead><tbody>' +
    assum.map(function (a) { return "<tr><td>" + a[0] + "</td><td>" + a[1] + "</td><td>" + a[2] + "</td></tr>"; }).join("") + "</tbody></table></div></details>";
}
function kpi(k, v, s, helpKey) {
  return '<div class="kpi"><div class="k">' + k + " " + help(helpKey, k) + '</div><div class="v">' + v + '</div><div class="s">' + s + "</div></div>";
}

/* ---------- chart ---------- */
var CH = { W: 760, H: 320, l: 64, r: 112, t: 16, b: 40 };
function kfmt(x) { var a = Math.abs(x), t; if (a >= 1e6) t = (a / 1e6).toFixed(a % 1e6 ? 1 : 0).replace(/\.0$/, "") + "M"; else if (a >= 1000) t = (a / 1000).toFixed(a % 1000 ? 1 : 0).replace(/\.0$/, "") + "k"; else t = String(Math.round(a)); return (x < 0 ? MINUS : "") + "$" + t; }
function niceScale(min, max) {
  var span = (max - min) || 1, raw = span / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  var step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step: step };
}
function chartGeom(c) {
  var all = [0]; SCEN_KEYS.forEach(function (k) { all = all.concat(c.res[k].cumulative); });
  var sc = niceScale(Math.min.apply(null, all), Math.max.apply(null, all));
  var iw = CH.W - CH.l - CH.r, ih = CH.H - CH.t - CH.b;
  return { sc: sc, x: function (m) { return CH.l + m / 36 * iw; }, y: function (v) { return CH.t + (sc.hi - v) / (sc.hi - sc.lo) * ih; }, iw: iw, ih: ih };
}
var DASH = { conservative: "", expected: "7 5", optimistic: "2 4" };
function chartHTML(c) {
  var avail = ($("#res-body") || {}).clientWidth || 760;
  CH.W = Math.max(320, Math.min(760, avail)); CH.H = CH.W < 500 ? 280 : 320; CH.l = CH.W < 500 ? 52 : 64; CH.r = CH.W < 500 ? 92 : 112;
  var g = chartGeom(c), sc = g.sc, svg = "", i;
  for (var v = sc.lo; v <= sc.hi + sc.step / 2; v += sc.step) {
    svg += '<line class="c-grid" x1="' + CH.l + '" x2="' + (CH.W - CH.r) + '" y1="' + g.y(v) + '" y2="' + g.y(v) + '"/><text class="c-axis" x="' + (CH.l - 10) + '" y="' + (g.y(v) + 4) + '" text-anchor="end">' + kfmt(v) + "</text>";
  }
  svg += '<line class="c-zero" x1="' + CH.l + '" x2="' + (CH.W - CH.r) + '" y1="' + g.y(0) + '" y2="' + g.y(0) + '"/>';
  for (i = 0; i <= 36; i += 6) svg += '<text class="c-axis" x="' + g.x(i) + '" y="' + (CH.H - CH.b + 22) + '" text-anchor="middle">' + i + "</text>";
  svg += '<text class="c-axis" x="' + (CH.l + g.iw / 2) + '" y="' + (CH.H - 4) + '" text-anchor="middle">Months after go-live</text>';
  var order = SCEN_KEYS.filter(function (k) { return k !== state.scenario; }).concat([state.scenario]), labels = [];
  order.forEach(function (k) {
    var cum = [0].concat(c.res[k].cumulative), d = cum.map(function (v, m) { return (m ? "L" : "M") + g.x(m).toFixed(1) + " " + g.y(v).toFixed(1); }).join(" ");
    svg += '<path d="' + d + '" fill="none" class="' + (k === state.scenario ? "c-sel" : "c-oth") + '"' + (DASH[k] ? ' stroke-dasharray="' + DASH[k] + '"' : "") + "/>";
    labels.push({ k: k, y: g.y(cum[36]) });
  });
  labels.sort(function (a, b) { return a.y - b.y; });
  for (i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 16) labels[i].y = labels[i - 1].y + 16;
  labels.forEach(function (l) { svg += '<text class="c-lbl' + (l.k === state.scenario ? " sel" : "") + '" x="' + (CH.W - CH.r + 8) + '" y="' + (l.y + 4) + '">' + SCEN_LABEL[l.k] + "</text>"; });
  var pb = c.sel.payback_month_cash;
  if (pb) svg += '<circle class="c-dot" cx="' + g.x(pb) + '" cy="' + g.y(c.sel.cumulative[pb - 1]) + '" r="5"/><text class="c-axis sel" x="' + g.x(pb) + '" y="' + (g.y(c.sel.cumulative[pb - 1]) - 12) + '" text-anchor="middle">Payback, month ' + pb + "</text>";
  svg += '<line id="c-cross" class="c-cross" y1="' + CH.t + '" y2="' + (CH.H - CH.b) + '" x1="0" x2="0" style="display:none"/>' +
    '<rect id="c-hit" x="' + CH.l + '" y="' + CH.t + '" width="' + g.iw + '" height="' + g.ih + '" fill="transparent"/>';
  var legend = '<div class="legend">' + SCEN_KEYS.map(function (k) {
    return '<span><svg viewBox="0 0 32 8" aria-hidden="true"><line x1="0" x2="32" y1="4" y2="4" class="' + (k === state.scenario ? "c-sel" : "c-oth") + '"' + (DASH[k] ? ' stroke-dasharray="' + DASH[k] + '"' : "") + "/></svg>" + SCEN_LABEL[k] + "</span>";
  }).join("") + "</div>";
  var months = [6, 12, 18, 24, 30, 36];
  var table = '<details id="d-chart"' + (state.open["d-chart"] ? " open" : "") + '><summary>Show as a table</summary><div class="table-wrap"><table><thead><tr><th>Month</th>' + SCEN_KEYS.map(function (k) { return '<th class="num">' + SCEN_LABEL[k] + "</th>"; }).join("") + "</tr></thead><tbody>" +
    months.map(function (m) { return "<tr><td>" + m + "</td>" + SCEN_KEYS.map(function (k) { return '<td class="num">' + money(c.res[k].cumulative[m - 1]) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></details>";
  return legend + '<div class="chart-box" id="chart-box"><svg viewBox="0 0 ' + CH.W + " " + CH.H + '" role="img" aria-label="Cumulative net cash by month for three scenarios. ' +
    SCEN_LABEL[state.scenario] + " ends at " + money(c.sel.cumulative[35]) + ' at month 36.">' + svg + '</svg><div class="chart-tip" id="chart-tip" hidden></div></div>' + table;
}
function wireChart(c) {
  var hit = $("#c-hit"), box = $("#chart-box"), tipEl = $("#chart-tip"), cross = $("#c-cross");
  if (!hit) return;
  var g = chartGeom(c), svg = box.querySelector("svg");
  function move(e) {
    var rect = svg.getBoundingClientRect(), k = rect.width / CH.W, px = (e.clientX - rect.left) / k;
    var m = Math.max(1, Math.min(36, Math.round((px - CH.l) / g.iw * 36)));
    cross.setAttribute("x1", g.x(m)); cross.setAttribute("x2", g.x(m)); cross.style.display = "";
    tipEl.innerHTML = "<b>Month " + m + "</b>" + SCEN_KEYS.map(function (s) { return "<div>" + SCEN_LABEL[s] + ": " + money(c.res[s].cumulative[m - 1]) + "</div>"; }).join("");
    tipEl.hidden = false;
    var left = g.x(m) * k + 14;
    if (left + tipEl.offsetWidth > rect.width) left = g.x(m) * k - tipEl.offsetWidth - 14;
    tipEl.style.left = Math.max(0, left) + "px"; tipEl.style.top = "8px";
  }
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", function () { cross.style.display = "none"; tipEl.hidden = true; });
}

/* ---------- rendering ---------- */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var RENDER = [stepPortfolio, stepTeam, stepTime, stepTools, stepQuote, stepResults];

function renderNav() {
  $("#steps").innerHTML = "<ol>" + STEPS.map(function (s, i) {
    return '<li><button type="button" data-action="goto" data-i="' + i + '"' + (i === state.step ? ' aria-current="step"' : "") + '><span class="num">' + (i + 1) + '</span><span class="label">' + s.title + '<span class="sub">' + s.sub + "</span></span></button></li>";
  }).join("") + "</ol>";
  $("#mobile-progress").textContent = "Step " + (state.step + 1) + " of " + STEPS.length + ": " + STEPS[state.step].title;
}
function render(focus) {
  hideTip();
  renderNav();
  $("#main-step").innerHTML = RENDER[state.step]();
  $("#livebar").hidden = state.step === STEPS.length - 1;
  $("#example-chip").hidden = !state.example;
  derive();
  if (focus) { var h = $("#step-title"); if (h) h.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
function go(i) { state.step = Math.max(0, Math.min(STEPS.length - 1, i)); render(true); }

function derive() {
  var p = state.p, fte = totalFte(), i;
  if (state.step === 1) {
    p.roles.forEach(function (r, i) { var el = $("#rate-" + i); if (el) el.textContent = money2(num(r.salary) * 1.3 / 1880) + " an hour"; });
    $("#tot-fte").textContent = one(fte);
    $("#tot-upf").textContent = fte > 0 && num(p.units) > 0 ? one(num(p.units) / fte) + " units per person" : "Add units and people to see units per person";
  }
  if (state.step === 2) {
    p.roles.forEach(function (r, i) {
      var tot = WF.reduce(function (a, w) { return a + num(r.hours[w[0]]); }, 0), cap = num(r.fte) * 40;
      $("#ht-" + i).textContent = int(tot);
      $("#hs-" + i).textContent = cap > 0 ? pct(tot / cap) : "n/a";
    });
  }
  if (state.step === 3) {
    var cost = p.tools.reduce(function (a, t) { return a + num(t.monthly); }, 0), sav = p.tools.reduce(function (a, t) { return a + num(t.monthly) * num(t.replacePct) / 100; }, 0);
    $("#tot-tool-cost").textContent = money(cost) + " a month";
    $("#tot-tool-save").textContent = money(sav) + " a month could be saved once contracts end";
  }
  if (state.step === 4) {
    var u = num(p.units), pu = num(p.perUnit), mn = num(p.minimum), monthly = Math.max(pu * u, mn), cur = Object.keys(TIERS).filter(function (k) { return TIERS[k].perUnit === pu && TIERS[k].minimum === mn; })[0] || "custom";
    state.tier = cur;
    $$("#tier-seg button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === cur)); });
    $("#quote-note").innerHTML = u > 0
      ? "<b>" + money(monthly) + " a month</b>, or " + money2(monthly / u) + " per unit. " + (mn > pu * u ? "The monthly minimum applies at this size." : "The per-unit price applies at this size.") + " Year one costs " + money(monthly * 12 + monthly * num(p.implMonths) + num(p.usageDelta)) + " including setup and usage fees, before staff migration time."
      : "Enter units under management on the first step to see the monthly price.";
  }
  updateLive();
}

function updateLive() {
  if (state.step === STEPS.length - 1) { renderResults(); return; }
  var c = compute(), r = c.ready ? c.sel : null;
  $$("#livebar [data-action=scen]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === state.scenario)); });
  $("#lb-roi").textContent = r ? pct(r.cash_roi, true) : "n/a";
  $("#lb-net").textContent = r ? money(r.cash_benefit_3y - r.cost_3y) : "n/a";
  $("#lb-be").textContent = r ? pct(r.be) : "n/a";
  $("#lb-pay").textContent = r ? (r.payback_month_cash ? "Month " + r.payback_month_cash : "None in 3 years") : "n/a";
}
function renderResults() {
  var body = $("#res-body"); if (!body) return;
  var c = compute();
  body.innerHTML = resultsBody(c);
  if (c.ready) wireChart(c);
  $$("#res-seg button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === state.scenario)); });
}

/* ---------- tooltips for the ? buttons ---------- */
var tipEl, tipFor = null, pinned = false;
function showTip(btn) {
  var txt = HELP[btn.dataset.help]; if (!txt) return;
  if (tipFor && tipFor !== btn) tipFor.setAttribute("aria-expanded", "false");
  tipFor = btn; tipEl.textContent = txt; tipEl.hidden = false; btn.setAttribute("aria-expanded", "true"); btn.setAttribute("aria-describedby", "tip");
  var r = btn.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  var left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  var top = r.bottom + 8; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  tipEl.style.left = left + "px"; tipEl.style.top = top + "px";
}
function hideTip() { if (!tipEl) return; if (tipFor) { tipFor.setAttribute("aria-expanded", "false"); tipFor.removeAttribute("aria-describedby"); } tipFor = null; pinned = false; tipEl.hidden = true; }
function helpBtn(e) { return e.target.closest ? e.target.closest(".help") : null; }

/* ---------- events ---------- */
function onInput(e) {
  var t = e.target;
  if (t.id === "realization") { state.realization = Number(t.value); $("#realization-out").textContent = state.realization + "%"; renderResults(); return; }
  if (!t.dataset || !t.dataset.bind) return;
  var v = t.type === "number" ? (t.value === "" ? "" : Number(t.value)) : t.value;
  setPath(t.dataset.bind, v);
  derive();
}
function onClick(e) {
  var hb = helpBtn(e);
  if (hb) { e.preventDefault(); if (tipFor === hb && pinned) hideTip(); else { showTip(hb); pinned = true; } return; }
  if (pinned) hideTip();
  var b = e.target.closest("[data-action]"); if (!b) return;
  var a = b.dataset.action, i = Number(b.dataset.i);
  if (a === "next") go(state.step + 1);
  else if (a === "prev") go(state.step - 1);
  else if (a === "goto") go(i);
  else if (a === "add-role") { state.p.roles.push({ id: nid(), name: "New role", salary: BLS.lease, fte: "", hours: {} }); render(); }
  else if (a === "rm-role") { state.p.roles.splice(i, 1); render(); }
  else if (a === "add-tool") { state.p.tools.push({ id: nid(), name: "", monthly: "", replacePct: 100, monthsLeft: 0 }); render(); var ins = $$("[data-bind$='.name']"); if (ins.length) ins[ins.length - 1].focus(); }
  else if (a === "rm-tool") { state.p.tools.splice(i, 1); render(); }
  else if (a === "tier") { var k = b.dataset.k; if (TIERS[k]) { state.p.perUnit = TIERS[k].perUnit; state.p.minimum = TIERS[k].minimum; render(); } else $("#f-perUnit").focus(); }
  else if (a === "scen") { state.scenario = b.dataset.k; if (state.step === STEPS.length - 1) renderResults(); updateLive(); }
  else if (a === "clear") { state.p = blankState(); state.example = false; state.scenario = "conservative"; state.realization = 100; state.step = 0; render(true); }
  else if (a === "example") { state.p = exampleState(); state.example = true; state.step = 0; render(true); }
  else if (a === "pdf") exportPDF();
  else if (a === "csv") exportCSV();
}
