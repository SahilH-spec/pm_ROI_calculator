"""Reference implementation of the ROI model (Python prototype used to verify the spec).
The shipped JavaScript port is app/engine.js; this exists to check the math on sample portfolios."""
from dataclasses import dataclass, field
from math import floor

# ---- derived constants (see METHODOLOGY) ----
PROD_HOURS = 1880          # productive hours per FTE-year
WEEKS_WORKED = 47          # annualization factor for hours-per-week inputs
BURDEN = 0.30              # employer cost on top of salary (derived from BLS ECEC)
WAGE_GROWTH = 0.034        # BLS ECI, private industry, Mar 2025 -> Mar 2026
DISCOUNT = 0.10            # annual, user adjustable
HORIZON = 36               # months

WORKFLOWS = ["rent", "acct", "owner", "leasing", "maint", "comms", "renewals", "inspect", "reentry"]
RED_EXPECTED_M0 = dict(rent=.30, acct=.25, owner=.35, leasing=.15, maint=.15,
                       comms=.10, renewals=.20, inspect=.15, reentry=.40)
MATURITY = dict(M0=1.0, M1=.85, M2=.55, M3=.30)
# `cap` is now only a sanity ceiling (share of total team capacity), not a driver. Output reports if it binds.
SCEN = dict(
    conservative=dict(red_mult=.6, cap=.15, redeploy=0.0, days_saved=0.0, hire_credit=.5),
    expected=dict(red_mult=1.0, cap=.25, redeploy=.5, days_saved=0.0, hire_credit=1.0),
    optimistic=dict(red_mult=1.5, cap=.35, redeploy=.75, days_saved=2.0, hire_credit=1.0),
)
RAMP = [(3, .25), (6, .60), (9, .85), (10**9, 1.0)]


def ramp(m):
    for end, v in RAMP:
        if m <= end:
            return v


@dataclass
class Role:
    name: str
    salary: float
    fte: float
    hours: dict  # weekly hours per workflow (whole role, not per person)

    @property
    def rate(self):
        return self.salary * (1 + BURDEN) / PROD_HOURS


@dataclass
class Tool:
    name: str
    monthly: float
    replace_pct: float      # share of this tool's cost that disappears
    months_left: int = 0    # contract months remaining before savings start


@dataclass
class Portfolio:
    units: int
    avg_rent: float
    turns_per_year: float
    mgmt_fee_pct: float
    growth_units_per_year: float
    maturity: str
    roles: list
    tools: list
    per_unit: float
    minimum: float
    impl_months: float = 2.0
    migration_hours: float = 60
    usage_delta_annual: float = 0.0   # net change in payments/usage cost (+ = more cost)
    planned_hires_avoided_fte: float = 0.0


