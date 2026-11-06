# Debt Monster — Personal Build Specification

## Purpose and scope

Build a small, local-first tool for my household: **watch debt disappear, then watch savings grow**. Get the daily loop working quickly on a computer, add a friendly monster and useful charts, then put it on a Raspberry Pi if useful.

The primary interaction is email: daily check-in → direct reply → local transaction → display updates. A local web form provides fallback entry and corrections. Email is configurable but is a core Tier 0 implementation requirement.

Keep this a personal project. Success means I use it regularly with my own data. No business launch or public distribution work is needed.

In scope: debt, savings, their transition, daily email replies, SQLite history, charts, playful animations, and an optional Pi kiosk. Out of scope: bank connections, automated imports, budgeting, investment tracking, generic goals, cloud accounts, telemetry, multi-user permissions, mobile apps, desktop installers, custom hardware, and continuous computer/Pi synchronization.

## Build approach and coding-agent instructions

There are exactly four implementation tiers. Complete and verify the requested tier before proceeding. Unless asked otherwise, **build Tier 0 only** and report its validation results and remaining limitations.

- Use Python, Flask, SQLite, HTML/CSS, and vanilla JavaScript. A small chart library is acceptable; serve display assets locally so offline operation works.
- Prefer a single application and one lightweight email worker/scheduler. Avoid microservices, queues, public webhooks, SPA frameworks, and provider-specific architecture.
- Email replies must directly record changes; a link to a web form does not satisfy the core workflow.
- Use one shared validation/calculation path for email and manual entry.
- Store money as integer cents. Never use floating point for financial calculations.
- Keep database and local configuration outside replaceable application files. Never commit real financial data or mailbox credentials.
- Use source-based setup and a short README. Routine settings must not require source edits. Do not build installers or a general deployment platform.
- Test meaningful behavior for the current tier. Do not implement later features to satisfy future tests.
- Report automated checks separately from live mailbox, visual, and Pi checks; do not claim checks that were not performed.
- Keep the browser build usable before starting Pi work. Add complexity only when needed for this household's workflow.

## Tier 0 — Core and email

### Goal

Receive a morning email, reply `P 500`, and see debt decrease by $500 without opening the app.

### Required behavior

- Local application with first-run starting debt, current balance, basic transaction history, manual payment/charge entry, and `/display`.
- SQLite persistence for settings, transactions, check-ins, and inbound processing outcomes.
- Poll display status approximately every five seconds; no WebSockets needed.
- Settings for enabling/disabling email, recipient, daily local time, IANA time zone, mailbox connection, and optional success confirmations. Include a test email and visible connection/error status.
- SMTP sending and IMAP reply polling every 1–5 minutes behind a small transport interface. Use encrypted, authenticated connections; keep secrets in local environment/configuration outside source control.
- Email failures leave manual entry and the local display usable. A restart must not lose financial changes or processing history.

### Reply contract

Debt commands:

```text
P 500       payment of $500.00
C 42.18     charge of $42.18
N           no change
```

Accept case-insensitive commands and surrounding whitespace. Multiple commands may be separated by newlines or commas, such as `C 42, P 200`. Commas separate commands, never digits: use `P 1200.00`, not `P 1,200` or `P 12,50`.

Amounts must be positive, at most two decimal places, and within a documented integer range. Reject zero, negative, non-finite, and ambiguous amounts instead of rounding. `N` must appear alone and creates no financial transaction.

Extract only newly written reply text, handling common plain-text/HTML replies, quoted history, and signatures conservatively. Never discover commands inside quoted check-in examples or guess from prose. If extraction or any command is ambiguous, reject the entire reply. Process valid commands in written order, all or nothing.

Example daily email:

```text
Subject: Debt Monster Check-In [DM-<unique-id>]

Any debt changes since your last update?
Reply with P 500 (payment), C 42.18 (charge), or N (no change).
Use only changes you have not already recorded.
```

### Correlation and duplicate prevention

1. Persist each check-in's unique ID, outgoing Message-ID, recipient, local date, mode, and send state.
2. Accept replies only from its configured recipient and correlated to a persisted check-in using reply headers or the check-in token. Ignore unmatched mail and unexpected senders without automatic responses.
3. Give every inbound message a stable unique identity enforced by SQLite. Prefer Message-ID; define a fallback for missing IDs. Scope IMAP UIDs by account, mailbox, and UIDVALIDITY.
4. In one database transaction, record all valid commands and the inbound processing outcome. Invalid replies record a rejection and no financial transactions. Link transactions to their inbound message.
5. Send any success confirmation or concise correction request after commit. A send failure must never reapply transactions. Rejected messages must not trigger repeated error emails on every poll.
6. Multiple distinct replies to one check-in are allowed. Redelivery is ignored, including after restart; identical command text in a different message is a new update.

