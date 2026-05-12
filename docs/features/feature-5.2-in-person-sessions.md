# Feature 5.2 — In-Person Training Sessions & Parts

> Scope: **US-5.2.1** (Admin: create & manage Parts/Sessions) + **US-5.2.2** (Employee: enroll with time-slot selection per Part).

---

## 1. Concept

An in-person training is split into multiple ordered **Parts** (séances). Each Part can be offered through one or more **Sessions** (time slots). A learner must attend **one Session per Part** to complete the training.

```
Training "Leadership for Managers"
├── Part 1 — Foundations (durationHours: 3)
│   ├── Session A — Mon 10 Apr 09:00–12:00, Room A, cap 25
│   └── Session B — Wed 12 Apr 14:00–17:00, Room B, cap 20
├── Part 2 — Communication
│   ├── Session A — Mon 17 Apr 09:00–12:00, Room A
│   └── Session B — Tue 18 Apr 09:00–12:00, Room C
└── Part 3 — Practical Workshop
    └── Session A — Mon  1 May 09:00–17:00, Room A
```

| Concept | Cardinality | Owner |
|---------|-------------|-------|
| Training | 1 | Existing `TrainingCourse` aggregate root |
| Part    | 1..N per Training, ordered by `OrderIndex` | `TrainingPart` |
| Session | 1..N per Part, distinct date/room/trainer | `TrainingSession` |
| Enrollment | 1 per Employee per Session | `SessionEnrollment` |

---

## 2. Backend — US-5.2.1 (Admin CRUD)

### 2.1 Domain

- `Domain/Enums/SessionStatus.cs` — `Planned`, `InProgress`, `Completed`, `Cancelled`.
- `Domain/Entities/TrainingPart.cs` — child of `TrainingCourse`. Immutable identity, mutates via `Update(title, description, durationHours)` and `Reorder(orderIndex)`.
- `Domain/Entities/TrainingSession.cs` — child of `TrainingPart`. Mutates via `Update(...)`, `Cancel(reason)`, `MarkInProgress`, `MarkCompleted`. Exposes `EffectiveStatus(nowUtc)`.

### 2.2 Persistence

- `TrainingParts (Id, TrainingId, Title, Description, OrderIndex, DurationHours, CreatedAt, …)` — Unique index `(TrainingId, OrderIndex)`.
- `TrainingSessions (Id, PartId, StartUtc, EndUtc, Room, MaxCapacity, Status, CancelReason, TrainerEmployeeId, TrainerName, TrainerEmail, Notes, …)` — Indexes on `TrainerEmployeeId` and `(StartUtc, EndUtc)`.
- Migration: `AddTrainingPartsAndSessions`.

### 2.3 CQRS Handlers

| Handler | Purpose |
|---------|---------|
| `AddPartCommand` | Auto-assigns next `OrderIndex` |
| `UpdatePartCommand` | Validates duration > 0 |
| `DeletePartCommand` | Hard delete — cascades to sessions |
| `ReorderPartsCommand` | Two-pass write for unique index |
| `GetPartsForTrainingQuery` | Returns parts ordered by `OrderIndex` |
| `AddSessionCommand` | Validates time/capacity; room-conflict warnings |
| `UpdateSessionCommand` | Same validation + conflict warnings |
| `CancelSessionCommand` | Sets status to `Cancelled` with reason |
| `DuplicateSessionCommand` | Optional recurrence |
| `GetSessionsQuery` | Filterable list with projected status |
| `GetSessionDetailQuery` | Full detail |
| `DetectRoomConflictsQuery` | Standalone conflict probe |

### 2.4 HTTP Surface (Admin)

```
# Parts (nested under training)
GET    /api/training/admin/trainings/{trainingId}/parts
POST   /api/training/admin/trainings/{trainingId}/parts
PUT    /api/training/admin/trainings/{trainingId}/parts/{partId}
DELETE /api/training/admin/trainings/{trainingId}/parts/{partId}
PUT    /api/training/admin/trainings/{trainingId}/parts/reorder

# Sessions
GET    /api/training/admin/sessions
GET    /api/training/admin/sessions/{sessionId}
POST   /api/training/admin/trainings/{trainingId}/parts/{partId}/sessions
PUT    /api/training/admin/sessions/{sessionId}
POST   /api/training/admin/sessions/{sessionId}/cancel
POST   /api/training/admin/sessions/{sessionId}/duplicate
GET    /api/training/admin/sessions/conflicts
```

