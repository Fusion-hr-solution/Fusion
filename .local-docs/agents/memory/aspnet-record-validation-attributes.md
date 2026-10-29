---
name: aspnet-record-validation-attributes
description: ASP.NET Core 500s every request when a positional record request has [property: MaxLength]-style validation; put the attribute on the parameter
metadata:
  type: project
---

On a positional record used as `[FromBody]`, `[property: MaxLength(…)]` (or Required/EmailAddress with `property:`) makes MVC model validation throw for every request, which Fusion's GlobalExceptionHandler turns into a bare 500 "An unexpected error occurred." Handler/in-memory tests never see it, since they skip model binding. Write `[MaxLength(…)] string Note` (parameter target) instead.

**Why:** found 2026-10-28 (B-144): B-139's change endpoints and the work-email record had shipped with `property:` targets and failed at runtime; the B-128 open-role create failed the same way.

**How to apply:** when adding request records, never use `property:` validation targets; prove a new endpoint with an API journey through the shell, not only handler tests.