Persist daily scheduling state with a unique date/recipient key so restarts or concurrent workers do not create a second daily check-in. Send once at the first valid local time at or after the scheduled time, including daylight-saving transitions. After downtime, send at most today's overdue check-in, never a backlog. Reuse the same outgoing identifier on retries. SMTP may deliver another copy after an uncertain send outcome; do not promise exactly-once delivery. Financial processing must remain idempotent.

Disabling email stops scheduled sending and reply polling without affecting manual use. Explicit testing remains available. Avoid storing entire mailbox messages unnecessarily.

### Acceptance criteria

- Local setup, manual entry, history, and `/display` work; settings and balances survive restart.
- With email enabled, a real test mailbox receives a check-in; `P 500`, `C 42.18`, and `N` produce the expected outcome and the display updates automatically.
- Email can be configured and disabled without source edits; disabled email sends no scheduled check-ins and processes no replies.
- Valid multi-command replies commit in order exactly once. Any invalid command or mixed `N` prevents the whole reply from changing money.
- Quoted examples/signatures, malformed amounts, unexpected senders, and unmatched messages create no transactions.
- Redelivery after restart is ignored; distinct replies to one check-in remain valid. Confirmation failures do not duplicate changes.
- Scheduling tests cover restart, downtime, and daylight-saving changes. Connection failure is visible and manual operation continues.
- Money tests cover zero starting debt, debt above its starting balance, and overpayment credit according to the rules below.

**Stop here if email parsing, persistence, calculations, or duplicate prevention is unreliable.** No charts, animations, savings implementation, or Pi deployment is required yet.

## Tier 1 — Everyday experience

### Goal

Make the working browser application pleasant and useful every day.

### Required behavior

- Simple responsive setup/settings and transaction forms; optional notes; edit/delete mistakes with immediate recalculation.
- Current debt, net debt reduction, progress bar, percentage when applicable, and debt trend chart. Add a monthly net progress view.
- Friendly monster, short payment/CHOMP animation (about 5–10 seconds), and milestone celebrations at 10%, 25%, 50%, 75%, and 90%. Tier 2 adds the full debt-free celebration.
- A calm, readable display with optional rotation between balance, trend, monthly progress, and monster views. Neutral language when debt increases; no guilt or failure screens.
- CSV export and a versioned JSON backup/restore for financial data and non-secret settings. Validate before replacement, back up existing data first, and require confirmation before replacing it. Configure mailbox secrets separately.
- No elaborate asset pipeline: lightweight CSS/JavaScript animations are sufficient.

Introduce a monotonically increasing display event cursor alongside status polling. Consume every new event in order, including offsetting payment/charge pairs. Use a bounded queue or combine payment bursts. Persist the display's consumed cursor so refresh/restart does not replay old celebrations. Initial startup shows current status without animating history. Corrections update totals without replaying payment celebrations. Persist milestone awards so ordinary polling does not retrigger them.

### Acceptance criteria

- Editing/deleting a transaction updates balances, chart, and progress correctly.
- Charts reflect actual chronological balances, including increases in debt; monthly net progress accounts for charges as well as payments.
- Payment animations and milestones occur once, including multiple email commands and refresh/restart cases. Corrections do not celebrate the original transaction again.
- Display is readable from several feet away; debt increases receive neutral treatment.
- CSV matches the ledger. A backup restores identical balances/history; invalid backups leave existing data intact.
- The app is useful daily on a computer with documented source-based setup.

## Tier 2 — Debt-free transition and savings

### Goal

Keep using the same tool after debt payoff, with a separate savings ledger.

### Required behavior

- Celebrate a transition from positive derived debt to zero or below once per payoff event, never on every poll or page load. Start-at-zero shows a debt-free state without a spurious payoff animation.
- Offer **Start Saving** or **Stay Here**. Switching is explicit, preserves debt history, and asks for a starting savings balance and optional positive savings goal.
- Support starting directly in savings mode. Allow viewing retained debt history without resetting it.
- Savings deposits, withdrawals, notes, corrections, trend chart, goal progress, and modest goal/milestone celebrations. Withdrawals receive neutral treatment.
- Extend daily email and manual entry with `S 500` for a savings deposit, `W 100` for withdrawal, and `N`. Keep the same atomic parsing and duplicate-prevention rules.
- Every check-in records its mode. After a mode switch, reject replies to old-mode check-ins with a correction request; never reinterpret debt commands as savings commands. New check-ins describe the current mode.
- Backups include both ledgers, mode, starting balances, and savings goal.

### Acceptance criteria

- Paying off debt celebrates once; staying in debt mode or choosing savings works across restart.
- Savings setup and mode changes preserve all debt history and do not silently turn credit into savings.
- `S` increases savings, `W` decreases it, and `N` changes no money through both email and manual paths.
- Wrong-mode commands and replies to old-mode check-ins change no balances.
- Savings chart correctly shows deposits and withdrawals. Goal progress handles zero, negative, and above-goal balances without division errors.
- Savings milestones do not replay on refresh. Backup/restore preserves both modes and their histories.