All endpoints require `[Authorize(Roles = "PlatformAdmin,HRAdmin")]`.

---

## 3. Backend — US-5.2.2 (Employee Enrollment)

### 3.1 Domain

- `Domain/Enums/EnrollmentStatus.cs` — `Enrolled`, `Waitlisted`, `Cancelled`, `Attended`.
- `Domain/Entities/SessionEnrollment.cs` — Links an employee to a session. Methods: `Cancel()`, `PromoteFromWaitlist()`, `MarkAttended()`.

### 3.2 Persistence

- New table `SessionEnrollments (Id, SessionId, EmployeeId, Status, WaitlistPosition, CancelledAt, AttendedAt, CreatedAt, …)`:
  - Filtered unique index `(EmployeeId, SessionId) WHERE Status != 'Cancelled'`.
  - Indexes on `SessionId` and `EmployeeId`.
- Migration: `AddSessionEnrollments`.

### 3.3 CQRS Handlers

| Handler | Purpose |
|---------|---------|
| `EnrollInSessionsCommand` | Validates training is OnSite, all parts have a selection, sessions belong to parts, no duplicates. Enrolls or waitlists per capacity. Auto-creates `TrainingAssignment`. |
| `CancelSessionEnrollmentCommand` | Enforces configurable deadline (default 24h). Auto-promotes first waitlisted person. Cancelling one part does not affect others. |
| `MarkAttendanceCommand` | Admin marks an enrolled employee as attended for a session. |
| `GetAvailableSessionsForEnrollmentQuery` | Returns parts with sessions showing available spots, hides cancelled/completed sessions. |
| `GetMySessionEnrollmentsQuery` | Returns per-part enrollment status + completion progress (`CompletedParts / TotalParts`, `IsTrainingCompleted`). |

### 3.4 Business Rules

1. **Part-by-part selection**: Employee must select exactly one session per part.
2. **Capacity**: If session is full, employee is waitlisted with a position number.
3. **Waitlist auto-promotion**: When an enrolled person cancels, the first waitlisted person is promoted to `Enrolled`.
4. **Cancellation deadline**: Employee can cancel up to X hours (configurable, default 24h) before session start.
5. **Independent parts**: Cancelling one part's session does not cancel other parts.
6. **Completion**: Training is marked complete only when ALL parts have `Attended` status.

### 3.5 HTTP Surface (Employee)

```
GET    /api/training/session-enrollments/available/{trainingId}   # Available sessions for enrollment
POST   /api/training/session-enrollments                          # Enroll in all parts at once
GET    /api/training/session-enrollments/my/{trainingId}          # My enrollments + progress
POST   /api/training/session-enrollments/cancel                   # Cancel one session enrollment
POST   /api/training/session-enrollments/mark-attendance          # Admin: mark attendance
```

First 4 endpoints require `[Authorize]` (any authenticated user). `mark-attendance` requires `[Authorize(Roles = "PlatformAdmin,HRAdmin")]`.

### 3.6 Status Lifecycle

```
Enrolled ─────► Attended        (admin marks attendance)
    │
    └────► Cancelled            (employee cancels before deadline)

Waitlisted ──► Enrolled         (auto-promoted when spot opens)
    │
    └────► Cancelled            (employee cancels)
```

Training completion: `IsTrainingCompleted = (CompletedParts == TotalParts && TotalParts > 0)`

---

## 4. Tests

### 4.1 Backend — US-5.2.1 (15 tests)

- `Handlers/Admin/Parts/PartCommandHandlerTests.cs` — add / update / delete / reorder + validation.
- `Handlers/Admin/Sessions/SessionCommandHandlerTests.cs` — add / update / cancel / duplicate, validation, room-conflict.

### 4.2 Backend — US-5.2.2 (22 tests)

- `Handlers/Enrollment/EnrollmentCommandHandlerTests.cs` (14 tests):
  - Enroll success, not-on-site guard, missing part selection, session-part mismatch, already enrolled, waitlist when full, assignment creation, cancelled session guard, cancel before deadline, cancel doesn't affect other parts, waitlist promotion, cancel-not-enrolled, mark attendance success, mark-not-enrolled.
- `Handlers/Enrollment/EnrollmentQueryHandlerTests.cs` (8 tests):
  - Available sessions structure, capacity after enrollment, hidden cancelled sessions, not-on-site guard, enrollment progress, completion tracking, full completion, not-enrolled status.

