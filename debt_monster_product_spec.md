# Debt Monster — Product & Tiered Build Specification

## 1. Product Summary

**Debt Monster** is a simple, local-first motivational tool that helps a household visually track debt shrinking over time and, once debt reaches zero, transition into watching savings grow.

It is **not financial software**.

It does not connect to banks, credit cards, Plaid, investment accounts, or external financial institutions.

The user reports only the changes that matter:

- debt payment
- new credit-card charge
- savings deposit
- savings withdrawal

The preferred interaction is **email-first**.

Each morning, if email updates are enabled, the system sends a short check-in email. The user can reply directly to that email with a compact command such as:

```text
P 500
```

for a $500 payment,

```text
C 42.18
```

for a $42.18 new charge, or:

```text
N
```

for no change.

The application parses the reply, records the transaction locally, and updates the display automatically.

A local web form remains available as a fallback and for corrections/admin tasks.

The main experience is a small always-on display that makes financial progress visible and emotionally rewarding.

The product should remain focused strictly on:

1. **Debt**
2. **Savings**
3. **Debt-to-savings transition**

Do not expand the application into generic goal tracking.

---

# 2. Core Product Idea

The product promise is:

> Watch debt disappear. Then watch savings grow.

The display should feel more like a small household object than a finance dashboard.

The user should be able to understand their progress from across the room.

When debt decreases, a playful monster eats part of the debt.

When debt reaches zero, the user gets a major celebration and can switch into Savings Mode.

---

# 3. Product Philosophy

The application should feel:

- simple
- friendly
- visual
- motivating
- local-first
- private
- low-friction
- non-judgmental
- slightly playful
- polished enough to become a physical product

Avoid anything that makes it feel like budgeting software, accounting software, or online banking.

---

# 4. Explicit Non-Goals

Do NOT build the following for the initial product:

- Plaid integration
- bank integration
- credit-card API integration
- account aggregation
- automated transaction import
- budgeting categories
- expense categorization
- receipt scanning
- OCR
- bill payment
- money transfers
- credit-score features
- tax features
- investment tracking
- cloud account requirement
- user authentication
- subscription billing
- multi-user permissions
- native mobile app
- generic goal tracking
- vacation goals
- fitness goals
- habit tracking
- arbitrary progress trackers

---

# 5. TIERED BUILD STRATEGY

This project MUST be built in tiers.

The coding agent should complete and validate each tier before moving to the next.

Do not build later-tier features prematurely.

The objective is to get a usable prototype very quickly, then add polish only after the core experience works.

---

# TIER 0 — Proof of Concept

## Goal

Prove the complete central loop:

> Morning email → user replies → transaction is recorded → balance changes → display updates.

This is the defining interaction of the product and must be present from the beginning.

## Required Features

- local Flask application
- SQLite database
- starting debt setup
- current debt calculation
- one simple `/display` page
- basic transaction history
- configurable email integration
- send a test/check-in email
- receive and parse email replies
- record payment from email reply
- record charge from email reply
- handle `N` / no-change reply
- browser refresh or polling
- manual web entry as fallback

## Supported Reply Commands

Minimum syntax:

```text
P 500
```

means:

```text
payment = $500.00
```

```text
C 42.18
```

means:

```text
charge = $42.18
```

```text
N
```

means:

```text
no financial change
```

Parsing should be:

- case-insensitive
- whitespace tolerant
- safe against quoted email text/signatures
- limited to the first valid command found in the new reply content

Optional later syntax may support:

```text
PAY 500
PAYMENT 500
CHARGE 42.18
```

but the short commands above are sufficient for the first implementation.

## Email Configuration

Email updates must be configurable.

First-run setup should allow:

```text
Enable daily email check-in?
[ Yes ] [ No ]
```

If enabled, collect the minimum configuration required by the selected email transport.

The email feature must be isolated behind a small interface so the transport can later change without changing transaction logic.

Conceptually:

```text
EmailTransport
    send_checkin()
    fetch_replies()
```

The first implementation may use standard SMTP for sending and IMAP for receiving.

