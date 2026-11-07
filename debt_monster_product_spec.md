# Debt Monster — Personal Build Specification

## Implementation status

Checked items are implemented in the repository. Verification is listed separately; a check mark does not claim a physical Pi or touchscreen test.

| Tier | Implementation | Verification |
| --- | --- | --- |
| 0 — Core tracking | Complete | Automated tests and local browser checks |
| 1 — Everyday experience | Complete | Automated graph/domain tests and local browser checks |
| 2 — Savings | Complete | Automated tests and local browser checks |
| 3 — Pi appliance | Setup files and guide prepared | Physical Pi, boot/recovery, attached display, and real LAN checks pending |

See [validation results](VALIDATION.md) for commands and remaining checks.

## Purpose and scope

Build a small, local-first household tool: **watch debt disappear, then watch savings grow**. Record payments, charges, deposits, and withdrawals through a local web dashboard. A separate display provides friendly motivation and charts. The UI is the primary and only supported update workflow; email updates and scheduling have been removed from scope.

Keep this a personal project. In scope: debt, savings, their transition, SQLite history, corrections, backups, charts, playful animations, and an optional Pi kiosk. Out of scope: email/mailboxes, bank connections, automated imports, budgeting, investment tracking, generic goals, cloud accounts, telemetry, multi-user permissions, mobile apps, installers, custom hardware, commercialization, and continuous computer/Pi synchronization.

## Implementation guidance

- Use Python, Flask, SQLite, HTML/CSS, and vanilla JavaScript. Serve all display assets locally for offline operation.
- Use one application. No background mailbox worker, queues, webhooks, microservices, SPA framework, or provider infrastructure.
- Store money as integer cents. Never use floating point for financial calculations.
- Keep the database and local configuration outside replaceable application files. Never commit real financial data.
- Routine settings require no source edits. Keep setup source-based and documentation short.
- Test meaningful behavior and report automated checks separately from manual visual and Pi checks. Preserve user data during updates.

## Tier 0 — Core tracking

Goal: open the dashboard, record a payment, and see the local ledger and display update accurately.

- [x] First-run setup for starting debt, including zero, with an explicit artificial demo option.
- [x] Current balance, basic transaction history, manual payment/charge entry, and `/display`.
- [x] SQLite persistence for settings and transactions. Derive balances from the ledger.
- [x] Amounts must be positive, at most two decimals, within $0.01–$9,999,999,999.99. Reject zero, negative, non-finite, and ambiguous transaction amounts rather than rounding. Starting balances may be zero.
- [x] One shared validation/calculation path for UI changes; commit batches atomically if internally supported.
- [x] Poll display status approximately every five seconds. No WebSockets needed.
- [x] Settings and history survive restarts; failures do not overwrite or reset financial data.

Acceptance: setup, entry, history, and display work offline. Test debt growth above its starting amount, zero starting debt, overpayment credit, invalid input, atomicity, and restart persistence. Stop before later work if calculations or persistence are unreliable.

## Tier 1 — Everyday experience

Goal: make the browser application pleasant and useful daily.

- [x] App-like layout with two primary views: **Update** and **Display**, accessible through persistent bottom tabs. Update prioritizes the balance, monster, and transaction form; notes are optional and history/corrections open in a separate sheet. Edit/delete corrections recalculate immediately.
- [x] Current debt, net debt reduction, progress bar/percentage when applicable, debt trend, and monthly net progress.
- [x] Friendly monster: after a successful payment, visibly count the current debt down while the monster eats the amount (about 4–6 seconds). Commit first; interpolate only the visual counter. Prevent duplicate submissions during saving/animation, handle reduced-motion preferences, and never animate a rejected request. A charge gives the monster a brief angry face and counts the displayed debt upward; use supportive copy without guilt or failure screens. Add milestone celebrations at 10%, 25%, 50%, 75%, and 90%.
- [x] Calm, readable Display with four individual panels: balance, animated journey, trend, and monthly progress. Journey replays the chronological balance graph whenever the panel is entered, including automatic cycling. The monster moves along the line, chomping/smiling after payments and sweating as charges make it climb. Graph points reveal date, balance, and note; Replay restarts the visual story. Replaying must never create ledger changes or retrigger persisted milestone awards. Preserve all increases, credits, flat segments, and savings movements; handle empty histories and reduced-motion preferences. Show one panel at a time, with previous/next arrows, direct selection dots, and swipe/keyboard navigation. Optional auto-cycle advances every 15 seconds, resetting after manual navigation and pausing during animation, dialogs, or hidden-page state. Remember panel and cycling preference. Persistent **Update / Display** tabs let the user move between entry and display. Keep navigation visible on smaller screens.
- [x] Monotonically increasing display event cursor. Consume events in order, including offsetting payment/charge pairs. Bound the animation queue or combine bursts. Persist consumed cursor across refresh/restart; initial startup shows current status without animating history. Corrections update totals without replaying payment celebrations. Persist milestone awards.
- [x] CSV export and versioned JSON backup/restore. Validate before replacement, create a consistent safety backup, and require explicit confirmation. Backups contain both ledgers, supported settings, events, and milestone state.
- [x] Lightweight CSS/JavaScript animations; no elaborate asset pipeline.