Run:

```powershell
cd Backend\EY.HRPlatform.Training.Tests
dotnet test   # 190 passed (22 new for US-5.2.2)
```

---

## 5. File Index

### Backend — US-5.2.1 (already merged)

```
Domain/Enums/SessionStatus.cs
Domain/Entities/TrainingPart.cs
Domain/Entities/TrainingSession.cs
Models/Requests/Create|Update|Reorder|Cancel|DuplicateSessionRequest.cs
Models/Responses/TrainingPartDto.cs, TrainingSessionDto.cs, TrainingSessionListItemDto.cs, TrainingSessionDetailDto.cs
Features/Admin/Parts/Commands/{Add,Update,Delete,Reorder}PartCommand.cs
Features/Admin/Parts/Queries/GetPartsForTrainingQuery.cs
Features/Admin/Sessions/RoomConflictDetector.cs
Features/Admin/Sessions/Commands/{Add,Update,Cancel,Duplicate}SessionCommand.cs
Features/Admin/Sessions/Queries/{GetSessions,GetSessionDetail,DetectRoomConflicts}Query.cs
Controllers/AdminTrainingPartsController.cs
Controllers/AdminTrainingSessionsController.cs
Migrations/<timestamp>_AddTrainingPartsAndSessions.cs
```

### Backend — US-5.2.2 (new)

```
Domain/Enums/EnrollmentStatus.cs
Domain/Entities/SessionEnrollment.cs
Models/Requests/EnrollInSessionsRequest.cs
Models/Requests/CancelSessionEnrollmentRequest.cs
Models/Requests/MarkAttendanceRequest.cs
Models/Responses/SessionEnrollmentDto.cs
Models/Responses/EnrollInSessionsResultDto.cs
Models/Responses/AvailableSessionsForEnrollmentDto.cs
Models/Responses/MySessionEnrollmentsDto.cs
Features/Enrollment/Commands/EnrollInSessionsCommand.cs
Features/Enrollment/Commands/CancelSessionEnrollmentCommand.cs
Features/Enrollment/Commands/MarkAttendanceCommand.cs
Features/Enrollment/Queries/GetAvailableSessionsForEnrollmentQuery.cs
Features/Enrollment/Queries/GetMySessionEnrollmentsQuery.cs
Controllers/SessionEnrollmentsController.cs
Migrations/<timestamp>_AddSessionEnrollments.cs
```

### Backend — Modified (US-5.2.2)

```
Infrastructure/Persistence/TrainingDbContext.cs (added SessionEnrollments DbSet + entity config)
```

---

## 6. Frontend — US-5.2.2 (Employee Enrollment UI)

### 6.1 Architecture

The enrollment UI follows the project conventions: types in `types/`, backend DTOs in `types/backend-dtos.ts`, service layer in `services/`, hook in `hooks/`, components in `components/training-detail/session-enrollment/`.

### 6.2 Types

- **Domain types** (`types/index.ts`): `EnrollmentStatus`, `AvailableSession`, `PartWithSessions`, `AvailableSessionsForEnrollment`, `SessionSelection`, `EnrollmentResultItem`, `EnrollInSessionsResult`, `MyPartEnrollment`, `MySessionEnrollments`.
- **Backend DTOs** (`types/backend-dtos.ts`): `BackendAvailableSessionDto`, `BackendPartWithSessionsDto`, `BackendAvailableSessionsForEnrollmentDto`, `BackendEnrollmentResultItemDto`, `BackendEnrollInSessionsResultDto`, `BackendMyPartEnrollmentDto`, `BackendMySessionEnrollmentsDto`.
- **Component Props** (`types/component-props.ts`): `SessionEnrollmentPanelProps`, `SessionPickerPartProps`, `SessionPickerCardProps`, `EnrollmentStatusPanelProps`, `EnrollmentPartRowProps`.

### 6.3 Service Layer (`services/enrollment-service.ts`)

| Function | API Call | Returns |
|----------|----------|---------|
| `getAvailableSessionsForEnrollment(trainingId)` | `GET /training/session-enrollments/available/{id}` | `AvailableSessionsForEnrollment` |
| `enrollInSessions(trainingId, selections)` | `POST /training/session-enrollments` | `EnrollInSessionsResult` |
| `getMySessionEnrollments(trainingId)` | `GET /training/session-enrollments/my/{id}` | `MySessionEnrollments` |
| `cancelSessionEnrollment(sessionId)` | `POST /training/session-enrollments/cancel` | `void` |

