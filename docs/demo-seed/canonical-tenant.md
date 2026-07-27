# Canonical Fusion Demo Tenant

The repository uses one Development-only tenant as the shared CoreHR and Performance verification baseline.

## Tenant

- Display name: Atlas Group
- Tenant ID: `fa918a81-2147-45e0-934a-9eeec9a4ca14`
- Manifest version: `canonical-fusion-tenant-v1`
- Workforce: 320 employees — 300 active, 20 ended/inactive
- Organization: 8 departments, 32 teams
- Fixed scenario date: 2026-07-01 09:00 UTC

## Credentials

These are development-only demo credentials and must never be reused outside local verification.

| Persona | Login | Password |
| --- | --- | --- |
| Platform administrator | `admin@ey-hr.com` | `Admin@123456` |
| HR administrator | `atlas.hr@atlas.example` | `Demo@123456` |
| Organization administrator | `atlas.orgadmin@atlas.example` | `Demo@123456` |
| Direction | `direction@atlas.example` | `Demo@123456` |
| Manager | `flit.manager@atlas.example` | `Demo@123456` |
| Pending employee | `nour.pending@atlas.example` | `Demo@123456` |
| Draft employee | `yassine.draft@atlas.example` | `Demo@123456` |
| Submitted employee | `meriem.submitted@atlas.example` | `Demo@123456` |
| Manager-review employee | `oussama.review@atlas.example` | `Demo@123456` |
| Finalized employee | `amel.finalized@atlas.example` | `Demo@123456` |
| Acknowledged employee | `hatem.acknowledged@atlas.example` | `Demo@123456` |
| Empty Performance workspace | `empty.employee@atlas.example` | `Demo@123456` |

Named Performance employee IDs:

- Flit manager: `20000000-0000-0000-0000-000000000001`
- Nour: `20000000-0000-0000-0000-000000000101`
- Yassine: `20000000-0000-0000-0000-000000000102`
- Meriem: `20000000-0000-0000-0000-000000000103`
- Oussama: `20000000-0000-0000-0000-000000000104`
- Amel: `20000000-0000-0000-0000-000000000105`
- Hatem: `20000000-0000-0000-0000-000000000106`

## Commands

```powershell
.\scripts\fusion-demo.ps1 up
.\scripts\fusion-demo.ps1 verify
.\scripts\fusion-demo.ps1 down
```

The script reads local database connection strings and JWT secrets from ignored runtime configuration. `up -Fresh` remains intentionally disabled until tenant reset handlers are implemented in all three service owners.

## Surfaces

- Shell: http://localhost:3000
- CoreHR: http://localhost:3002
- Performance: http://localhost:3004
- Gateway: http://localhost:5000
- Identity: http://localhost:5101
- CoreHR API: http://localhost:5301
- Performance API: http://localhost:5401