Do not tightly couple the application to one email provider.

## Email Check-In Example

Subject:

```text
Debt Monster Check-In [DM-20260828-7F3A]
```

Body:

```text
Good morning 🐲

Any debt changes since yesterday?

Reply with:

P 500      payment of $500
C 42.18    charge of $42.18
N          no change
```

Each check-in should contain a unique message/check-in identifier.

The identifier is used to:

- correlate the reply
- avoid processing the same reply twice
- preserve an audit trail
- make parsing safer

## Reply Processing

A lightweight background process should periodically check for replies.

For MVP:

```text
poll every 1–5 minutes
```

No message queue is needed.

When a reply is received:

1. identify the matching check-in
2. ignore already-processed messages
3. extract only the newly written reply text
4. parse the command
5. validate the amount
6. record the transaction
7. mark the inbound message as processed
8. update the display through normal database polling
9. optionally send a short confirmation email

Example confirmation:

```text
CHOMP! 🐲

$500 payment recorded.

Debt remaining: $23,885
```

Confirmation email should be configurable and may be disabled by default if unnecessary.

## Safety / Error Handling

If the reply cannot be parsed, do not guess.

Example:

```text
I couldn't understand that update.

Please reply with:
P 500
C 42.18
or N
```

Never create a financial transaction from ambiguous text.

Do not process the same email twice.

## Display Requirements

Only one display screen is required at this tier:

```text
DEBT MONSTER

$24,385
REMAINING

$6,865 PAID OFF
```

No animation is required yet.

No rotating views.

No savings mode.

No Raspberry Pi setup.

No software-update mechanism.

## Acceptance Criteria

Tier 0 is complete when:

1. application launches locally
2. user enters starting debt
3. email check-in can be enabled or disabled
4. system sends a check-in email when enabled
5. replying `P 500` creates a $500 payment
6. replying `C 42.18` creates a $42.18 charge
7. replying `N` creates no financial transaction
8. duplicate email replies are not processed twice
9. malformed replies do not create transactions
10. payment reduces debt correctly
11. charge increases debt correctly
12. values persist after restart
13. `/display` shows the current total
14. display reflects email-created transactions automatically
15. manual web entry remains available as fallback

## Stop Condition

Do not continue if email parsing, transaction calculations, persistence, or duplicate prevention are unreliable.

# TIER 1 — Usable Local Product

## Goal

Turn the proof of concept into something a household could actually use every day on a PC or browser.

## Required Features

Everything from Tier 0 plus:

- polished first-run setup page
- configurable daily email time
- configurable recipient email address
- enable/disable email check-ins at any time
- email integration status/test screen
- simple payment form
- simple charge form
- optional transaction note
- edit transaction
- delete transaction
- automatic recalculation
- progress bar
- amount paid off
- percentage complete
- basic debt trend chart
- CSV export
- JSON backup/export
- clean responsive interface

## Primary Display

Example:

```text
        DEBT MONSTER

          $24,385
          REMAINING

       $6,865 EATEN
      21.9% COMPLETE

██████████████░░░░░░░░░░
```

## Update Form

Debt mode:

```text
What happened?

[ Made a Payment ]
[ Added a Charge ]
[ Nothing ]
```

## Acceptance Criteria

Tier 1 is complete when:

1. a non-technical user can set it up locally
2. transaction mistakes can be corrected
3. balance always recalculates correctly
4. trend chart reflects transaction history
5. data can be backed up
6. user does not need to edit source code

## Stop Condition

At the end of Tier 1, the software should already be useful even without the monster animations or Raspberry Pi hardware.

---

# TIER 2 — Emotional / Visual Experience

## Goal

Make the product feel fun, motivating, and memorable.

This is the tier where Debt Monster becomes more than a CRUD application.

## Required Features

Everything from Tier 1 plus:

- Debt Monster visual character
- payment celebration
- "CHOMP" animation
- milestone celebrations
- rotating display views
- monthly progress view
- better typography and spacing
- polished kiosk-style screen
- neutral behavior when debt increases

## Payment Celebration