def run(p: Portfolio, scen: str, realization_scale: float = 1.0, benefit_scale: float = 1.0):
    s = SCEN[scen]
    # ---- labor hours freed (steady state, annual) ----
    raw = {}
    for r in p.roles:
        tot = 0.0
        for w, h in r.hours.items():
            red = min(.85, RED_EXPECTED_M0[w] * s["red_mult"]) * MATURITY[p.maturity]
            tot += h * WEEKS_WORKED * red
        raw[r.name] = tot
    raw_total = sum(raw.values())
    fte_total = sum(r.fte for r in p.roles)
    cap_hours = s["cap"] * fte_total * PROD_HOURS
    scale = min(1.0, cap_hours / raw_total) if raw_total else 0.0
    freed = {k: v * scale for k, v in raw.items()}
    freed_total = sum(freed.values())
    g = freed_total / (fte_total * PROD_HOURS)
    cap_value = sum(freed[r.name] * r.rate for r in p.roles)
    blended_cost_fte = sum(r.salary * (1 + BURDEN) * r.fte for r in p.roles) / fte_total
    R0 = p.units / fte_total

    # ---- monthly engine ----
    monthly = []
    sub_year1 = max(p.per_unit * p.units, p.minimum) * 12
    impl = max(p.per_unit * p.units, p.minimum) * p.impl_months
    blended_rate = sum(r.rate * r.fte for r in p.roles) / fte_total
    migr_cost = p.migration_hours * blended_rate
    for m in range(1, HORIZON + 1):
        yr = (m - 1) // 12
        esc = (1 + WAGE_GROWTH) ** yr
        rp = ramp(m) * realization_scale
        # tools
        tool_sav = sum(t.monthly * t.replace_pct for t in p.tools if m > t.months_left)
        # growth-driven hires avoided
        dU = p.growth_units_per_year * m / 12
        g_m = g * rp
        growth_fte = dU * g_m / R0
        growth_cash = growth_fte * blended_cost_fte / 12 * esc
        # planned hires avoided, capped by freed capacity not absorbed by growth
        free_fte_m = g_m * fte_total
        planned_fte = min(p.planned_hires_avoided_fte, max(0.0, free_fte_m - growth_fte))
        planned_cash = planned_fte * blended_cost_fte / 12 * esc
        # non-cash capacity (what is left after cash-realized portions)
        v_m = cap_value / 12 * rp * esc
        noncash = max(0.0, v_m - growth_cash - planned_cash) * s["redeploy"]
        # PMC-side revenue: mgmt fee on rent recovered from fewer vacant days
        owner_vac = s["days_saved"] * p.turns_per_year * (p.avg_rent / 30) / 12 * rp
        pmc_vac = owner_vac * p.mgmt_fee_pct
        cash_ben = (tool_sav + s["hire_credit"] * (growth_cash + planned_cash) + pmc_vac) * benefit_scale
        nc_ben = noncash * benefit_scale
        # costs
        sub = sub_year1 / 12 * (1.03 ** yr)
        usage = p.usage_delta_annual / 12
        one_time = (impl + migr_cost) if m == 1 else 0.0
        cost = sub + usage + one_time
        monthly.append(dict(m=m, tool=tool_sav, growth=growth_cash, planned=planned_cash, pmc_vac=pmc_vac,
                            noncash=nc_ben, owner_vac=owner_vac * benefit_scale, cash=cash_ben, cost=cost))
    d = (1 + DISCOUNT) ** (1 / 12)
    pv = lambda key: sum(x[key] / d ** x["m"] for x in monthly)
    tot = lambda key: sum(x[key] for x in monthly)
    cash_b, nc_b, cost = tot("cash"), tot("noncash"), tot("cost")
    pv_cash, pv_nc, pv_cost = pv("cash"), pv("noncash"), pv("cost")
    cum, payback = 0.0, None
    for x in monthly:
        cum += x["cash"] - x["cost"]
        if cum >= 0 and payback is None:
            payback = x["m"]
    be_cash = pv_cost / pv_cash if pv_cash else float("inf")
    be_total = pv_cost / (pv_cash + pv_nc) if (pv_cash + pv_nc) else float("inf")
    return dict(
        scen=scen, freed_hours=freed_total, freed_fte=g * fte_total, g=g, cap_bound=(scale < 1), R0=R0,
        cap_value_yr=cap_value, tool_3y=tot("tool"), growth_3y=tot("growth"), planned_3y=tot("planned"),
        pmc_vac_3y=tot("pmc_vac"), owner_vac_3y=tot("owner_vac"), cash_benefit_3y=cash_b, noncash_3y=nc_b,
        cost_3y=cost, cash_roi=(cash_b - cost) / cost, total_roi=(cash_b + nc_b - cost) / cost,
        npv_cash=pv_cash - pv_cost, npv_total=pv_cash + pv_nc - pv_cost, payback_month_cash=payback,
        breakeven_cash=be_cash, breakeven_total=be_total, pv_cash=pv_cash, pv_nc=pv_nc, pv_cost=pv_cost,
    )
