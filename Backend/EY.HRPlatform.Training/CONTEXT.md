# Context: Training / Learning Module

> Glossary of domain terms for the Training bounded context. Definitions only — no implementation details.

## Glossary

### Attendance
Whether an enrolled employee was physically present at an in-person training **Session**.
Attendance is the *positive* signal only: it is recorded when an employee is marked
`Attended` (via QR scan or manual admin marking). There is no stored "absent" state.

### Present
An enrollment whose status is `Attended`. The employee was confirmed at the session.

### Absent (derived)
An enrollment that is **not** `Attended` on a Session that has already closed
(`Completed`, or `nowUtc >= EndUtc`), excluding `Cancelled` and `Waitlisted` enrollments.
Absence is never stored — it is computed at read-time as "enrolled but never marked present
after the session ended."

### Pending (derived)
An enrollment that is not yet `Attended` on a Session that has **not** closed yet.
Neither present nor absent — the outcome is still unknown.

### Attendance Rate
`Present / (Present + Absent)` for a given scope (session, employee, grade, period).
The denominator excludes `Cancelled`, `Waitlisted`, and `Pending` enrollments.

### Period
A calendar bucket (month) derived from `TrainingSession.StartUtc`, used for trend and
heatmap aggregations.

### In-person Hours
Sum of `TrainingPart.DurationHours` across the Sessions an employee `Attended`.

---

## Budget & Costs (Feature 7.2)

> Scope: cost and budget tracking applies **only to `OnSite` trainings delivered by an
> external trainer**. `ELearning` trainings and internal-trainer sessions are free and untracked.

### Internal Trainer
A **Session** delivered by an EY employee — identified by `TrainerEmployeeId`. Incurs **no
tracked cost**.

### External Trainer
A **Session** delivered by a hired non-employee — identified by free-text
`TrainerName`/`TrainerEmail` with no `TrainerEmployeeId`. The only kind of session that carries
a **Training Cost**.

### Training Cost
Money spent on an **external-trainer** Session: external-trainer fee + venue/room + materials +
other. Captured per Session. A training's total cost is the sum of its sessions' costs; internal
and `ELearning` trainings have a cost of zero.

### External Training (derived)
An `OnSite` training that has at least one external-trainer Session carrying a cost. Surfaced
with the orange "External" tag; an OnSite training with only internal-trainer sessions is
"Internal" (green, free).

### Sponsoring Service Line
The single `ServiceLine` whose budget funds an External Training's costs — the "charged-to"
service line, set on the `TrainingCourse`. Every external-session cost under that training counts
against this service line's budget. Exactly one is required per External Training, even for
trainings open to all service lines (there is no shared/"General" budget bucket).

### Budget Period
A non-overlapping date range (`PeriodStart`–`PeriodEnd`) over which a Sponsoring Service Line is
allocated an amount. Annual / Quarterly / Custom are presets that fill the dates. A service line
has **at most one** Budget Period covering any given instant — no nested or overlapping budgets.
Distinct from **Period** (the attendance calendar-month bucket defined above).

### Budget
The amount (`AllocatedAmount`, single currency) a Sponsoring Service Line may spend on External
Trainings during a Budget Period. Compared against **Spend** to derive remaining and
percent-consumed.

### Spend (derived)
The total external-trainer-session cost charged to a Sponsoring Service Line within a Budget
Period. A session's cost counts as Spend the **moment it is recorded** (committed accounting), is
filed into the period by the session's `StartUtc`, and is **excluded if the session is
`Cancelled`**. Never stored as a running total — always computed from session costs at read time.

### Percent Consumed (derived)
`Spend / Budget` for a Sponsoring Service Line in a Budget Period. Drives the dashboard's
green (<80%) / orange (80–90%) / red (>90%) status and the threshold thinking.

### Budget Threshold
A Percent Consumed level — **80%, 90%, 100%** — that colors the dashboard and, when **newly
crossed** by a just-recorded cost, triggers a one-off email to the configured budget
administrator. "Newly crossed" is judged by comparing Percent Consumed immediately before and
after the cost is recorded (Spend is never stored); a single cost that vaults several thresholds
emails once, for the highest level crossed. Delivery uses the Learning module's **own** SMTP
sender — independent of the Identity and Interview email infrastructure.
