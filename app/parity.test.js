// node design/parity.test.js : JS engine must reproduce the Python reference on all fixtures.
const E = require("./engine.js");
const fx = require("../reference/fixtures.json");
const keys = ["freed_hours","freed_fte","g","cap_value_yr","tool_3y","growth_3y","planned_3y","pmc_vac_3y","owner_vac_3y",
  "cash_benefit_3y","noncash_3y","cost_3y","cash_roi","total_roi","npv_cash","npv_total","payback_month_cash","breakeven_cash","breakeven_total","pv_cash","pv_nc","pv_cost","cap_bound"];
let n = 0, bad = 0;
for (const [name, f] of Object.entries(fx)) for (const [sc, py] of Object.entries(f.results)) {
  const js = E.run(f.input, sc), jh = E.run(f.input, sc, { realization: 0.5 });
  for (const [label, a, b] of [["", js, py], ["haircut.", jh, py.haircut]]) for (const k of keys) {
    n++;
    const x = a[k], y = b[k];
    const ok = (x === y) || (typeof x === "number" && typeof y === "number" && Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y)));
    if (!ok) { bad++; console.log("MISMATCH", name, sc, label + k, x, y); }
  }
}
console.log(`${n} comparisons, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
