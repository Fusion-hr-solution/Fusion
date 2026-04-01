# Training & Learning Admin — PR Plan

> **3 chained PRs** — each must be merged in order (PR1 → PR2 → PR3).

---

## PR 1: `feat/training-chapter-content-api` → develop

**Title:** feat(training): chapter content view & category/chapter admin API

**Files changed:** 39

### What was done

**Backend — Chapter Content View**

- Added `ChaptersController` with two authorized endpoints:
  - `GET /api/training/my-trainings/{trainingId}/chapters` — returns all chapters with user progress for an enrolled training
  - `GET /api/training/my-trainings/{trainingId}/chapters/{chapterId}` — returns full chapter content (text, video, URI) after validating enrollment
- Added CQRS queries: `GetChaptersWithProgressQuery` and `GetChapterContentQuery` with their handlers
- Extended `TrainingChapter` entity with content fields: `TextContent`, `VideoUrl`, `ContentUri`, `EstimatedDurationMinutes`
- Added `ContentType` enum variants and `TrainingCourse` entity extensions
- Created DB migration `AddChapterContentFields` for the new columns
- Expanded `TrainingSeeder` with rich chapter content data (text lessons, video URLs, estimated durations)
- Added response DTOs: `ChapterContentDto`, `ChapterListItemDto`

**Backend — Category & Chapter Admin CRUD**

- Added `AdminCategoriesController` (Admin/HR only) with full CRUD:
  - `GET /api/training/admin/categories` — list all categories
  - `POST /api/training/admin/categories` — create category
  - `PUT /api/training/admin/categories/{id}` — update category
  - `DELETE /api/training/admin/categories/{id}` — delete category (blocks if trainings exist)
- Added admin commands for chapters: `AddChapter`, `UpdateChapter`, `DeleteChapter` with CQRS handlers
- Added concurrency-safe chapter ordering (auto-assigns `OrderIndex`)
- Added request DTOs: `CreateCategoryRequest`, `UpdateCategoryRequest`, `CreateChapterRequest`, `UpdateChapterRequest`
- Updated `TrainingDbContext` with new entity configurations

**Tests**

- Added 6 unit test classes: `CreateCategoryCommandHandlerTests`, `UpdateCategoryCommandHandlerTests`, `DeleteCategoryCommandHandlerTests`, `AddChapterCommandHandlerTests`, `UpdateChapterCommandHandlerTests`, `DeleteChapterCommandHandlerTests`

---

## PR 2: `feat/training-admin-api` → feat/training-chapter-content-api

**Title:** feat(training): training CRUD, assignments & admin queries + frontend refactoring

**Files changed:** 39

### What was done

**Backend — Training Management API**

- Added `AdminTrainingsController` (Admin/HR only) with endpoints:
  - `GET /api/training/admin/trainings` — paginated list with search, category filter, and soft-delete toggle
  - `GET /api/training/admin/trainings/{id}` — full training detail with chapters and exam info
  - `POST /api/training/admin/trainings` — create training with optional initial chapters
  - `PUT /api/training/admin/trainings/{id}` — update training metadata
  - `DELETE /api/training/admin/trainings/{id}` — soft-delete training
- Added training management commands: `CreateTrainingCommand`, `UpdateTrainingCommand`, `DeleteTrainingCommand` with CQRS handlers
- Added assignment command: `AssignTrainingCommand` — assign a training to employees with a due date
- Added admin queries: `GetAdminTrainingsQuery` (paginated + filterable), `GetAdminTrainingDetailQuery`, `GetTrainingAssignmentsQuery` with handlers
- Added request DTOs: `CreateTrainingRequest`, `UpdateTrainingRequest`, `AssignTrainingRequest`
- Added response DTOs: `AdminTrainingDto`, `AdminTrainingDetailDto`, `AssignmentDto`

**Tests**

- Added 7 unit test classes: `CreateTrainingCommandHandlerTests`, `UpdateTrainingCommandHandlerTests`, `DeleteTrainingCommandHandlerTests`, `AssignTrainingCommandHandlerTests`, `GetAdminTrainingsQueryHandlerTests`, `GetAdminTrainingDetailQueryHandlerTests`, `GetTrainingAssignmentsQueryHandlerTests`

**Frontend — Component Refactoring**

- Extracted component prop interfaces into `types/component-props.ts` for type safety
- Refactored 6 dashboard components (`Dashboard`, `ContinueCard`, `RecommendedCard`, `ProgressRing`, `AchievementsCard`, `CategoryBreakdown`) to use the new typed props
- Refactored 3 training-detail components (`ChapterList`, `ExamSection`, `InstructorCard`) to use typed props
- Updated `badge-config.ts` data module

---

## PR 3: `feat/learning-admin-frontend` → feat/training-admin-api

**Title:** feat(learning): admin training management frontend

**Files changed:** 36

### What was done

**Admin Route Pages**

- `admin/trainings/page.tsx` — training list page
- `admin/trainings/[id]/page.tsx` — training detail page
- `admin/trainings/[id]/edit/page.tsx` — training edit page
- `admin/trainings/new/page.tsx` — create new training page
- `admin/trainings/layout.tsx` — admin trainings layout wrapper
- `admin/assignments/page.tsx` — assignments management page
- `admin/progress/page.tsx` — employee progress page
- `admin/settings/page.tsx` — admin settings page

**Admin Components**

- `TrainingsList` — searchable, filterable, paginated training table with category dropdown and soft-delete toggle
- `TrainingRow` — individual training row with view/edit/delete actions
- `TrainingForm` — multi-step wizard (3 steps: Basic Info → Details → Review) for create/edit
  - `TrainingFormBasicStep` — title, category, badge level fields
  - `TrainingFormDetailsStep` — credits, duration, mandatory flag fields
  - `TrainingFormReviewStep` — summary before submission
- `TrainingDetailView` — full training detail with chapter management
- `ChapterFormDialog` — 2-step dialog for adding/editing chapters
  - `ChapterFormInfoStep` — title, content type, order index
  - `ChapterFormContentStep` — content URI, text content, video URL, estimated duration
- `CategoriesManager` — inline category CRUD with `CategoryForm`
- `AssignmentsView` — assignment management with assign dialog
- `AdminDashboard` — dashboard with `CategoryPerformance`, `CompletionFunnel`, `TopTrainings`, `EmployeeRow`
- `StepIndicator`, `MetaCard`, `SummaryCard` — reusable admin UI primitives

**Service Layer & Types**

- `admin-service.ts` — full API client wrapping all admin endpoints (trainings, chapters, categories, assignments)
- `types/admin.ts` — TypeScript interfaces for admin data (AdminTraining, AdminChapter, AdminTrainingDetail, etc.)
- `types/admin-props.ts` — Component prop interfaces for all admin components

**Tests**

- `admin-service.test.ts` — comprehensive tests for admin service API calls
- `admin-types.test.ts` — type definition validation tests

---

## Branch Dependency Chain

```
develop
  └── feat/training-chapter-content-api   (PR 1 — 39 files)
        └── feat/training-admin-api       (PR 2 — 39 files)
              └── feat/learning-admin-frontend  (PR 3 — 36 files)
```

**Merge order:** PR 1 → PR 2 → PR 3

After PR 1 merges into develop, update PR 2's base branch to develop.
After PR 2 merges into develop, update PR 3's base branch to develop.
