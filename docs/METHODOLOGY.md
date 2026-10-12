# ROI Model: Logic and Reasoning

**Version 1.0 · 2026-10-12 · Status: implemented in `app/`, verified against the Python reference**

A discovery-call ROI model for residential property management companies (PMCs) evaluating a switch to a modern, integrated property management platform. Vendor-neutral by design: nothing in the model names or depends on a specific product. The platform being evaluated is just three inputs (price per unit, monthly minimum, usage fees).

---

## 1. Design principles

1. **Three separate buckets, never blended into one headline number.**
   - **Cash**: changes to the PMC's own P&L (tools cancelled, hires avoided, management-fee revenue).
   - **Capacity**: staff hours freed but not converted to cash. Real, but it is a choice what to do with them.
   - **Owner value**: money that lands with the property owner (e.g., fewer vacant days). The PMC earns only its management-fee percentage of it. Never added to PMC ROI.
2. **Cost side is complete.** Subscription, minimum spend, implementation, migration time, and *usage fees* (payments, screening). Per AppFolio's Q3 2025 10-Q, usage-based "value added services" were about 77% of its revenue versus about 22% from subscriptions, so a calculator that counts only the subscription badly understates real cost.
3. **Every number is either the prospect's own input or traceable to a source.** Judgment calls are labeled as judgment (tier J), not dressed up as data.
4. **Break-even first.** The headline for a call is "you need X% of the modeled benefit to break even", not a point estimate.
5. **Conservative by construction.** Scenario spread, an adoption ramp, and a maturity discount for prospects who already run a modern system.

---

## 2. Discovery inputs

### Portfolio
| Input | Why it matters |
|---|---|
| Units under management | Drives subscription cost and units-per-staff sanity check |
| Average monthly rent | Converts vacant days into dollars |
| Turns per year | Vacancy exposure |
| Management fee % | The PMC's share of any rent recovered |
| Planned unit growth per year | Drives growth-absorption lever |

### Team (per role)
FTE count, loaded-cost basis (salary), and **weekly hours spent on each of 9 workflows**: rent collection and delinquency, accounting and reconciliation, owner statements and reporting, leasing, maintenance coordination, tenant communications, renewals, inspections, and **duplicate data re-entry between systems**. Default salaries come from BLS (Section 6) and are overridable.

### Current stack
Per tool: monthly cost, % of it that would disappear, months left on contract (savings start only after the contract ends).

### Current-state maturity
- **M0**: spreadsheets, QuickBooks, paper
- **M1**: older or basic PMS plus several bolt-ons
- **M2**: modern PMS, mostly integrated
- **M3**: already on a comparable platform and well adopted

### Quote inputs
Price per unit, monthly minimum, implementation months, migration hours, **net change in annual usage cost** (payments and screening), and **planned hires the prospect says they would otherwise make** (FTE).

### Input sanity checks (flag, don't block)
Units per FTE outside roughly 30–110, hours per role far above a 40-hour week, a minimum-spend that makes effective price per unit more than double the list rate.

---

## 3. Calculations

Reference implementation: `reference/engine.py` (Python, used for verification). The shipped port is `app/engine.js`, checked against it by `app/parity.test.js`.

### 3.1 Hourly cost of staff time
```
rate = salary × 1.30 / 1,880 productive hours
```
Cross-check against BLS: private-industry benefits were $14.01 per hour on $32.60 wages (March 2026), so total compensation is 1.43 × wages. `salary / 2,080 × 1.43` gives $42.61 per hour for a $62,000 salary; the formula above gives $42.87. **Within 0.6%.**

### 3.2 Hours freed (steady state, annual)
```
hours_freed(role, workflow) = weekly_hours × 47 weeks
                              × reduction[workflow] × scenario_multiplier × maturity_factor
```
Summed over roles and workflows. A **sanity ceiling** (15% / 25% / 35% of total team capacity by scenario) clamps the result and reports if it ever binds. It is not a driver. In all verification runs it never binds.

Expected-case reductions at M0 (**judgment, tier J**; there is no independent time-and-motion study to source them from):

