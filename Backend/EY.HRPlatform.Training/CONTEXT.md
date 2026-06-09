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