Acceptance: corrections update balance/chart/progress. Trend follows chronological ledger order including debt increases. Monthly net progress includes charges. Animations and milestones occur once. CSV matches the ledger; restore reproduces balances/history, and invalid backups leave live data intact. Verify display readability and both navigation directions.

## Tier 2 — Debt-free transition and savings

Goal: continue using the same tool after payoff with a separate savings ledger.

- [x] Celebrate positive derived debt crossing to zero or below once per payoff event. Starting at zero shows debt-free status without a spurious payoff animation.
- [x] Offer **Start Saving** or **Stay Here**. Switching is explicit and preserves debt history. Ask for starting savings and an optional positive savings goal. Never silently transfer debt credit into savings.
- [x] Support starting directly in savings mode and viewing retained debt history.
- [x] Dashboard supports deposits, withdrawals, notes, corrections, savings trend, goal progress, and modest goal/milestone celebrations. Use a savings garden: deposits plant/water a seed and grow a sprout while the counter increases; withdrawals gently collect fruit into a basket while the counter decreases. The monster remains friendly and smiling, without chomping, anger, or sweat. Savings Journey waters plants on deposits, collects fruit on withdrawals, and leaves larger flowers at first goal-milestone crossings. Preserve the actual graph and balances, including negatives; garden effects are presentation only.
- [x] Changing active mode preserves both ledgers and their starting balances. Historical entries remain correctable without resetting history.
- [x] Backups include both ledgers, active mode, starting balances, savings goal, display events, and milestone awards. The consumed animation cursor, selected panel, Auto-cycle, and Stay Here preferences are browser-local and are not included in portable backups.

Acceptance: payoff animation does not repeat on polling/reload. Deposits increase savings, withdrawals decrease it. Wrong-mode changes are rejected. Negative and above-goal savings values display correctly; optional goals avoid division errors. Savings milestones persist across refresh/restart. Backup/restore retains both ledgers.

## Tier 3 — Optional Pi appliance

Goal: run the proven browser app as a dedicated household display.

- [x] GitHub clone/pull, data transfer, backup/update, shutdown, and troubleshooting instructions.
- [x] Optional Waitress requirements and a user service file for boot startup/restart.
- [x] Kiosk script and labwc autostart instructions; persistent Chromium profile and server readiness check.
- [x] Explicit hostname/IP allowlist for household LAN access; exercised with a Flask test client.
- [ ] Install and run on a physical Raspberry Pi with the chosen display.
- [ ] Verify server startup after boot and recovery after failure on the Pi.
- [ ] Verify kiosk startup, automatic cycling, and physical display readability.
- [ ] Verify entry from other computers on the actual household LAN.
- [ ] Transfer a financial backup to the Pi and verify both ledgers on that device.
- [ ] Perform a real Pi update/recovery procedure and long-running offline check.

The supplied setup uses `~/debt-monster` for source and `~/.local/share/debtmonster` for data. Real hardware checks are required before claiming Tier 3 complete. See [Raspberry Pi setup](docs/raspberry-pi.md).

## Shared data and calculation rules

Keep the schema small: settings, transactions, display events, and milestones. Transactions have stable ID, effective date/time, processing timestamp, kind, integer amount, optional note, and mode. Preserve any legacy source identifiers as historical metadata.

Derived debt = starting debt + charges − payments.
Savings = starting savings + deposits − withdrawals.
Net debt reduction = starting debt − derived debt.

Starting balances are nonnegative integer cents. Optional savings goals are positive. Transaction amounts are positive. Correct mistakes with edit/delete.

Derived debt may be negative: show remaining debt as $0 and the excess as separate credit. Debt progress is net reduction / positive starting debt, clamped to 0–100% for the bar. Show debt growth neutrally with a 0% bar. Omit percentage with zero starting debt. Savings progress is savings / positive goal, clamped for the bar; omit without a goal. Preserve negative and above-goal savings values. Charts use actual balances, including credits and withdrawals. Monthly progress is net of charges/withdrawals. Use one configured currency, with no exchange rates.

## Local operation and data preservation

The database and calculations stay on the active device. No cloud service, telemetry, or accounts are needed. Local use works offline; household clients use the LAN to reach the server. Bind to localhost by default. LAN access is explicit and trusts the household network; never expose publicly. Protect writes against CSRF, reject unexpected hosts/origins, validate inputs, and escape notes. A login system is outside scope.

Manual updates: stop writers, record revision, create a consistent SQLite/config backup, update from a known revision, install requirements, and apply numbered migrations after backup. Leave the data directory intact. Restart and verify balances/history/display before recording new changes. Recovery restores the previous code and its compatible backup, discarding later entries. Use SQLite's backup facility or stop all writers before copying; do not copy only a live database while WAL writes may exist.

Schema 2 removes active email settings and all mailbox processing. Migration from schema 1 first backs up SQLite and preserves transactions, starting balances, modes, events, and milestone state. Historical mailbox tables may remain inert; new portable backups exclude them. Version 1 financial backups remain importable without reviving mailbox functionality.

## Definition of success

**Dashboard entry → accurate local ledger → updated friendly display**, followed by a preserved transition into savings. Build and verify each tier within this personal scope.
