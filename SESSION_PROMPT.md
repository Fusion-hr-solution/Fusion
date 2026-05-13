# New Session Prompt

Use this in a new Copilot chat:

```text
Continue work in D:\Github\Fusion.

Context:
- Backend: .NET Interview service had runtime error:
  Npgsql.PostgresException 42703: column t.AllowBacktracking does not exist.
- Root cause was migration recognition issue: migration existed but Designer file was missing.
- Fixed by adding:
  Backend/EY.HRPlatform.Interview/Migrations/20260512120000_AddTestCandidateViewSettings.Designer.cs
- Migration was then applied in Development:
  dotnet ef database update 20260512120000_AddTestCandidateViewSettings --verbose
- Added columns on Tests table:
  AllowBacktracking, AllowSkipping, RandomizeOrder, ShowProgressBar

What I need now:
1) Verify the Interview API is running against the same DB that was migrated.
2) Reproduce and confirm the previous failing endpoint no longer throws.
3) Run backend tests for Interview and report failures only.
4) Smoke-test frontend candidate flows:
   - Candidate test page behavior respects allowSkipping/allowBacktracking/showProgressBar/randomizeOrder.
   - Bulk invite drag-and-drop CSV flow works.
5) If any mismatch remains, identify exact connection string source (appsettings/env/user-secrets) and fix.

Constraints:
- Do not revert unrelated changes.
- Keep edits minimal and focused.
- Show exact commands used and concise results.
```

Related detailed handoff: `NEXT_SESSION_HANDOFF.md`
