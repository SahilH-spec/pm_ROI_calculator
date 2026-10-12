/* ROI engine: JavaScript port of reference/engine.py.
   Pure functions, no DOM. Constants and judgment calls are documented in docs/METHODOLOGY.md. */
(function (root) {
  "use strict";

  var C = {
    PROD_HOURS: 1880,
    WEEKS_WORKED: 47,
    BURDEN: 0.30,
    WAGE_GROWTH: 0.034,
    DISCOUNT: 0.10,
    HORIZON: 36,
    SUB_ESCALATOR: 0.03
  };

  var WORKFLOWS = ["rent", "acct", "owner", "leasing", "maint", "comms", "renewals", "inspect", "reentry"];

  var RED_EXPECTED_M0 = {
    rent: 0.30, acct: 0.25, owner: 0.35, leasing: 0.15, maint: 0.15,
    comms: 0.10, renewals: 0.20, inspect: 0.15, reentry: 0.40
  };

  var MATURITY = { M0: 1.0, M1: 0.85, M2: 0.55, M3: 0.30 };

  var SCEN = {
    conservative: { red_mult: 0.6, cap: 0.15, redeploy: 0.0, days_saved: 0.0, hire_credit: 0.5 },
    expected:     { red_mult: 1.0, cap: 0.25, redeploy: 0.5, days_saved: 0.0, hire_credit: 1.0 },
    optimistic:   { red_mult: 1.5, cap: 0.35, redeploy: 0.75, days_saved: 2.0, hire_credit: 1.0 }
  };

  var RAMP = [[3, 0.25], [6, 0.60], [9, 0.85], [Infinity, 1.0]];

  function ramp(m) {
    for (var i = 0; i < RAMP.length; i++) if (m <= RAMP[i][0]) return RAMP[i][1];
  }

  function num(x) { x = Number(x); return isFinite(x) ? x : 0; }

  function roleRate(r) { return num(r.salary) * (1 + C.BURDEN) / C.PROD_HOURS; }

  function run(p, scen, opts) {
    opts = opts || {};
    var realizationScale = opts.realization == null ? 1 : opts.realization;
    var benefitScale = opts.benefitScale == null ? 1 : opts.benefitScale;
    var s = SCEN[scen];
    var roles = p.roles.filter(function (r) { return num(r.fte) > 0; });
    var tools = p.tools || [];

    // ---- hours freed (steady state, annual) ----
    var raw = {}, rawTotal = 0;
    roles.forEach(function (r) {
      var tot = 0;
      WORKFLOWS.forEach(function (w) {
        var h = num(r.hours && r.hours[w]);
        var red = Math.min(0.85, RED_EXPECTED_M0[w] * s.red_mult) * MATURITY[p.maturity];
        tot += h * C.WEEKS_WORKED * red;
      });
      raw[r.name] = tot; rawTotal += tot;
    });
    var fteTotal = roles.reduce(function (a, r) { return a + num(r.fte); }, 0);
    if (!fteTotal) fteTotal = 1e-9;
    var capHours = s.cap * fteTotal * C.PROD_HOURS;
    var scale = rawTotal ? Math.min(1, capHours / rawTotal) : 0;
    var freedTotal = rawTotal * scale;
    var g = freedTotal / (fteTotal * C.PROD_HOURS);
    var capValue = roles.reduce(function (a, r) { return a + raw[r.name] * scale * roleRate(r); }, 0);
    var blendedCostFte = roles.reduce(function (a, r) { return a + num(r.salary) * (1 + C.BURDEN) * num(r.fte); }, 0) / fteTotal;
    var blendedRate = roles.reduce(function (a, r) { return a + roleRate(r) * num(r.fte); }, 0) / fteTotal;
    var R0 = num(p.units) / fteTotal;

    // ---- costs ----
    var monthlySub = Math.max(num(p.perUnit) * num(p.units), num(p.minimum));
    var subYear1 = monthlySub * 12;
    var impl = monthlySub * num(p.implMonths);
    var migr = num(p.migrationHours) * blendedRate;

    var monthly = [];
    for (var m = 1; m <= C.HORIZON; m++) {
      var yr = Math.floor((m - 1) / 12);
      var esc = Math.pow(1 + C.WAGE_GROWTH, yr);
      var rp = ramp(m) * realizationScale;
      var toolSav = 0;
      tools.forEach(function (t) { if (m > num(t.monthsLeft)) toolSav += num(t.monthly) * num(t.replacePct); });
      var dU = num(p.growthUnits) * m / 12;
      var gm = g * rp;
      var growthFte = R0 ? dU * gm / R0 : 0;
      var growthCash = growthFte * blendedCostFte / 12 * esc;
      var freeFte = gm * fteTotal;
      var plannedFte = Math.min(num(p.plannedHires), Math.max(0, freeFte - growthFte));
      var plannedCash = plannedFte * blendedCostFte / 12 * esc;
      var vm = capValue / 12 * rp * esc;
      var noncash = Math.max(0, vm - growthCash - plannedCash) * s.redeploy;
      var ownerVac = s.days_saved * num(p.turns) * (num(p.avgRent) / 30) / 12 * rp;
      var pmcVac = ownerVac * num(p.mgmtFee);
      var cashBen = (toolSav + s.hire_credit * (growthCash + plannedCash) + pmcVac) * benefitScale;
      var ncBen = noncash * benefitScale;
      var sub = subYear1 / 12 * Math.pow(1 + C.SUB_ESCALATOR, yr);
      var usage = num(p.usageDelta) / 12;
      var oneTime = m === 1 ? impl + migr : 0;
      monthly.push({
        m: m, tool: toolSav, growth: growthCash, planned: plannedCash, pmc_vac: pmcVac,
        noncash: ncBen, owner_vac: ownerVac * benefitScale, cash: cashBen,
        cost: sub + usage + oneTime, sub: sub, usage: usage, one_time: oneTime
      });
    }

    var d = Math.pow(1 + C.DISCOUNT, 1 / 12);
    function pv(k) { return monthly.reduce(function (a, x) { return a + x[k] / Math.pow(d, x.m); }, 0); }
    function tot(k) { return monthly.reduce(function (a, x) { return a + x[k]; }, 0); }
    var cashB = tot("cash"), ncB = tot("noncash"), cost = tot("cost");
    var pvCash = pv("cash"), pvNc = pv("noncash"), pvCost = pv("cost");
    var cum = 0, payback = null, cumulative = [];
    monthly.forEach(function (x) {
      cum += x.cash - x.cost;
      cumulative.push(cum);
      if (cum >= 0 && payback === null) payback = x.m;
    });

    return {
      scen: scen, freed_hours: freedTotal, freed_fte: g * fteTotal, g: g, cap_bound: scale < 1, R0: R0,
      cap_value_yr: capValue, tool_3y: tot("tool"), growth_3y: tot("growth"), planned_3y: tot("planned"),
      pmc_vac_3y: tot("pmc_vac"), owner_vac_3y: tot("owner_vac"),
      cash_benefit_3y: cashB, noncash_3y: ncB, cost_3y: cost,
      sub_3y: tot("sub"), usage_3y: tot("usage"), one_time_3y: tot("one_time"),
      cash_roi: cost ? (cashB - cost) / cost : 0,
      total_roi: cost ? (cashB + ncB - cost) / cost : 0,
      npv_cash: pvCash - pvCost, npv_total: pvCash + pvNc - pvCost,
      payback_month_cash: payback,
      breakeven_cash: pvCash ? pvCost / pvCash : Infinity,
      breakeven_total: (pvCash + pvNc) ? pvCost / (pvCash + pvNc) : Infinity,
      pv_cash: pvCash, pv_nc: pvNc, pv_cost: pvCost,
      monthly: monthly, cumulative: cumulative,
      effective_per_unit: num(p.units) ? monthlySub / num(p.units) : 0,
      monthly_sub: monthlySub
    };
  }

  var api = { C: C, WORKFLOWS: WORKFLOWS, RED_EXPECTED_M0: RED_EXPECTED_M0, MATURITY: MATURITY, SCEN: SCEN, roleRate: roleRate, run: run };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ROIEngine = api;
})(typeof window !== "undefined" ? window : this);