When a payment is recorded:

```text
        🐲

      CHOMP!

      -$500

Debt remaining

     $23,885
```

Animation duration:

```text
5–10 seconds
```

Possible effects:

- monster chewing
- chunk disappearing
- count-down animation
- progress bar movement
- subtle particles

Do not overbuild the animation system.

CSS and lightweight JavaScript are sufficient.

## Charge Behavior

If debt increases:

```text
+$42.18 added

Current debt:
$24,427.18
```

Do not shame the user.

Avoid:

- angry monster
- failure language
- red warning screens
- guilt messages

## Milestones

Trigger celebrations at:

```text
10%
25%
50%
75%
90%
100%
```

Optional dollar milestones:

```text
$1,000 paid off
$5,000 paid off
$10,000 paid off
```

## Rotating Views

Recommended:

### View 1 — Current Debt

```text
$24,385 remaining
```

### View 2 — Trend

Simple line chart.

### View 3 — This Month

```text
THIS MONTH

$1,850
EATEN
```

### View 4 — Monster

```text
🐲

Still hungry.

$24,385 left to eat.
```

## Acceptance Criteria

Tier 2 is complete when:

1. making a payment feels satisfying
2. the display is readable from several feet away
3. progress is visually obvious
4. the application no longer feels like finance software
5. debt increases are handled neutrally

---

# TIER 3 — Debt-Free + Savings Mode

## Goal

Make the product remain useful after debt reaches zero.

This tier creates the complete Debt → Savings lifecycle.

## Debt-Free Trigger

When:

```text
current_debt <= 0
```

show a major celebration.

Example:

```text
        🐲 🎉

   THE MONSTER
   ATE IT ALL.

      $0 DEBT

YOU DID IT.
```

## Transition Screen

After the celebration:

```text
Debt defeated.

Ready to start building?

[ Start Saving ]
[ Stay Here ]
```

## Savings Mode

Savings mode should support:

- starting savings balance
- deposit
- withdrawal
- savings goal amount
- progress bar
- upward trend chart
- milestone celebrations

Example:

```text
        SAVINGS MODE

            🌱

          $8,420

        SAVED SO FAR

       Goal: $15,000

█████████████░░░░░░░░░░░
```

## Savings Calculation

```text
Current Savings =
Starting Savings
+ Deposits
- Withdrawals
```

## Acceptance Criteria

Tier 3 is complete when:

1. debt reaching zero triggers celebration
2. user can switch into Savings Mode
3. savings deposits increase balance
4. withdrawals reduce balance
5. savings history persists
6. savings chart moves upward over time
7. application remains useful indefinitely after debt payoff

---

# TIER 4 — Raspberry Pi Appliance

## Goal

Turn the software into a dedicated physical household display.

Do not start this tier until the browser version feels good.

## Recommended Initial Hardware

Preferred first option:

```text
Raspberry Pi Zero 2 W
```

with a small HDMI or DSI display.

Alternative low-cost hardware can be evaluated later.

## Appliance Architecture

```text
Raspberry Pi
     │
     ├── Flask
     ├── SQLite
     └── Chromium kiosk
           │
           ▼
     localhost/display
```

## Requirements

- application starts on boot
- browser starts automatically
- kiosk mode
- `/display` opens automatically
- local network access
- optional mDNS:
  `debtmonster.local`
- data survives reboot
- clean shutdown behavior
- no internet required for normal use

## Suggested File Separation

Application:

```text
/opt/debtmonster/
```

User data:

```text
/var/lib/debtmonster/
```

Example:

```text
/opt/debtmonster/
    app/
    static/
    templates/
    VERSION

/var/lib/debtmonster/
    debtmonster.db
    config.yaml
    backups/
```

This separation is important for future software updates.

## Acceptance Criteria

Tier 4 is complete when:

1. Pi boots directly into the display
2. app survives restart
3. data remains intact
4. user can enter transactions from another device on the local network
5. no keyboard or mouse is required for normal operation

---

# TIER 5 — Software Update System

## Goal

