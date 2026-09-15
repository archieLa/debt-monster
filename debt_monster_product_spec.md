# Debt Monster product spec

## Source and scope

This spec was reconstructed from the ChatGPT conversation “Design Debt Monster Tool” in the Debt project. It captures the visible discussion and its latest decisions; it is not the original referenced Markdown document. Detailed acceptance criteria below are proposed implementation guidance.

## Product

A small, encouraging debt and savings display. Users record payments and charges rather than repeatedly entering a full balance. Payments make the monster eat debt; charges update the display calmly without guilt or punishment. After debt reaches zero, users can optionally switch to savings mode. Users without debt can eventually start in savings mode.

Keep the product limited to debt payoff and savings. Do not build a budgeting system, generic goal tracker, bank integration, hosted financial service, mobile app, or subscription platform.

The initial target is a working local prototype on a PC, followed by a Raspberry Pi display in browser kiosk mode. Potential monetization centers on hardware, a display, a wooden enclosure, and convenience.

## Core workflow

Morning email → user replies `P 500`, `C 42.18`, or `N` → local record created → display updates automatically.

- `P 500`: record a $500 payment.
- `C 42.18`: record a $42.18 charge.
- `N`: record a check-in with no balance change.

Email belongs in Tier 0. A web form is a fallback; editing and corrections are added in Tier 1. Email check-ins can be disabled and their time configured.

## Architecture

Use Flask, SQLite, and vanilla HTML/CSS/JS. Store monetary values as integer cents and parse decimal input without floating-point arithmetic.

Derive debt from starting debt plus charges minus payments. Preserve transaction history. Keep user data separate from application files, using a configurable local data directory. For the eventual Pi installation, proposed paths are `/opt/debtmonster/` for code and `/var/lib/debtmonster/` for data.

Use SMTP to send check-ins and IMAP polling to receive replies. This avoids exposing the local device publicly or operating a Debt Monster cloud service. Email providers still transport and may retain the command messages; financial history remains in the local database.

Keep email credentials outside source control. Match replies to unique check-in IDs, accept only the configured sender, and protect against duplicate messages. Reject malformed or ambiguous commands without changing the balance. Handle quoted replies without interpreting quoted commands as new transactions. Use authenticated, encrypted mail connections.

## Build tiers

Finish and validate each tier before implementing the next. Do not include later-tier functionality just because its infrastructure seems useful.

### Tier 0 — Proof of concept

Starting debt setup, local persistence, payment/charge/no-change entry, a large balance display that updates automatically, and configurable daily email check-ins with reply processing.

Acceptance criteria:

- A fresh installation can set a starting debt and reopen it after a restart.
- From $1,000, `P 500` yields $500; `C 42.18` then yields $542.18; `N` leaves it unchanged.
- The fallback web form and email replies use the same transaction rules.
- The display refreshes automatically when a transaction is recorded.
- Email can be enabled/disabled; check-in time and time zone are configurable.
- SMTP sending and IMAP processing are demonstrated with a configured test mailbox or controlled test transport. Clearly distinguish simulated verification from a live mailbox check.
- Duplicate delivery or polling after restart does not apply a reply twice.
- Invalid amounts, unknown senders, unmatched check-in IDs, and malformed replies cause no financial mutation.
- Quoted email text does not cause an unintended transaction.
- Mail failures preserve data and can be retried without duplicate transactions.
- Define and document how overpayments are handled before implementing them; never silently discard money.
- Meaningful automated tests cover money arithmetic, persistence, reply validation, and deduplication.

Stop after Tier 0 passes. Report any live email setup that still requires user credentials.

### Tier 1 — Usable local product

Improve setup and settings; add transaction editing/correction, history, progress bar, trend chart, and backup/export. Verify corrections recompute totals and backups can be restored.

### Tier 2 — Emotional experience

Add the monster, satisfying CHOMP payment animation, milestones, and rotating display views. Charges remain neutral. Verify a payment celebration is not repeatedly replayed on each refresh.

### Tier 3 — Debt-free and savings mode

Celebrate $0 and offer an optional transition to savings. Support starting directly in savings mode. Specify savings transaction semantics and preserve debt history across the transition.

### Tier 4 — Raspberry Pi appliance

Boot-to-display, browser kiosk mode, and entry over the local network. Document deployment, service startup, and data location. Validate on actual hardware when available and identify hardware checks that remain unverified.

### Tier 5 — Software updates

Version checks, explicit user-triggered installation, backup before updating, database migrations, and rollback on startup failure. Updating code must preserve user history. Avoid automatic installation in the initial updater.

### Tier 6 — Commercial polish

Enclosure, Wi-Fi onboarding, packaging, recovery guidance, and readiness for a small hardware sales experiment.

## Implementation guidance

Keep the implementation simple and readable. Use the smallest architecture that meets the current tier. Provide run instructions and tests alongside the application. Do not commit credentials, mailbox contents, or personal financial data. Do not claim the original spec or unavailable attachments were read.
