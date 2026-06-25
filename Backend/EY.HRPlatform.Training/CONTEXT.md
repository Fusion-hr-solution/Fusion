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
