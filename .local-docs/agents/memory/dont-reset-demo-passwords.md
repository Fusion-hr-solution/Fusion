---
name: dont-reset-demo-passwords
description: Never reset/overwrite demo account passwords in the identity DB — ask the user for the current one
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 487385aa-770d-498f-aa52-1f4f0a73ba79
  modified: 2026-09-02T12:55:12.190Z
---

When a seeded/demo login returns "Invalid credentials", do **not** reset the password (no `UPDATE identity."AspNetUsers" SET "PasswordHash"...`, no copying a hash from another account). The user interrupted exactly that on 2026-09-02 with "dont reset shit, the passwords are the local password (`FUSION_LOCAL_PASSWORD`)".

**Why:** these tenants are hand-seeded demo environments the user drives live; silently rewriting a password hash mutates their demo state and can break their own logins.

**How to apply:** try the known demo password first (the local password (`FUSION_LOCAL_PASSWORD`) for the asteria-demo/tenant10-era users; `Admin@123456` for the platform admin `admin@ey-hr.com`), and if it still fails, **ask the user** for the current credential rather than mutating the DB. See [[local-dev-auth]]. Read-only DB queries for locating demo actors/data are fine; DB writes to auth/identity are not.
