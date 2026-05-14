# US-5.2.3 — Learning Module Backend Recap

**Branch:** `feat/learning-us-5.2.3-format-export-hours`
**Scope:** Backend implementation only (Training service). Frontend wiring is in a follow-up.

This user story adds three backend capabilities to the Learning module:

1. **Format-tag filter** in the public training catalogue (E-Learning vs On-Site)
2. **Participant list export** for in-person sessions (Excel + PDF)
3. **Personal in-person hours** dashboard widget for employees

---

## 1. Catalogue — TrainingType filter

### Files modified

- [Backend/EY.HRPlatform.Training/Features/Catalog/Queries/GetAllTrainingsQuery.cs](Backend/EY.HRPlatform.Training/Features/Catalog/Queries/GetAllTrainingsQuery.cs) — added optional `TrainingType?` parameter (default `null`, preserves existing call sites)
- [Backend/EY.HRPlatform.Training/Features/Catalog/Queries/GetAllTrainingsQueryHandler.cs](Backend/EY.HRPlatform.Training/Features/Catalog/Queries/GetAllTrainingsQueryHandler.cs) — added `Where(t => t.TrainingType == request.TrainingType.Value)` clause
- [Backend/EY.HRPlatform.Training/Controllers/CatalogController.cs](Backend/EY.HRPlatform.Training/Controllers/CatalogController.cs) — added `[FromQuery] string? trainingType`; `Enum.TryParse` with `BadRequest` on invalid value (allowed: `ELearning`, `OnSite`)

### Endpoint contract

```
GET /api/training/catalog/trainings?trainingType=ELearning
GET /api/training/catalog/trainings?trainingType=OnSite
```

Combines with existing `categoryId`, `search`, `page`, `pageSize`. Invalid value returns 400 with allowed list.

---

## 2. Session participant export (Excel + PDF)

### New files

- [Backend/EY.HRPlatform.Training/Models/Responses/SessionParticipantExportDto.cs](Backend/EY.HRPlatform.Training/Models/Responses/SessionParticipantExportDto.cs) — `SessionParticipantExportDto` (session metadata + `List<SessionParticipantRowDto>`)
- [Backend/EY.HRPlatform.Training/Features/Admin/Sessions/Queries/GetSessionParticipantsForExportQuery.cs](Backend/EY.HRPlatform.Training/Features/Admin/Sessions/Queries/GetSessionParticipantsForExportQuery.cs) — joins `SessionEnrollment` with `EmployeeProfile` (left join via `DefaultIfEmpty`); excludes `Cancelled`; returns `Result.Failure` if session not found
- [Backend/EY.HRPlatform.Training/Features/Admin/Sessions/Export/ISessionParticipantExporter.cs](Backend/EY.HRPlatform.Training/Features/Admin/Sessions/Export/ISessionParticipantExporter.cs) — interface (`ToExcel`, `ToPdf` returning `byte[]`)
- [Backend/EY.HRPlatform.Training/Features/Admin/Sessions/Export/SessionParticipantExporter.cs](Backend/EY.HRPlatform.Training/Features/Admin/Sessions/Export/SessionParticipantExporter.cs) — concrete implementation (ClosedXML + QuestPDF)

### Files modified

- [Backend/EY.HRPlatform.Training/EY.HRPlatform.Training.csproj](Backend/EY.HRPlatform.Training/EY.HRPlatform.Training.csproj) — added `ClosedXML 0.105.0` (MIT) and `QuestPDF 2026.5.0` (Community license, free for small business)
- [Backend/EY.HRPlatform.Training/Extensions/ServiceCollectionExtensions.cs](Backend/EY.HRPlatform.Training/Extensions/ServiceCollectionExtensions.cs) — registered `ISessionParticipantExporter` as singleton
- [Backend/EY.HRPlatform.Training/Controllers/AdminTrainingSessionsController.cs](Backend/EY.HRPlatform.Training/Controllers/AdminTrainingSessionsController.cs) — added two endpoints + `BuildExportFileName` helper

### Endpoint contracts

```
GET /api/training/admin/sessions/{sessionId:guid}/export/excel  → application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
GET /api/training/admin/sessions/{sessionId:guid}/export/pdf    → application/pdf
```

File name pattern: `participants-{safeTitle}-{StartUtc:yyyyMMdd}.{ext}`.

### Known limitation

`SessionEnrollment` on the `develop` branch does not yet store the participant's display name or email — only `EmployeeId`. The export currently shows `EmployeeId` (and `Grade` / `ServiceLine` from `EmployeeProfile` when available). Identity-service enrichment (or denormalised `EmployeeName` / `EmployeeEmail` columns introduced by a separate migration) is the natural follow-up.