| Workflow | Reduction |
|---|---|
| Rent collection and delinquency | 30% |
| Accounting and reconciliation | 25% |
| Owner reporting | 35% |
| Leasing | 15% |
| Maintenance coordination | 15% |
| Tenant communications | 10% |
| Renewals | 20% |
| Inspections | 15% |
| Duplicate data re-entry | 40% |

Maturity factors (judgment): M0 1.00, M1 0.85, M2 0.55, M3 0.30.

### 3.3 Value of freed time (capacity)
```
capacity_value = Σ hours_freed × rate(role)
```
This is **capacity**, not savings.

### 3.4 Converting benefits to cash
- **Tool consolidation**: `Σ tool_monthly × replace% ` for months after each contract ends.
- **Growth absorption**: new units added per month ÷ current units-per-FTE × productivity gain = hires not needed. Valued at loaded cost of a blended FTE.
- **Planned hires avoided**: the prospect's stated number, capped by freed capacity not already used for growth.
- **Hire-avoidance credit**: both hire-based levers are multiplied by 0.5 / 1.0 / 1.0 across scenarios, because they depend on a management decision.
- **Vacancy fee revenue**: `days_saved × turns × (rent/30) × mgmt_fee%`. Default 0 days (see Section 7).
- **Capacity not converted to cash** is shown separately, discounted by a redeployment factor of 0% / 50% / 75% by scenario.

### 3.5 Costs
```
subscription = max(per_unit × units, minimum) × 12, escalating 3% per year
one-time     = subscription_monthly × implementation_months + migration_hours × blended_rate
usage        = annual net change in payments and screening cost
```

### 3.6 Time handling
36-month monthly engine. Adoption ramp: 25% of steady-state benefit in months 1–3, 60% in 4–6, 85% in 7–9, 100% after (judgment). Wages escalate 3.4% per year (BLS ECI). Discount rate 10% (adjustable).

### 3.7 Outputs
Cash ROI (3-year), total ROI (including redeployed capacity), NPV, payback month, and **break-even realization**: the fraction of modeled benefit needed for NPV = 0. Owner value is reported as a separate line.

---

## 4. Scenarios

| | Conservative | Expected | Optimistic |
|---|---|---|---|
| Reduction multiplier | 0.6× | 1.0× | 1.5× |
| Hire-avoidance credit | 50% | 100% | 100% |
| Capacity redeployed to cash value | 0% | 50% | 75% |
| Vacant days saved per turn | 0 | 0 | 2 |
| Sanity ceiling (share of team capacity) | 15% | 25% | 35% |

---

## 5. Verification

Ran the engine on three invented portfolios (150 units single-family, 500 mixed, 1,500 multifamily). **These are test fixtures, not benchmarks.**

**Invariants that passed:** 36-month cost equals an independently computed sum in all three; freed hours and cash benefit never decrease from conservative to expected to optimistic; zero benefit gives exactly −100% ROI; zero growth gives zero growth-driven cash; a 50% realization haircut always lowers benefits; the minimum-spend rule gives $5.96 per unit at 50 units and $1.49 at 200 units.

**Defect found and fixed during verification.** The first version used a flat capacity cap that overrode the workflow inputs in every run, so outputs were just "6% / 12% / 25%" regardless of what was entered. I recalibrated the reductions and demoted the cap to a ceiling. After the fix it never binds and the inputs drive the result.

| Fixture | Expected cash ROI (3y) | Conservative | With 50% haircut | Break-even realization (expected) | Cash ROI with **zero** hire avoidance |
|---|---|---|---|---|---|
| 150 units | +91% | −10% | +18% | 56% | −54% |
| 500 units | +89% | −22% | +12% | 54% | −73% |
| 1,500 units | +3% | −46% | −17% | 99% | −83% |

Freed capacity in the fixtures: 7–11% of team hours (conservative), 11–18% (expected), 16–27% (optimistic).

---

## 6. Evidence and source quality

Tiers: **A** government or filed data · **B** industry body or company data on a clearly defined measure · **C** vendor-reported or secondary summary · **D** unverifiable blog claims (not used) · **J** my judgment.

