# StochastoGreen — Brand Coherence & Pruning Audit

*Date:* April 2026
*Scope:* Full web/src frontend — landing, auth, onboarding, dashboard, portfolio, history, alerts
*Reference:* `../the-velveteen-project/docs/brand-coherence-pruning-guide.md`, `brand-ux-audit.md`

---

## 1. Executive Verdict

StochastoGreen is closer to the family than the parent audit implies — the amber-on-obsidian palette, the panel system in `globals.css`, and the dashboard grid all read as *quantitative instrument*. The math is visible. The domain terminology survives.

It is not, however, one product yet. It is **three products stitched together**:

1. A tailwind-themed landing + dashboard written against the design system.
2. A second app (login, register, onboarding, topbar) written in inline styles with hardcoded hex values that drift from the design tokens by 1–2 digits.
3. A third app (portfolio, history) that *also* uses inline styles but a third palette.

This is the dominant coherence issue — not "terminal theater." The terminal metaphor is permitted by the family guide ("let StochastoGreen feel like a quantitative terminal"). What is **not** permitted is fake telemetry, rate-limit gossip, self-deprecating "MVP" tags, and UI code written like a prototype and then never returned to.

The verdict:

- **Pruneable in one pass**, not a redesign. Most issues are copy, scale-signals, and style-system drift.
- **The dashboard is the brand.** Everything else should converge on its treatment.
- **The landing hero is the loudest, most urgent fix.** It overperforms technicality instead of communicating rigor.

---

## 2. What Already Works

| Surface | Why it works |
|---|---|
| `globals.css` token system | `--color-obsidian-*` + amber primary + teal secondary is a coherent, well-differentiated family voice. Amber separates from parent's teal without inventing a new visual universe. |
| Dashboard KPI grid | `.kpi-grid` with 1px internal borders, uppercase mono labels, semantic color coding (amber/success/danger) reads as a Bloomberg-lite instrument without cosplay. Best section on the site. |
| CVaR-per-asset panel | Horizontal bars with color thresholds (≤10 green, ≤20 amber, >20 red) are legitimately analytical. Keep. |
| Verdict cards with confidence bar | Shows probability as a thin 2px bar + `% conf.` — restrained, factual, exactly the family tone. |
| Sidebar chrome | Left-nav with `// THE VELVETEEN PROJECT` super-label, active-state amber border, `SDE_ENGINE · ONLINE` footer. Family-coherent. |
| ESG classification panel | Real data from `climate_beta`, no fake percentages. |
| Bilingual posture | Spanish copy + English system labels + mono metadata matches the parent's rhythm. |
| Dashboard empty states (partial) | "Ejecuta un análisis vía Telegram..." is honest and calm. |
| Grid + ambient glow background | Amber 3% grid + corner radial glows = atmosphere without spectacle. Respects the family's "evidence before spectacle" rule. |

---

## 3. What Should Be Pruned

Ordered by how much each hurts credibility.

### 3.1 Fake telemetry (urgent)

- **Login footer:** `LATENCY: 12ms // NGFS_ORDERLY_2050` — pure cosplay. The 12ms is hardcoded. Delete.
- **Landing `SDE CALIBRATION` overlay:** `MU: 0.12 | SIGMA: 0.25` — hardcoded numbers presented as live state. Either wire to a real calibration, or delete.
- **Landing `TerminalLogs` boot sequence:** Fakes ten lines of "[OK] AGENTE CUANTITATIVO COMPLETADO" on every landing visit when nothing was analyzed. This is exactly the "fake loading theater" the parent audit already stripped. **Delete the component from landing** (it can survive inside the dashboard *only if* tied to a real run). The bug we just fixed lived here.
- **Sidebar:** `ALPHAVANTAGE · 25 REQ/DAY` exposes a free-tier rate limit. This is anti-credibility for a "financial instrument" — it tells a visitor you depend on a free data provider. Remove, or replace with a neutral `DATA · ALPHAVANTAGE` without the quota.

### 3.2 Self-deprecating scale signals

- **Topbar `MVP · v1.0.0`** — a research-grade instrument does not label itself MVP. Drop to `v1.0` if a version is needed at all; ideally remove.
- **"NUEVO OPERADOR"** subtitle on `/register` — *operador* is a TTRPG word, not a finance one. Replace with something editorial ("Nuevo acceso" or remove the subtitle).

### 3.3 Terminal cosplay that went too far

Per the family guide, terminal feel is allowed. These specific moves are not:

- `STOCHASTO_GREEN` with underscore on login/register/onboarding — branding inconsistency (elsewhere it's `StochastoGreen`). Pick one. The snake_case "code identifier" form reads as performance.
- `INICIAR_SESIÓN →` as a button label on `/login`. User-facing CTAs should not be typeset like file handles.
- `EMAIL_ADDRESS` as a form label. Just `Email`.
- Landing `// Risk Management Interface v1.0` eyebrow — consider. The monospace eyebrow is fine; the `v1.0` suffix is noise.
- Landing CTAs: **"Terminal Dashboard"** (header) + **"EXPLORAR TERMINAL"** (hero primary) + **"WHITEBOARD"** (hero secondary, goes nowhere). Three buttons saying variations of the same thing. The word "terminal" appears four times in one viewport.

### 3.4 Hero overperformance

Landing H1: `Climate Risk` / `**QUANTIFIED.**` — italic, extrabold, uppercase, tracking-tighter on a single word. This is the one move on the site that most resembles a generic fintech marketing hero. Either (a) drop the italic+extrabold treatment and let "Quantified" read as normal weight inside a quieter sentence, or (b) restructure around the actual product proposition ("Transition risk, modeled").

### 3.5 Visual-system drift (most work, least glamour)

Four surfaces bypass `globals.css` entirely:

| File | Problem |
|---|---|
| `components/layout/Topbar.tsx` | 100% inline styles. Uses `#0d0d0f` instead of `var(--color-obsidian-bg)` (`#0e0e10`). Grays `#333`, `#444`, `#555` are off-palette. |
| `app/login/page.tsx` | 100% inline styles. Primary action is **teal** — the parent brand's color, not amber. |
| `app/register/page.tsx` | Inline styles. Primary action is amber. Inconsistent with login. |
| `app/onboarding/page.tsx` | Inline styles. Progress step accent is teal. Body color grays diverge from tokens. |
| `app/portfolio/page.tsx` | Inline styles. `#ccc` body, `#111` border — new values again. Ticker column is teal, not amber. |
| `app/history/page.tsx` | Inline styles. Ticker text color is teal. |

The divergence is 1–2 hex digits in most places, but the cumulative effect is that **auth and data screens feel like a different product**. The user's own observation ("login feels like a different product") is mechanically verifiable in the CSS.

These pages should be ported to Tailwind tokens (`bg-obsidian-low`, `text-obsidian-on-var`, etc.) in one sweep. No redesign — just token adoption.

### 3.6 The two-CTAs-one-destination problem

Landing has `Terminal Dashboard` (header, ghost) and `EXPLORAR TERMINAL` (hero, solid) pointing at `/dashboard`, plus `WHITEBOARD` that does nothing. One primary CTA, one secondary (if any), one destination. Remove `WHITEBOARD` entirely unless there is a whiteboard.

---

## 4. What Should Be Preserved as Product-Specific

The family guide explicitly protects these. Do not sand them off chasing coherence:

- **Amber/gold (`#f5c347`) as primary.** The differentiator from the parent's teal. Non-negotiable.
- **Dense dashboard grid.** StochastoGreen has more data per pixel than the parent site. The family guide explicitly permits this: *"If StochastoGreen requires a denser UI for data reading, permit it."*
- **Stochastic model vocabulary.** `Merton Jump-Diffusion`, `CVaR 95%`, `Expected Shortfall`, `NGFS Phase 4`, `λ`, `μ_J`. Never soften.
- **Monte Carlo simulation as hero artifact.** The idea is right — an area chart of 10k paths is this product's "decision graph." Execution needs work (§5.4), but keep the ambition.
- **Monospace metadata tags.** `// THE VELVETEEN PROJECT`, `SUPABASE`, `AGENTE IA`, `95% ES` are family-correct and product-specific.
- **Amber grid background.** Atmosphere, not spectacle. Keep.
- **The telegram-as-primary-interface story.** It's unusual and credible. Use it as a distinguishing move, not a workaround to be apologized for.

---

## 5. Section-by-Section Review

### 5.1 Landing (`app/page.tsx`)

**Strengths:** Atmospheric background, the four-feature grid (VaR & CVaR / SDE Engine / AI Agents / NGFS Sync), the amber sidebar calibration panel (if the numbers were real). Density-per-viewport is right.

**Weaknesses:**
- H1 treatment (§3.4).
- Three CTAs saying "terminal," one of them dead (§3.3, §3.6).
- `TerminalLogs` boot theater (§3.1).
- Hardcoded `MU: 0.12` sidebar card (§3.1).
- Footer `SCENARIO: NGFS_PHASE4_2023 // MODEL: MERTON_JD // SEED: 42` is the *right* pattern — fixed metadata, not fake telemetry. Keep. (It describes the actual model, not a fake run.)

**Verdict:** Rewrite the hero copy, delete the fake logs, collapse to one CTA. Everything else can stay.

### 5.2 Auth: `/login`, `/register`

**Strengths:** The form is mechanically complete.

**Weaknesses:**
- Inline-style isolation (§3.5).
- Login CTA is **teal**, register CTA is **amber**. The two sibling pages can't agree on primary color. In an auth flow this is a trust-killer — users have to wonder if they've navigated to a different service.
- `STOCHASTO_GREEN` branding (§3.3).
- `EMAIL_ADDRESS` / `INICIAR_SESIÓN →` (§3.3).
- `LATENCY: 12ms // NGFS_ORDERLY_2050` (§3.1).

**Verdict:** Port both pages to the token system in one pass. Pick amber as the auth primary (StochastoGreen's accent) and let teal stay secondary. Remove the fake latency footer.

### 5.3 Onboarding (`/onboarding`)

**Strengths:** The 3-step indicator, the copy-to-clipboard `/link ABC123` affordance, and the polling state pulse are genuinely good interaction design. The "skip for now" escape hatch is honest.

**Weaknesses:**
- Inline styles (§3.5). Progress accent is teal.
- `PASO 2 DE 3` is shown but step 3 isn't defined anywhere (there is no step 3). Either make the indicator 2-of-2 or document the third step.
- `✅` and `📭` emoji in a product trying to feel austere. Replace with an SVG check icon.

**Verdict:** Port to tokens, drop emoji, resolve the step-3 phantom.

### 5.4 Dashboard (`/dashboard`)

**Strengths:** This is the product's strongest page. KPI grid, CVaR-per-asset bars, ESG classification, verdict cards with confidence — all well-resolved.

**Weaknesses:**
- **Monte Carlo chart takes 2/3 of the first fold for low information density.** Area chart shows median (P50), upper (P90), lower (P5) — but the outer bands are at 5% opacity and effectively invisible. User perceives "one wavy amber line." When empty, the panel is a 300px-tall dead zone. Options to improve without redesign: (a) raise P5/P90 fill opacity to 0.15, add visible stroke; (b) show a P5/P50/P90 value-at-horizon triplet as text inside the chart; (c) when empty, shrink the panel instead of leaving 300px of "Ejecuta un análisis..." filler.
- Duplication: the dashboard has its own `Historial de Análisis` table showing 8 rows *right next to* the Veredictos block, then `/history` repeats the same data. Dashboard should summarize (top 3 or a sparkline), `/history` should detail.
- Topbar breadcrumb text `stochasto.velveteen.app / dashboard` (§3.5, §5.7). Delete.

**Verdict:** Fix the MC chart density and deduplicate with `/history`. Everything else stays.

### 5.5 Portfolio (`/portfolio`)

**Strengths:** The data model fix (separate `portfolio_assets` table so QUITAR is non-destructive) is sound. Subtitle clarifies intent. Empty state is honest.

**Weaknesses:**
- Inline styles — new grays (`#ccc`, `#111`) (§3.5). Ticker column is teal.
- `📭` emoji for the empty state (§5.3 logic applies).
- The empty state prompts the user to "Habla con el bot." That's correct — but the same empty state could link directly to onboarding if Telegram isn't linked yet. One CTA, honest.
- Header eyebrow `PORTAFOLIO ACTIVO` is a bit marketing-voice. The parent uses `// 01_IDENTIFIER` — consider `// PORTFOLIO`.

**Verdict:** Token port, drop emoji, consider onboarding deep-link from empty state.

### 5.6 History (`/history`)

**Strengths:** Realtime subscription to new inserts is domain-correct. Confidence bar is good.

**Weaknesses:**
- Inline styles.
- Header `SUPABASE · TIEMPO REAL` — leaking the vendor name. The parent never advertises "we use Postgres." Replace with `TIEMPO REAL` or `ACTUALIZADO EN VIVO`.
- Empty state reads the same generic "sin datos aún" pattern as portfolio; differentiate.

**Verdict:** Token port, remove vendor name, differentiate empty state.

### 5.7 Alerts (`/alerts`)

**Strengths:** The severity classification (CRÍTICA / MEDIA / BAJA) is correctly reduced to a two-tier display (BAJA filtered out). Sort order is right. Per-user telegram link affordance is useful.

**Weaknesses:**
- Inline styles.
- Severity palette (`#ff6b6b`, `#f5c347`, `#4ade80`) is fine but the row backgrounds (`#1a0808`, `#141208`, `#081408`) are hex values that don't exist in the design system. Tint from tokens instead (e.g., `bg-danger/5`).
- Empty-state for "no alerts" should feel like a positive signal ("Portafolio sin alertas críticas"), not a blank panel.

**Verdict:** Token port. Reframe empty state as a *result*, not a gap.

### 5.8 Topbar

The worst offender for coherence. Separate §5.9 because of what it projects.

- Shows `stochasto.velveteen.app / dashboard` as pseudo-breadcrumb text in the top-left. A premium product never shows its own URL inside itself. This is the bar people see every page. **Delete.**
- `MVP · v1.0.0` (§3.2).
- Inline-style gray soup (§3.5).
- The amber avatar dot is correct family — keep the amber, lose the rest.

**Verdict:** Complete rewrite of the Topbar is the single highest-leverage coherence move on the site. It's on every dashboard-shell page. Fixing it alone removes 30% of the "three products" feeling.

---

## 6. Visual System Diagnosis

### Typography
Correct stack (Inter / Space Grotesk / JetBrains Mono). Scale is consistent inside the Tailwind-using surfaces. Drift appears in the inline-styled pages where font-size is in `px` instead of `text-[0.7rem]`.

### Hierarchy
Strong on dashboard (KPI > chart > details > verdict > table). Weak on landing (hero fights sidebar calibration card for attention).

### Gold/amber accent logic
Amber = primary action, primary KPI, primary chart line. Used correctly on dashboard. **Not used on login** (teal wins there) — this is the single most coherence-damaging decision in the app.

### Dark surfaces
`obsidian-bg` / `low` / `mid` / `high` / `bright` ladder exists and is well-designed. Half the app uses it; half doesn't.

### Card treatment
`.panel` class is right — 1px flat border, no shadows, slight background tint. Family-coherent. Auth/portfolio/history use ad-hoc `border: '1px solid #222'` instead, producing slightly different card weights on different screens.

### Dashboard density
Appropriate. Sidebar 220px + main column with 6-ish panel zones = a working instrument. Family guide permits this density explicitly.

### Motion
Framer Motion is present but restrained. The TerminalLogs animation was the one excessive motion; now that we've stabilized it, the rest (bar fills, panel reveals) is fine. Keep.

### Grid/background treatment
Amber 48×48 grid + corner radial glows is family-coherent (parent has similar). Grid could arguably be 64×64 to feel more atmospheric and less technical-drawing — preference, not urgent.

### Empty states
Mixed. Dashboard empty states are good. Portfolio/history use `📭` emoji. Alerts missing empty state entirely. Needs one unified pattern (monospace caption + single action link, no emoji).

### Terminal chrome / window dressing
`SDE_Engine_Monitor.sh` filename-tab, boot logs, `LATENCY: 12ms` footer = theatrical cosplay (prune). Footer `SEED: 42` metadata, sidebar `SDE_ENGINE · ONLINE` status dot = correct family-register (keep). The line between them is: **describes reality = keep; pretends to describe reality = cut**.

### Login coherence
Fails. See §5.2.

---

## 7. Product Storytelling Diagnosis

### Does the frontend explain what the product does?
Partially. The dashboard makes the product legible *once you're inside*. The landing almost communicates it — `VaR & CVaR`, `Monte Carlo Simulation`, `Fundamental & Quant`, `NGFS Sync` is a good four-word inventory — but the hero copy ("Climate Risk QUANTIFIED.") sells the category rather than the insight. Compare with the parent's hero, which leads with a graph artifact and a precise proof row. StochastoGreen has the equivalent artifact potential (the Monte Carlo chart), but places fake boot logs there instead.

### Is rigor communicated?
In the dashboard, yes (CVaR percentages, β values, confidence bars). In the landing, the rigor is underperformed — we see vocabulary without evidence. Moving one real simulation chart into the landing hero (even a static snapshot) would do more than all the terminal dressing combined.

### Is the decision-support story clear?
Half-present. The verdict cards + confidence bars on dashboard are excellent at making "the model says X with Y% confidence" explicit. But the landing doesn't mention verdicts at all, and the history page shows the underlying data without ever surfacing that a decision came out of it.

### What the site currently says vs. what it should say

| Currently says | Should say |
|---|---|
| "Terminal for climate risk." | "A stochastic model that tells you how much of your portfolio's value is at risk under climate transition scenarios — and what to do about it." |
| "Monte Carlo Simulation · 10k paths · Merton Jump-Diffusion" | Same, but next to an actual simulation of a real ticker. |
| "EXPLORAR TERMINAL" | "Ver un análisis" (show, don't narrate). |

---

## 8. Prioritized Next Steps

Each item is scoped to a single focused PR.

### Fix now

1. **Port Topbar to the token system** and delete the URL-breadcrumb + `MVP · v1.0.0` tag. Highest-leverage single change.
2. **Unify login + register + onboarding on amber primary** and port all three to Tailwind tokens. Eliminates the "three products" feeling.
3. **Delete fake telemetry:** `LATENCY: 12ms` (login), `MU: 0.12 | SIGMA: 0.25` card (landing), `ALPHAVANTAGE · 25 REQ/DAY` (sidebar). Replace the landing `TerminalLogs` with either a static Monte Carlo snapshot or an empty space.
4. **Collapse landing CTAs to one.** Remove `WHITEBOARD`. Pick one of "Terminal Dashboard" / "EXPLORAR TERMINAL" — not both. Rewrite the H1 without italic-uppercase-extrabold on "Quantified."

### Improve next

5. **Port portfolio + history to tokens.** Drop emoji in empty states. Remove `SUPABASE · TIEMPO REAL` vendor leak.
6. **Dashboard Monte Carlo chart: raise P5/P90 fill opacity to ~0.15, add visible stroke, or present P5/P50/P90 as text-at-horizon.** Or reduce the chart panel height when empty so the layout doesn't hollow out.
7. **Deduplicate dashboard `Historial` table with `/history` page.** Dashboard should summarize, history should detail.
8. **Unify empty-state pattern** across portfolio, history, alerts (same monospace caption + single action link, no emoji).
9. **Alerts empty state as a positive signal** ("Portafolio sin alertas críticas") with the severity palette pulled from design tokens (`bg-danger/5`, etc.).

### Leave alone

- Dashboard KPI grid, CVaR-per-asset bars, ESG classification, verdict cards with confidence bars.
- Sidebar chrome.
- Color palette + typography stack.
- Amber grid background + corner radials.
- Domain vocabulary (Merton, CVaR, NGFS Phase 4, climate β).
- Telegram-as-primary-interface story.
- Footer model metadata (`SEED: 42`, `MODEL: MERTON_JD`) — this is real, not fake.
- Bilingual posture (Spanish copy + English system labels).

### Never do

- **Never add fake telemetry.** Any number shown as "live" must be wired to actual state.
- **Never surface vendor or data-provider limits** in user-visible UI (`25 REQ/DAY`, `SUPABASE`).
- **Never self-deprecate with scale-signals** (`MVP`, `BETA`, `EXPERIMENTAL`). A research instrument is not a product launch.
- **Never mix inline styles with the token system.** Pick one and enforce it.
- **Never clone the parent site.** Amber + density + Monte Carlo is the differentiator.
- **Never replace the terminal register entirely.** The family guide *permits* quant-terminal feel. The goal is pruning the cosplay, not sanitizing the domain.

---

## Appendix: Files Inspected

Landing + shell:
- `web/src/app/layout.tsx`
- `web/src/app/page.tsx`
- `web/src/app/globals.css`
- `web/src/components/layout/Sidebar.tsx`
- `web/src/components/layout/Topbar.tsx`
- `web/src/components/ui/TerminalLogs.tsx`

Auth:
- `web/src/app/login/page.tsx`
- `web/src/app/register/page.tsx`
- `web/src/app/onboarding/page.tsx`

Dashboard shell:
- `web/src/app/dashboard/layout.tsx`
- `web/src/app/dashboard/page.tsx`

Data surfaces:
- `web/src/app/portfolio/page.tsx`
- `web/src/app/history/page.tsx`
- `web/src/app/alerts/page.tsx`

Reference:
- `the-velveteen-project/docs/brand-coherence-pruning-guide.md`
- `the-velveteen-project/docs/brand-ux-audit.md`
- `the-velveteen-project/README.md`