---

## 3. Personal in-person hours widget

### New files

- [Backend/EY.HRPlatform.Training/Models/Responses/MyInPersonHoursDto.cs](Backend/EY.HRPlatform.Training/Models/Responses/MyInPersonHoursDto.cs) — totals (`Year` / `Quarter` / `Month` / `AllTime`), `InPersonHours` + `ELearningHours` for the ratio chart, `List<AttendedSessionItem>` breakdown
- [Backend/EY.HRPlatform.Training/Features/MyTrainings/Queries/GetMyInPersonHoursQuery.cs](Backend/EY.HRPlatform.Training/Features/MyTrainings/Queries/GetMyInPersonHoursQuery.cs) — query handler

### Files modified

- [Backend/EY.HRPlatform.Training/Controllers/MyTrainingsController.cs](Backend/EY.HRPlatform.Training/Controllers/MyTrainingsController.cs) — added `GET in-person-hours` endpoint

### Endpoint contract

```
GET /api/training/my/in-person-hours   (authenticated; uses User.GetUserId())
→ ApiResponse<MyInPersonHoursDto>
```

### Computation rules

- **In-person hours**: only `SessionEnrollment` rows with `Status == Attended`.
- **Hours per session** = `(EndUtc - StartUtc).TotalHours`, rounded to 2 decimals.
- **Time windows** (compared against `Session.StartUtc`):
  - `TotalHoursYear`: ≥ Jan 1 of current year (UTC)
  - `TotalHoursQuarter`: ≥ first day of current quarter (UTC)
  - `TotalHoursMonth`: ≥ first day of current month (UTC)
  - `TotalHoursAllTime`: all attended sessions
- **AttendedSessions**: ordered most-recent first; includes training/part metadata + room.
- **E-learning hours** (for ratio chart): completed e-learning trainings × chapter count × 0.5h.
  - Heuristic chosen to avoid parsing the free-text `TrainingCourse.Duration` field.
  - Easy to swap for a real duration column if/when one is added.

---

## Tests

All new tests live under `Backend/EY.HRPlatform.Training.Tests/` and follow the existing
`TestDbContextFactory.CreateWithSeedDataAsync()` pattern.

| File | Cases | What it covers |
| --- | --- | --- |
| [Handlers/Catalog/CatalogTrainingTypeFilterTests.cs](Backend/EY.HRPlatform.Training.Tests/Handlers/Catalog/CatalogTrainingTypeFilterTests.cs) | 3 | Filter by `ELearning`, by `OnSite`, no filter returns both |
| [Handlers/Admin/Sessions/GetSessionParticipantsForExportQueryHandlerTests.cs](Backend/EY.HRPlatform.Training.Tests/Handlers/Admin/Sessions/GetSessionParticipantsForExportQueryHandlerTests.cs) | 5 | Session metadata; cancelled excluded; grade/service line via profile join; null when no profile; `NotFound` for unknown session |
| [Handlers/Admin/Sessions/SessionParticipantExporterTests.cs](Backend/EY.HRPlatform.Training.Tests/Handlers/Admin/Sessions/SessionParticipantExporterTests.cs) | 4 | Excel returns `PK…` (zip header); PDF returns `%PDF…`; both handle empty participant list |
| [Handlers/MyTrainings/GetMyInPersonHoursQueryHandlerTests.cs](Backend/EY.HRPlatform.Training.Tests/Handlers/MyTrainings/GetMyInPersonHoursQueryHandlerTests.cs) | 5 | Zero-state; sums attended; excludes non-attended; isolation per employee; year/month windowing |

### Run results

```
dotnet test EY.HRPlatform.Training.Tests
→ 207 passed, 0 failed (was 190 before this story; +17 new cases)
```

Backend builds clean with 0 warnings, 0 errors.

---

## Conventions followed

- One query/command per file (record + handler co-located)
- Handlers return `Result<T>`; controllers wrap in `ApiResponse<T>`
- All read queries use `.AsNoTracking()`
- Routes follow `/api/training/...`
- Enums stored as strings (existing `HasConversion<string>()` config is unchanged)
- Pagination unchanged (catalogue still clamps `page` ≥ 1, `pageSize` 1–100)
- No use of `--no-verify` planned for the commit.

---

## Suggested follow-ups (out of scope here)

- Front-end: hook the new endpoints to the catalogue filter chips, the admin session detail "Export" buttons, and the dashboard widget.
- Add `EmployeeName` / `EmployeeEmail` denormalised columns on `SessionEnrollment` so the participant export shows real names without requiring an Identity round-trip.
- Replace the e-learning hours heuristic (chapters × 0.5 h) with a structured `DurationMinutes` field on `TrainingCourse`.
