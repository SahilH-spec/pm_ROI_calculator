import sys
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import *


def H(rent=0, acct=0, owner=0, leasing=0, maint=0, comms=0, renewals=0, inspect=0, reentry=0):
    return dict(rent=rent, acct=acct, owner=owner, leasing=leasing, maint=maint,
                comms=comms, renewals=renewals, inspect=inspect, reentry=reentry)


A = Portfolio(
    units=150, avg_rent=1900, turns_per_year=50, mgmt_fee_pct=.09, growth_units_per_year=20, maturity="M1",
    roles=[Role("PM", 62000, 1.0, H(4, 3, 4, 6, 10, 5, 2, 3, 3)),
           Role("Admin/Leasing", 47000, 1.0, H(5, 3, 0, 14, 6, 7, 2, 0, 3)),
           Role("Bookkeeper", 49000, 0.5, H(2, 14, 3, 0, 0, 0, 0, 0, 1))],
    tools=[Tool("Spreadsheets+QuickBooks", 80, 1.0), Tool("Screening/e-sign", 60, .8), Tool("Listing syndication", 100, .5)],
    per_unit=1.49, minimum=298, usage_delta_annual=0)

B = Portfolio(
    units=500, avg_rent=1600, turns_per_year=175, mgmt_fee_pct=.08, growth_units_per_year=50, maturity="M2",
    roles=[Role("PM", 62000, 2.0, H(8, 6, 8, 10, 20, 12, 4, 6, 6)),
           Role("Leasing", 47000, 2.0, H(6, 2, 0, 40, 10, 14, 6, 0, 2)),
           Role("Maint coordinator", 50000, 1.0, H(0, 2, 0, 0, 30, 6, 0, 0, 2)),
           Role("Accountant", 49000, 1.0, H(6, 22, 8, 0, 0, 0, 0, 0, 4))],
    tools=[Tool("Accounting", 250, .8), Tool("Screening", 150, .5), Tool("E-sign", 90, 1.0),
           Tool("Maint dispatch", 200, .5), Tool("Marketing/leads", 300, .3)],
    per_unit=3.20, minimum=960, usage_delta_annual=3000, planned_hires_avoided_fte=0.5)

C = Portfolio(
    units=1500, avg_rent=1500, turns_per_year=600, mgmt_fee_pct=.07, growth_units_per_year=150, maturity="M2",
    roles=[Role("Property mgrs", 64000, 6.0, H(24, 18, 24, 30, 60, 36, 12, 18, 18)),
           Role("Leasing", 48000, 6.0, H(18, 6, 0, 120, 30, 42, 18, 0, 6)),
           Role("Maint coord", 51000, 4.0, H(0, 8, 0, 0, 120, 24, 0, 0, 8)),
           Role("Accounting", 52000, 4.0, H(24, 88, 32, 0, 0, 0, 0, 0, 16))],
    tools=[Tool("Accounting", 600, .8), Tool("Screening", 400, .5), Tool("E-sign", 200, 1.0),
           Tool("Maint dispatch", 500, .5), Tool("Marketing/leads", 800, .3), Tool("Reporting/BI", 400, .5)],
    per_unit=5.00, minimum=7500, usage_delta_annual=12000, planned_hires_avoided_fte=1.0)

fmt = lambda x: f"{x:,.0f}"
for name, p in [("A 150u SFR", A), ("B 500u mixed", B), ("C 1500u multi", C)]:
    fte = sum(r.fte for r in p.roles)
    print(f"\n=== {name}  units/FTE={p.units/fte:.1f}  FTE={fte}")
    prev = None
    for sc in ["conservative", "expected", "optimistic"]:
        r = run(p, sc)
        print(f"{sc:13s} freedhrs={fmt(r['freed_hours']):>6} fte={r['freed_fte']:.2f} g={r['g']*100:4.1f}% capbound={r['cap_bound']!s:5} "
              f"cash3y={fmt(r['cash_benefit_3y']):>9} (tool {fmt(r['tool_3y'])} grow {fmt(r['growth_3y'])} plan {fmt(r['planned_3y'])} pmcvac {fmt(r['pmc_vac_3y'])}) "
              f"noncash={fmt(r['noncash_3y']):>8} cost={fmt(r['cost_3y']):>9} cashROI={r['cash_roi']*100:6.0f}% totROI={r['total_roi']*100:6.0f}% "
              f"payback={r['payback_month_cash']} NPVc={fmt(r['npv_cash'])} NPVt={fmt(r['npv_total'])} BE_cash={r['breakeven_cash']:.2f} BE_tot={r['breakeven_total']:.2f} ownerVac3y={fmt(r['owner_vac_3y'])}")
        if prev is not None:
            assert r['cash_benefit_3y'] >= prev['cash_benefit_3y'] - 1e-6, "cash benefit not monotonic across scenarios"
            assert r['freed_hours'] >= prev['freed_hours'] - 1e-6, "freed hours not monotonic"
        prev = r
    # invariants
    z = run(p, "expected", benefit_scale=0.0)
    assert abs(z['cash_roi'] + 1) < 1e-9, "zero benefits must give -100% ROI"
    h = run(p, "expected", realization_scale=0.5)
    f = run(p, "expected")
    assert h['cash_benefit_3y'] < f['cash_benefit_3y'], "haircut must reduce benefits"
    print(f"  haircut 50% -> cash3y {fmt(h['cash_benefit_3y'])} vs {fmt(f['cash_benefit_3y'])}, cashROI {h['cash_roi']*100:.0f}% vs {f['cash_roi']*100:.0f}%, payback {h['payback_month_cash']}")
    # cost identity check: 36 months of subscription + one-time
    sub = max(p.per_unit * p.units, p.minimum)
    expect_cost = sum(sub * (1.03 ** ((m - 1)//12)) for m in range(1, 13)) + sum(sub * (1.03**1) for _ in range(12)) + sum(sub * (1.03**2) for _ in range(12))
    expect_cost += p.usage_delta_annual * 3 + sub * p.impl_months + p.migration_hours * (sum(r.rate * r.fte for r in p.roles) / fte)
    assert abs(expect_cost - f['cost_3y']) < 1.0, (expect_cost, f['cost_3y'])
    print("  cost identity OK:", fmt(expect_cost))

# edge: no-growth, no planned hires => growth/planned cash must be zero
E = Portfolio(**{**A.__dict__, "growth_units_per_year": 0})
r = run(E, "expected")
assert r['growth_3y'] == 0 and r['planned_3y'] == 0
print("\nno-growth edge: growth cash =", r['growth_3y'], "noncash =", fmt(r['noncash_3y']), "cash ROI =", f"{r['cash_roi']*100:.0f}%")
# edge: tiny portfolio under minimum
T = Portfolio(**{**A.__dict__, "units": 50})
print("50-unit minimum binds: monthly sub =", max(T.per_unit*50, T.minimum), "effective $/unit =", round(max(T.per_unit*50, T.minimum)/50, 2))
