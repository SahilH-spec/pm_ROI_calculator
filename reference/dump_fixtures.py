"""Dump fixture results as JSON so the JS port can be checked for parity."""
import json, os, sys, io, contextlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
with contextlib.redirect_stdout(io.StringIO()):
    import run as R
from engine import run
def asdict(p):
    return dict(units=p.units, avgRent=p.avg_rent, turns=p.turns_per_year, mgmtFee=p.mgmt_fee_pct,
        growthUnits=p.growth_units_per_year, maturity=p.maturity, perUnit=p.per_unit, minimum=p.minimum,
        implMonths=p.impl_months, migrationHours=p.migration_hours, usageDelta=p.usage_delta_annual,
        plannedHires=p.planned_hires_avoided_fte,
        roles=[dict(name=r.name, salary=r.salary, fte=r.fte, hours=r.hours) for r in p.roles],
        tools=[dict(name=t.name, monthly=t.monthly, replacePct=t.replace_pct, monthsLeft=t.months_left) for t in p.tools])
out = {}
for k, p in dict(A=R.A, B=R.B, C=R.C).items():
    out[k] = dict(input=asdict(p), results={})
    for sc in ["conservative", "expected", "optimistic"]:
        out[k]["results"][sc] = {x: y for x, y in run(p, sc).items() if not isinstance(y, (list, dict))}
        out[k]["results"][sc]["haircut"] = {x: y for x, y in run(p, sc, realization_scale=.5).items() if not isinstance(y, (list, dict))}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures.json"), "w"), indent=1, default=str)
print("ok")