## Tier 3 — Pi appliance

### Goal

Run the proven browser application as my dedicated household display.

### Required behavior

- Use an available Raspberry Pi and compatible display; choose hardware based on actual kiosk performance. No custom electronics work.
- Start the application and Chromium kiosk at boot, opening local `/display`; restart the application after failure.
- Allow explicit local-network access for entry/settings from another household device. Optional mDNS name: `debtmonster.local`.
- Local display, calculations, charts, animations, and manual entry work offline. Email requires internet and resumes safely after outages.
- Document clean shutdown, data location, backup/restore, and the manual update procedure below.
- Transfer a computer backup to the Pi with validation and confirmation. Set up credentials separately. Disable email processing on the computer before enabling it on the Pi; one active instance owns the mailbox. No ongoing synchronization.

Suggested separation:

```text
/opt/debtmonster/          application files
/var/lib/debtmonster/     database, local config, backups
```

Use an equivalent separate configurable data directory for computer use from Tier 0.

### Acceptance criteria

- A real Pi boots into `/display`, recovers after application restart, and retains data across reboot.
- Normal display use needs no keyboard/mouse; another household device can submit updates on the configured LAN.
- Offline manual use works; restoring internet resumes email without duplicate transactions or old daily check-in backlogs.
- Computer-to-Pi transfer produces identical balances/history, with only the Pi processing email.
- A manual update and, where applicable, migration preserve real test data; documented recovery restores the previous working version and its compatible backup.

## Shared data and calculation rules

Keep the schema small: settings; transactions; check-ins; inbound-message outcomes; and, when needed in Tier 1, display events/milestone state. Transactions need ID, effective date/time, type, integer amount_cents, optional note, mode, and optional inbound-message reference. Record processing timestamps separately from effective dates where needed. Use stable ordering for chart points and multiple commands in one reply.

Calculate balances from starting amounts and the ledger; do not make stored current balances or percentages the source of truth.

```text
Derived debt = starting debt + charges - payments
Savings      = starting savings + deposits - withdrawals
Net debt reduction = starting debt - derived debt
```

- Starting balances are nonnegative integer cents. Savings goals, if set, are positive. Transaction amounts are positive integer cents. Corrections use edit/delete; a separate adjustment system is unnecessary for this build.
- Preserve overpayments in the ledger: derived debt may be negative. Show remaining debt as $0 and the excess separately as credit. Never automatically transfer credit to savings.
- Debt progress is net reduction / positive starting debt, clamped to 0–100% for the bar. Distinguish net reduction from total payments. Show debt growth neutrally and a 0% bar. With zero starting debt, omit percentage progress.
- Savings progress is savings / positive goal, clamped to 0–100% for the bar. Omit percentage/bar without a goal. Preserve and display negative or above-goal balances.
- Trend charts use actual ledger values; do not discard increases, withdrawals, or credits to make progress look smoother.
- Use one configured currency; no exchange rates or multi-currency accounting.

## Local operation and privacy

The financial database and calculations stay on the active device. There is no Debt Monster cloud service, telemetry, or account requirement. Email providers necessarily transport and may retain command amounts and any enabled balance confirmations; keep message contents minimal.

Bind to localhost by default. Enable LAN access explicitly and document that it trusts the household network. Do not expose the app publicly. Protect state-changing web requests against CSRF, reject unexpected origins/hosts, validate inputs, escape notes, and never execute email content. A login system is outside this personal build.

## Manual updates and data preservation

Sophisticated OTA updates are deferred. Do not build remote update checks, an in-app updater, automatic downloads, release servers, or automatic rollback infrastructure.

Document this simple operator-run procedure for computer and Pi:

1. Stop the app and its email worker so nothing writes during the update.
2. Create a consistent SQLite backup and copy local configuration separately, protecting mailbox secrets. Record the current application version/revision.
3. Update application files from a known repository revision or release; leave the data directory untouched. Install required dependencies using the documented environment.
4. If the schema changed, apply a small numbered migration against the existing database after backup. Never recreate or overwrite the ledger during startup/update.
5. Restart; verify balances/history, display, and email settings/worker status.
6. If verification fails, stop the app and restore the previous code plus its compatible pre-update database/configuration backup before restarting. Explain that restoring a backup discards changes made after that backup; avoid new entries until verification succeeds.

Use SQLite's backup facility or stop all writers before copying the database; do not rely on copying only a live `.db` file while WAL writes may exist. Validate migrations with representative debt, savings, and email deduplication records. A manual update must preserve transaction history, settings, inbound identities, and display cursors.

## Definition of success

Tier 0 delivers the defining low-friction loop: **morning email → direct reply → accurate local record → updated display**. Subsequent tiers improve that same personal workflow, carry it into savings, and optionally move it onto the Pi. Keep each tier small enough to finish and use before adding the next.