| Item | Value | Source | Tier |
|---|---|---|---|
| Property manager median wage | $66,700 (May 2024) | BLS Occupational Outlook Handbook | A |
| Bookkeeping clerk median wage | $49,210 (May 2024) | BLS OOH | A |
| Administrative assistant median wage | $47,460 (May 2024) | BLS OOH | A |
| Dispatcher median wage (proxy for maintenance coordinator) | $50,340 (2025 OEWS) | O*NET / BLS | A (proxy) |
| Leasing agent wage | none found; using admin proxy | n/a | proxy |
| Benefits vs wages, private industry | 30.1% of total comp; $14.01 on $32.60 | BLS ECEC, March 2026 | A |
| Wage growth | +3.4% year over year | BLS ECI, March 2026 | A |
| AppFolio revenue mix | Core $53.8M, value-added $192.1M (Q3 2025) | SEC 10-Q | A |
| US average units per employee | 54 | AppFolio Quarterly Market Update, Q3 2025 | B |
| Units per direct team member | 49.29 average, 58.55 top quartile (2022) | NARPM / ProfitCoach, via LetHub | C |
| Properties per manager (median) | about 40 | NAR 2023, via LetHub | C |
| Time savings, AI-feature users | 10.3 h/week tasks, 11.9 h/week communication (survey of 343) | AppFolio blog | C (vendor, self-reported, upper bound) |
| Customer time savings | 20 h/month, 40+ h/month | AppFolio customer stories | C (selected cases) |
| Competitor list prices | see `assumptions.json` | vendor pages, aggregators | B/C |
| AppFolio list price | $1.49 / $3.20 / $5.00 per unit (last published 2024); quote-only as of Aug 2026 | LetHub (citing an Internet Archive capture) | C |
| Autopay on-time rate | 99% vs 87–88% | RentRedi | C, **correlational** |
| Days to lease | 36 days on market (May 2024); 41 (multifamily 2025) | LetHub; RentCafe via Lula | C |
| "8–15 hours/week saved" | various | SMB blogs | D, not used |

**Where sources conflict:** AppFolio Max minimum spend is reported as both $1,500 and $7,500; Yardi Breeze Premier is reported at both $1 and $2 per unit. Both flagged low confidence in `assumptions.json`.

**What I could not source:** the per-workflow reduction percentages, the adoption ramp, the maturity factors, the redeployment factors, and any causal effect of software on vacant days or delinquency. All are judgment or left out of defaults.

---

## 7. What the verification says about using this on calls

1. **Hire avoidance is 76–86% of expected cash benefit.** Tool consolidation alone never pays for the software in any fixture or scenario (−43% to −83% ROI). The honest cash case rests on growth or a planned hire. Discovery must ask: *"Are you adding units this year? Would you hire if you didn't change anything?"* Without a yes, the case is capacity, not cash.
2. **Minimum spend punishes small portfolios.** At 50 units the effective price is about four times the list rate. The model uses `max(per_unit × units, minimum)` so this shows up honestly.
3. **Usage fees must be asked about.** The `usage_delta_annual` input is the most likely to be skipped and the most likely to flip a deal's math.
4. **Vacancy and delinquency are off by default.** The only evidence on autopay and reminders is correlational (reliable tenants choose autopay). Using it as a causal uplift would overstate the benefit. If the prospect gives their own days-to-lease and late-payment rate, show it as a labeled sensitivity, not in the headline.

---

## 8. Decisions and remaining judgment calls

*Settled for v1.0: no post-sale outcome data is used, the per-unit reference rates are kept as public defaults, and Conservative is the default scenario.*

1. **Reduction percentages.** They are my calibration so that the blended result sits below the vendor-reported ~25–30% for heavy AI-feature users. If you have post-sale outcome data you're allowed to use, that is the best way to replace them (keep it in a gitignored local file).
2. **AppFolio pricing inputs.** Public defaults are last-published or third-party numbers. Your real quote structure belongs in `config.local.json`, not the public repo.
3. **Hire-avoidance credit in the conservative case (0.5).** Alternative is 0, which makes the conservative case harsher.
4. **Leasing and maintenance coordinator wages** use proxies. Replace with your market's actual wages when you have them.
5. **Whether to add an "owner value" screen** (fewer vacant days, owner retention). It is shown separately and never in PMC ROI.
