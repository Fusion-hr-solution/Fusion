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
The scheduled duration (start-to-end) of the Sessions an employee `Attended`, summed.

### Training Hours
An employee's total estimated learning time: **In-person Hours** plus **E-learning Hours**.
Reported per employee, splittable by format. Always presented as *estimated*.

### E-learning Hours
Estimated time an employee spent on completed e-learning trainings: the authored content
duration of each training the employee `Completed`. When a completed training carries no
authored duration at all, a coarse per-training fallback stands in so a finished training is
never shown as zero. Always *estimated*.

### Format Comparison
A side-by-side view of e-learning vs on-site delivery over a scope — counts of trainings,
hours delivered, participants, completion rate, and average **Learner Feedback** — so an admin
can judge which format performs better.

### Import Session
A staged, expiring snapshot of an uploaded import workbook: its parsed rows and the validation
verdict for each, held between **upload** and **confirm** so the admin can preview before
anything is created. Distinct from a **Training Session**.

### Import Ref
An admin-assigned code identifying one training *within an import workbook*. Child rows
(sessions, chapters, content) cite their parent training by its Ref. It is a spreadsheet-local
link only — never stored on the created entities.

### Safe-update
The non-destructive resolution for an imported training that duplicates an existing one: only
flat course fields are refreshed and any genuinely new children are appended. Existing chapters,
sessions, enrollments, and learner progress are never deleted or overwritten. The deliberate
alternative to a destructive replace.

### Quiz Draft
A transient, per-training working set of quiz questions — AI-generated and/or hand-edited —
that an admin reviews before publishing. On publish it becomes ordinary **Exam** questions and
the draft is cleared. It is scratch space, not a published artifact.

### Training Completed
A learner has completed a training when its `TrainingProgress.Status` is `Completed`. For
e-learning that means reaching 100% (passing any exam gate); for on-site it means having been
`Attended` at at least one Session of **every** Part. Both formats resolve to the same completion
record, so completion is a single concept across formats. This is the anchor that makes a learner
eligible for, and prompted to give, **Learner Feedback**.

### Learner Feedback
Structured input an employee gives after finishing a training (or attending an in-person
Session) — ratings, a recommendation, and optional free text — used to judge training quality.
Distinct from **Trainer Feedback**.
_Avoid_: review, survey, evaluation.

### Trainer Feedback
Input a **Trainer** gives about the group they trained (engagement, knowledge level,
prerequisite suggestions). Admin-visible only; never shown to learners. The opposite direction
from **Learner Feedback**.

### Anonymous Feedback
Learner Feedback whose author is hidden from admins (`isAnonymous = true`). The link to the author
is still stored, so dedup, reminders, and Response Rate keep working; only the display is
suppressed. Individual comments are additionally hidden when a training has too few responses,
to stop a small cohort being de-anonymized by inference.

### Response Rate
The share of completions that produced Learner Feedback: `feedbacks / completions`. The denominator
counts only **Training Completed** events on or after the feedback feature launched — completions
from before then had no opportunity to respond and would otherwise deflate the rate. Scopable by
training, category, period, and format.

### Trainer
The person who leads an in-person **Session**. An internal trainer is an Employee referenced by
`TrainerEmployeeId`; an external trainer exists only as free-text `TrainerName`/`TrainerEmail`,
with no account and no platform role. For aggregation a trainer is keyed by employee id, else
email, else name. Only internal trainers can author **Trainer Feedback** (externals cannot
authenticate).

### Feedback Form
The set of questions a learner answers. It has a **fixed core** of rating dimensions that every
training shares (so dashboards stay comparable) plus optional **custom questions** an admin may
append per training **Category**. The core dimensions can never be removed or redefined.

### Core Dimension
One of the fixed, always-present rating fields on the Feedback Form (overall, content, trainer,
relevance, would-recommend). The only fields the aggregation dashboards chart, because they are
guaranteed present and comparable across every training.

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
