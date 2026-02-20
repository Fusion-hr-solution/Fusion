# EY HR Platform — Fusion

A full-stack **HR Management Platform** built with a .NET microservices backend and a Next.js microfrontend architecture.

---

## Architecture Overview

```
┌──────────────────┐       ┌────────────────────┐       ┌──────────────────────┐
│    Frontend       │ HTTP  │   API Gateway      │ HTTP  │  Backend Services    │
│    (Next.js)      │──────▶│   (YARP) :5000     │──────▶│  Identity   :5101    │
│    :3000          │       │   JWT validation   │       │  Training   :5201    │
│                   │       │   Correlation IDs  │       │  (more coming...)    │
└──────────────────┘       └────────────────────┘       └──────────────────────┘
```

| Layer       | Stack                                                        |
| ----------- | ------------------------------------------------------------ |
| Frontend    | Next.js 15, React 19, TypeScript 5, Tailwind CSS, shadcn/ui |
| Gateway     | ASP.NET + YARP reverse proxy                                |
| Backend     | .NET 10, ASP.NET Web API, PostgreSQL                         |
| Auth        | JWT + Refresh Tokens, ASP.NET Identity, RBAC                 |
| Patterns    | DDD, CQRS (MediatR), Result pattern, Domain Events          |
| Tooling     | Turborepo, pnpm, Husky, Prettier, ESLint, Swagger            |

---

## Repository Structure

```
fusion/
├── Backend/                          → .NET backend monorepo
│   ├── EY.HRPlatform.Gateway/      → YARP API Gateway (JWT, CORS, routing)
│   ├── EY.HRPlatform.Identity/     → Auth & user management microservice
│   ├── EY.HRPlatform.Training/     → Training & courses microservice
│   └── EY.HRPlatform.SharedKernel/ → Shared DDD/CQRS building blocks
│
├── Frontend/                        → Turborepo microfrontend monorepo
│   ├── apps/
│   │   ├── shell/                   → Host app (port 3000)
│   │   ├── interview/               → Interview management (port 3001)
│   │   ├── core/                    → Core platform (port 3002)
│   │   ├── learning/                → Learning & courses (port 3003)
│   │   ├── performance/             → Performance reviews (port 3004)
│   │   ├── recruitment/             → Recruitment & hiring (port 3005)
│   │   └── onboarding/              → New hire onboarding (port 3006)
│   └── packages/
│       ├── ui/                      → Shared UI components (@repo/ui)
│       ├── eslint-config/           → Shared ESLint config
│       └── tsconfig/                → Shared TypeScript config
│
└── README.md                        → This file
```

---

## Backend Services

### API Gateway (`:5000`)

The single entry point for all frontend API calls, built with YARP:

- Reverse-proxies `/api/identity/**` → Identity service
- Reverse-proxies `/api/training/**` → Training service
- Validates JWT tokens on protected routes
- Injects `X-Correlation-Id` headers for distributed tracing
- Configures CORS for the Next.js frontend

### Identity Service (`:5101`)

Full authentication and user management:

| Endpoint                            | Auth          | Description                          |
| ----------------------------------- | ------------- | ------------------------------------ |
| `POST /api/identity/auth/register`  | Public        | Register a new user                  |
| `POST /api/identity/auth/login`     | Public        | Login, returns JWT + refresh token   |
| `POST /api/identity/auth/refresh`   | Public        | Rotate refresh token                 |
| `POST /api/identity/auth/logout`    | Authenticated | Revoke all refresh tokens            |
| `GET  /api/identity/users`          | Admin / HR    | List all active users                |
| `GET  /api/identity/users/{id}`     | Admin / HR    | Get user by ID                       |
| `POST /api/identity/users/{id}/roles/{role}`   | Admin / HR | Assign role        |
| `DELETE /api/identity/users/{id}/roles/{role}` | Admin / HR | Remove role        |

**Roles:** `Admin`, `HR`, `Employee`, `Manager`
**Default seed user:** `admin@ey-hr.com` / `Admin@123456`

### Training Service (`:5201`)

Training & course management (currently scaffolded with stub data):

| Endpoint                          | Auth          | Description                  |
| --------------------------------- | ------------- | ---------------------------- |
| `GET /api/training/courses`       | Authenticated | List all courses             |
| `GET /api/training/courses/{id}`  | Authenticated | Get course by ID             |
| `GET /api/training/courses/me`    | Authenticated | Get current user's enrollments |

### SharedKernel

Cross-cutting DDD building blocks shared by all services:

- **CQRS** — `ICommand` / `IQuery` / handlers via MediatR
- **Domain primitives** — `BaseEntity`, `AggregateRoot`, domain events
- **Value Objects** — Strongly-typed IDs (e.g., `EmployeeId`)
- **Result pattern** — `Result<T>` / `Error` for exception-free operation outcomes
- **Integration events** — `EmployeeCreatedIntegrationEvent`, `EmployeeDeactivatedIntegrationEvent`

---

## Frontend — Microfrontend Architecture

The frontend uses **Turborepo** to orchestrate 7 independent Next.js apps. The `shell` app uses `rewrites()` to proxy each MFE through a unified URL at `http://localhost:3000`:

| Path             | App         | Port |
| ---------------- | ----------- | ---- |
| `/`              | shell       | 3000 |
| `/interview/*`   | interview   | 3001 |
| `/core/*`        | core        | 3002 |
| `/learning/*`    | learning    | 3003 |
| `/performance/*` | performance | 3004 |
| `/recruitment/*` | recruitment | 3005 |
| `/onboarding/*`  | onboarding  | 3006 |

---

## Prerequisites

| Tool     | Version   |
| -------- | --------- |
| Node.js  | >= 18     |
| pnpm     | >= 9.x    |
| .NET SDK | 10.0      |
| PostgreSQL | Latest  |

---

## Getting Started

### 1. Backend

```bash
cd Backend

# Restore and run all services (Gateway + Identity + Training)
dotnet restore
dotnet run --project EY.HRPlatform.Identity
dotnet run --project EY.HRPlatform.Training
dotnet run --project EY.HRPlatform.Gateway
```

> Make sure PostgreSQL is running and the connection string in `Backend/EY.HRPlatform.Identity/appsettings.json` is correct. The Identity service auto-migrates and seeds on startup.

### 2. Frontend

```bash
cd Frontend
pnpm install       # Install all dependencies
pnpm dev           # Start all 7 apps concurrently
```

Access the app at **http://localhost:3000**.

### Useful Commands

| Command                         | Purpose                        |
| ------------------------------- | ------------------------------ |
| `pnpm dev`                      | Start all frontend apps        |
| `pnpm build`                    | Production build               |
| `pnpm lint`                     | Lint all packages              |
| `pnpm type-check`               | TypeScript checks              |
| `pnpm --filter <app> dev`       | Start a single MFE             |

---

## Tech Stack Summary

| Category          | Technology                                            |
| ----------------- | ----------------------------------------------------- |
| **Frontend**      | Next.js 15, React 19, TypeScript 5, Tailwind, shadcn/ui |
| **Backend**       | .NET 10, ASP.NET Core, Entity Framework Core          |
| **Database**      | PostgreSQL                                            |
| **Auth**          | JWT, Refresh Tokens, ASP.NET Identity                 |
| **API Gateway**   | YARP (Yet Another Reverse Proxy)                      |
| **Build System**  | Turborepo, pnpm workspaces                            |
| **Architecture**  | Microservices, Microfrontends, DDD, CQRS              |

---

## License

Proprietary — EY Internal Use Only.