Allow physical devices to receive new software versions without affecting user financial data.

This tier should remain simple.

Do NOT build a complex package-management platform.

## Update Philosophy

The device may connect to the internet to:

- check for a new software version
- download a release
- install it locally

User financial data must remain local.

Do not upload:

- transaction history
- debt balance
- savings balance
- notes
- financial data

## Versioning

Use semantic versioning:

```text
1.0.0
1.1.0
1.2.0
2.0.0
```

Store current version in:

```text
/opt/debtmonster/VERSION
```

## Update Flow

Future admin screen:

```text
Debt Monster
Version 1.2.0

Version 1.3.0 is available.

What's new:
• New display layout
• Better monthly stats
• Improved monster animation

[ Install Update ]
```

Recommended update flow:

1. check remote release metadata
2. compare version
3. user chooses Install
4. backup database
5. stop application
6. download release
7. replace software files
8. run database migration if needed
9. restart application
10. validate startup
11. rollback if validation fails

## Important

Do not automatically install updates by default.

Prefer:

```text
Check → Notify → User chooses Install
```

## Database Migrations

If the schema changes, use numbered migrations.

Example:

```text
001_initial.sql
002_add_mode.sql
003_add_version_metadata.sql
```

Never delete or overwrite user financial history during an update.

## Acceptance Criteria

Tier 5 is complete when:

1. device can identify its current software version
2. device can determine whether an update exists
3. user can trigger an update
4. database is backed up first
5. user data survives update
6. failed update can rollback safely

---

# TIER 6 — Commercial Product Polish

## Goal

Only after the software and physical prototype are proven, make the device sellable.

This tier is not required for the first prototype.

## Areas to Improve

- enclosure design
- reliable display mounting
- power management
- packaging
- setup instructions
- Wi-Fi onboarding
- polished startup experience
- manufacturing repeatability
- product photography
- Etsy listing
- support documentation

## Possible Physical Product

```text
┌─────────────────────────────┐
│                             │
│        DEBT MONSTER         │
│                             │
│            🐲               │
│                             │
│          $24,385            │
│          remaining          │
│                             │
│     ███████████░░░░░░       │
│                             │
└─────────────────────────────┘
```

Possible enclosure materials:

- maple
- oak
- walnut
- birch plywood

Potential personalized options:

- engraved family name
- custom message
- custom finish

Do not optimize enclosure cost or custom electronics before validating interest.

---

# 6. Data Model

Use SQLite.

## Settings

Recommended fields:

```text
id
key
value
```

Possible settings:

```text
mode
display_name
currency
starting_debt
starting_savings
savings_goal
rotation_interval
monster_enabled
software_version
```

## Transactions

Recommended fields:

```text
id
timestamp
date
type
amount_cents
note
mode
```

Supported debt types:

```text
payment
charge
adjustment
```

Supported savings types:

```text
deposit
withdrawal
adjustment
```

---

# 7. Money Representation

Never use floating point for money.

Use integer cents.

Example:

```text
$500.00 = 50000
```

---

# 8. Derived Values

Do not permanently store:

- current debt
- current savings
- percentage complete
- total amount paid off

Calculate them from starting values and transaction history.

Debt:

```text
Current Debt =
Starting Debt
+ Charges
- Payments
+ Adjustments
```

Savings:

```text
Current Savings =
Starting Savings
+ Deposits
- Withdrawals
+ Adjustments
```

---

# 9. Suggested Technology Stack

Backend:

```text
Python
Flask
```

Database:

```text
SQLite
```

Frontend:

```text
HTML
CSS
Vanilla JavaScript
```

Optional:

```text
Chart.js
```

Avoid React, Vue, Svelte, or other SPA frameworks unless a clear requirement appears later.

---

# 10. Suggested Project Structure