Mapper functions convert backend DTOs to domain types. `EnrollmentStatus` mapped from backend string.

### 6.4 Hook (`hooks/use-session-enrollment.ts`)

`useSessionEnrollment(trainingId)` manages:
- Fetches available sessions and current enrollments via `useApiQuery`
- Tracks part→session selections in local state
- `doEnroll` mutation (via `useApiMutation`) with auto-refetch on success
- `doCancel` mutation with auto-refetch and waitlist promotion
- Computed: `allPartsSelected`, `hasActiveEnrollments`, `enrollResult`

### 6.5 Components

| Component | File | Purpose |
|-----------|------|---------|
| `SessionEnrollmentPanel` | `session-enrollment-panel.tsx` | Main orchestrator — shows picker or status view based on enrollment state |
| `SessionPickerPart` | `session-picker-part.tsx` | Collapsible part card with part number, duration, session count, "Selected" badge |
| `SessionPickerCard` | `session-picker-card.tsx` | Individual session slot — date/time, room, trainer, capacity bar, full/waitlist indicator |
| `EnrollmentStatusPanel` | `enrollment-status-panel.tsx` | Progress bar + per-part enrollment rows for enrolled users |
| `EnrollmentPartRow` | `enrollment-part-row.tsx` | Status badge (Enrolled/Waitlisted/Attended/Cancelled) + cancel button per part |
| `EnrollmentResultDialog` | `enrollment-result-dialog.tsx` | Post-enrollment dialog showing confirmed vs waitlisted counts |

### 6.6 UX Flow

1. **Not enrolled** → Employee sees "Choose Your Sessions" with a selection summary strip (`X/Y parts selected`). Each part is a collapsible section showing available time slots as cards with capacity indicators.
2. **Select sessions** → Clicking a card selects it (checkmark + primary border). Full sessions show a "Full" badge with tooltip about waitlisting.
3. **Confirm** → "Confirm Enrollment" button enabled when all parts selected. Shows loading state during API call.
4. **Result dialog** → Shows enrolled count (green) and waitlisted count (amber with position numbers).
5. **Already enrolled** → Shows "My Session Enrollments" with progress bar and per-part rows. Each row shows date/room/trainer + status badge. Cancel button available on Enrolled/Waitlisted parts.
6. **No sessions** → Empty state with icon when no sessions are available.

### 6.7 Integration

`SessionEnrollmentPanel` is rendered in `training-detail-page.tsx` for OnSite trainings, above the existing `OnSiteCoursesList` (course materials). The existing `TrainingEnrollCta` in the sidebar remains for e-learning trainings.

---

## 7. Frontend File Index — US-5.2.2

```
types/index.ts                                              (modified — added enrollment domain types)
types/backend-dtos.ts                                       (modified — added enrollment backend DTOs)
types/component-props.ts                                    (modified — added enrollment component props)
services/enrollment-service.ts                              (new — API calls + mappers)
services/index.ts                                           (modified — barrel export)
hooks/use-session-enrollment.ts                             (new — enrollment state + mutations)
hooks/index.ts                                              (modified — barrel export)
components/training-detail/session-enrollment/index.ts      (new — barrel export)
components/training-detail/session-enrollment/session-enrollment-panel.tsx
components/training-detail/session-enrollment/session-picker-part.tsx
components/training-detail/session-enrollment/session-picker-card.tsx
components/training-detail/session-enrollment/enrollment-status-panel.tsx
components/training-detail/session-enrollment/enrollment-part-row.tsx
components/training-detail/session-enrollment/enrollment-result-dialog.tsx
components/training-detail/index.ts                         (modified — added SessionEnrollmentPanel)
components/index.ts                                         (modified — added SessionEnrollmentPanel)
components/training-detail-page.tsx                         (modified — integrated panel for OnSite)
```

---

## 8. Out of Scope (Deferred)

| Item | Tracked in |
|------|------------|
| Catalog format-tag filter (E-learning / In-person / Hybrid) | US-5.2.3 |
| Participant list export | US-5.2.3 |
| Personal in-person hours dashboard | US-5.2.3 |
| Email notification on session cancellation / waitlist promotion | Future |
| Background job to flip persisted `Status` on time | Future (currently projected at read time) |