```text
debt-monster/
│
├── app.py
├── requirements.txt
├── README.md
├── LICENSE
├── VERSION
│
├── data/
│   └── debt_monster.db
│
├── templates/
│   ├── display.html
│   ├── update.html
│   ├── payment.html
│   ├── charge.html
│   ├── savings.html
│   ├── admin.html
│   └── setup.html
│
├── static/
│   ├── css/
│   ├── js/
│   └── assets/
│       └── monster/
│
├── debtmonster/
│   ├── database.py
│   ├── calculations.py
│   ├── models.py
│   ├── routes.py
│   └── migrations.py
│
├── scripts/
│   ├── install.sh
│   ├── run.sh
│   ├── kiosk.sh
│   └── update.sh
│
└── tests/
```

Keep it simpler than this if possible.

---

# 11. API

Minimum API:

## GET /api/status

Example:

```json
{
  "mode": "debt",
  "startingBalanceCents": 3125000,
  "currentBalanceCents": 2438500,
  "progress": 0.21968
}
```

## GET /api/transactions

Optional:

```text
?limit=100
```

## POST /api/transactions

Example:

```json
{
  "type": "payment",
  "amountCents": 50000,
  "note": "Visa"
}
```

## PUT /api/transactions/:id

## DELETE /api/transactions/:id

---

# 12. Display Update Strategy

Do not use WebSockets for early versions.

Poll:

```text
GET /api/status
```

every:

```text
5 seconds
```

If the balance changes:

1. retrieve latest transaction
2. update display
3. trigger animation if appropriate

---

# 13. Email Check-In System

Email is a **core interaction**, not an optional future reminder feature.

The product should support two input paths:

```text
PRIMARY:
Daily email → reply → automatic update

FALLBACK:
Local web form → manual update
```

## User Configuration

Settings:

```text
email_updates_enabled
checkin_time
recipient_email
email_transport
confirmation_email_enabled
```

A user must be able to disable daily emails without disabling the rest of the product.

## Scheduling

When enabled, send one check-in per day at the configured local time.

The scheduler can remain simple.

Suitable implementations include:

```text
APScheduler
cron/systemd timer
small in-process scheduler
```

Choose the simplest reliable option for the platform.

## Sending

Abstract sending behind an email transport.

Initial implementation may use:

```text
SMTP
```

## Receiving

Initial implementation may use:

```text
IMAP polling
```

Do not require a public webhook or public internet exposure for the local application.

This is important to preserve the local-first architecture.

## Correlation

Every outgoing check-in must have a unique identifier.

Example:

```text
[DM-20260828-7F3A]
```

Persist:

```text
checkin_id
sent_at
recipient
message_id
processed_reply_id
status
```

## Idempotency

Inbound email processing must be idempotent.

The same inbound message must never create multiple transactions.

Store a stable inbound identifier such as:

```text
Message-ID
```

or another provider-returned immutable identifier.

## Parsing

Supported debt commands:

```text
P 500
C 42.18
N
```

Supported savings commands once Savings Mode exists:

```text
D 500
```

or preferably a less ambiguous command:

```text
S 500
```

for savings deposit, and:

```text
W 100
```

for withdrawal.

The exact savings syntax should be chosen once Savings Mode is implemented.

Debt-mode parsing should ship first.

## Local-First Boundary

Email transport obviously uses the user's email provider, but the product must not create a Debt Monster cloud account or upload the financial database.

Only the minimal content needed for the email interaction should transit through email.

All calculations and persistent transaction history remain on the local device.

# 14. Privacy

Core principle:

> Financial data stays on the device.

Default:

```text
No cloud
No telemetry
No analytics
No account
No bank credentials
```

Internet access is optional and primarily intended for software update checks.

---

# 15. Security

- local network only by default
- never expose the app publicly by default
- sanitize form input
- validate transaction amounts
- escape transaction notes
- minimize dependencies
- do not execute user-provided content
- keep update downloads authenticated/verified before installation

---

# 16. Backup

User data should be easy to locate and back up.

Recommended production path:

```text
/var/lib/debtmonster/debtmonster.db
```

Provide:

```text
Download Backup
Restore Backup
Export CSV
Export JSON
```

Before software update:

```text
automatic database backup
```

---

# 17. Tests

Minimum tests:

- starting debt
- email check-in generation
- email command parsing
- `P 500` creates correct payment
- `C 42.18` creates correct charge
- `N` creates no transaction
- malformed reply creates no transaction
- duplicate inbound email is processed once
- quoted reply/signature text does not corrupt parsing
- payment lowers debt
- charge increases debt
- multiple transactions
- edit recalculates
- delete recalculates
- debt-free state
- savings deposit
- savings withdrawal
- backup/restore
- migration preserves transactions

---

# 18. Development Rules for Coding Agents

When building this application:

1. Complete tiers in order.
2. Treat email reply input as a core feature starting in Tier 0.
3. Do not replace email reply input with a web-link-only workflow.
4. Keep the manual web form as a fallback/admin path.
5. Do not implement later tiers early.
3. Prioritize working software over architecture.
4. Prefer simple implementation.
5. Keep dependencies minimal.
6. Do not add features outside the scope.
7. Keep all user financial data local.
8. Never use floating-point values for money.
9. Make the browser version work before Pi deployment.
10. Test each tier before proceeding.

If a design choice creates significant complexity, choose the simpler alternative.

Avoid:

- microservices
- cloud infrastructure
- OAuth
- message queues
- external databases
- unnecessary frontend frameworks
- premature custom hardware
- premature SaaS architecture

---

# 19. Recommended Coding-Agent Workflow

The agent should work in this sequence:

## Pass 1

Build and test:

```text
Tier 0
```

Stop and verify.

## Pass 2

Build and test:

```text
Tier 1
```

Stop and verify.

## Pass 3

Build:

```text
Tier 2
```

User should review the visual experience before continuing.

## Pass 4

Build:

```text
Tier 3
```

Validate the full Debt → $0 → Savings transition.

## Pass 5

Build:

```text
Tier 4
```

Only after the browser product is stable.

## Pass 6

Add:

```text
Tier 5
```

Only once a real physical device exists.

## Pass 7

Commercial polish:

```text
Tier 6
```

Only after the product has been used and shown to potential customers.

---

# 20. Commercial Strategy

The software can remain free and local-first.

Potential commercial product:

```text
Free software
+
preconfigured hardware
+
small display
+
attractive wooden enclosure
+
easy setup
```

The customer is primarily paying for:

- convenience
- hardware integration
- enclosure
- presentation
- setup
- giftability
- emotional experience

Do not assume a SaaS model is necessary.

---

# 21. Lean Validation Strategy

Before making a large investment:

1. Build Tier 0.
2. Build Tier 1.
3. Build Tier 2.
4. Use it with real debt data.
5. Build one Raspberry Pi prototype.
6. Put it in a simple wooden enclosure.
7. Record a short demonstration video.
8. Show it to potential buyers.
9. List a small number of units.
10. Improve only based on real interest.

Do not design custom PCBs or expensive tooling before validation.

---

# 22. Product Positioning

Do not market as:

```text
Financial software
Budgeting software
Debt management software
Financial planning software
```

Better:

```text
Visual Debt Tracker
Debt Payoff Display
Savings Progress Display
Debt & Savings Progress Display
```

Possible positioning:

> Watch debt disappear. Then watch savings grow.

or:

> Make financial progress visible.

---

# 23. Initial Demo Data

For development only:

```text
Starting debt: $31,250
```

Example history:

```text
Payment     $500
Charge       $42
Payment   $1,200
Payment     $350
Charge       $67
Payment     $800
```

---

# 24. Visual Style

Desired:

- warm
- playful
- polished
- calm
- modern
- slightly whimsical
- not childish
- not corporate

The monster should feel lovable rather than aggressive.

Avoid:

- banking dashboards
- stock-market visuals
- dense tables
- spreadsheet aesthetics

---

# 25. Final Product Boundary

Debt Monster should remain focused on:

```text
DEBT
  ↓
$0
  ↓
SAVINGS
```

Do not turn it into a generic goal platform.

The first and most important success criterion remains:

> A user receives the morning check-in email, replies `P 500`, and shortly afterward sees the Debt Monster display reflect a $500 reduction without opening the app.
