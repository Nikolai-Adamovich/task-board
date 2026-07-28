# Project Description — Task Board

## 1. Product overview

**Task Board** is a cloud-based, multi-tenant SaaS platform for project management, task tracking, and team
collaboration.

Organizations create isolated workspaces, manage multiple projects, organize work with boards and tasks, collaborate
with team members, and monitor progress via dashboards and reports. Each organization operates in its own secure tenant
with configurable users, roles, permissions, and project-level access control.

The platform targets teams of all sizes and provides a centralized environment for planning, execution, and
collaboration. Its modular architecture allows the product to grow beyond core project management with optional
capabilities such as advanced analytics, reporting, time tracking, knowledge management, and third-party integrations.

**Long-term goal:** become a production-grade, enterprise-ready SaaS platform that demonstrates modern software
architecture, scalable system design, and AI-assisted development workflows.

## 2. Core domain (MVP scope)

Primary entities and capabilities for the initial educational / MVP slice:

| Area              | Capabilities                                                          |
| ----------------- | --------------------------------------------------------------------- |
| **Tenancy**       | Organizations (tenants), isolated data per tenant                     |
| **Users & RBAC**  | Users, roles, permissions at tenant and project level                 |
| **Projects**      | Create / list / manage projects inside a tenant                       |
| **Boards**        | Kanban-style boards with columns (statuses)                           |
| **Tasks**         | Create, assign, move between statuses, backlog                        |
| **Sprints**       | Optional time-boxed containers; move tasks from backlog into a sprint |
| **Collaboration** | Assignees, basic visibility by role                                   |

Out of scope for the first vertical slice (unless explicitly added later): time tracking, advanced analytics, knowledge
base, external integrations, billing.

## 3. Multi-tenancy & access control

- **Multi-tenant:** shared infrastructure, logical data isolation by tenant (`organizationId` / equivalent on every
  relevant document).
- A user may belong to one or more organizations.
- **RBAC** at two levels:
  - Tenant (organization) level — e.g. owner, admin, member
  - Project level — e.g. project admin, developer, viewer
- All API and UI actions must respect the active tenant context and the caller’s roles.

## 4. Architecture overview

Task Board is a **full-stack TypeScript monorepo** with a clear split:

- **Frontend** — Angular application
- **Backend** — Hono API on Cloudflare Workers
- **Shared package** — API contracts, Zod schemas, shared TypeScript types

Style of architecture:

- Multi-tenant SaaS
- Feature-oriented modules (auth, users, projects, boards, tasks, sprints, admin, …)
- Strong end-to-end type safety via the shared package
- Cloud-native deployment (Cloudflare + MongoDB Atlas)

## 5. Technology stack

### Frontend

- Angular 22+
- TypeScript
- Standalone components (no NgModules)
- Zoneless change detection
- Angular Signals
- Signal Forms
- Modern control flow (`@if`, `@for`, `@switch`, `@defer`)
- `inject()` for DI
- Spartan UI
- Tailwind CSS

### Backend

- Hono
- TypeScript
- MongoDB
- Zod (runtime validation)
- Shared API contracts and schemas

### Shared package

- Shared TypeScript types
- Shared API contracts
- Shared Zod validation schemas
- End-to-end type safety between client and server

### Quality assurance

- ESLint, Prettier
- Vitest
- Playwright
- Husky, lint-staged, Commitlint
- Conventional Commits

### Infrastructure

- Cloudflare Pages (frontend)
- Cloudflare Workers (backend)
- Wrangler
- MongoDB Atlas
- GitHub Actions (CI/CD)

## 6. Architectural principles

1. Monorepo with npm workspaces
2. Feature-based project organization
3. Strong TypeScript typing everywhere
4. End-to-end type safety (shared contracts + Zod)
5. Shared validation between client and server
6. Modular and extensible design
7. AI-friendly structure (clear docs and artifacts for development agents)
8. Test-first mindset with automated quality gates
9. Cloud-native deployment pipeline

## 7. Repository layout (target)

task-board/ ├── server/ # Hono backend (Workers) ├── shared/ # types, contracts, Zod schemas ├── ui/ # Angular frontend
├── docs/ │ ├── project_description.md # this file │ └── implementation/ # agent pipeline artifacts
(technical_specification, architecture, plan, status) ├── .roomodes └── ...

Agents should treat docs/implementation/ as the working area for specifications, architecture, plans, and status.
Product source code lives under apps/ and packages/.

## 8. Guidance for development agents

Prefer small, vertical slices (e.g. “auth + tenant context”, “projects CRUD”, “board + tasks + statuses”) over large
horizontal layers. Always respect tenant isolation and RBAC in both API and UI. Keep the shared package as the single
source of truth for types and validation. Do not invent enterprise features (billing, SSO, advanced reporting, etc.)
unless they are explicitly in the current specification. When in doubt, choose the simpler design that still satisfies
the stated acceptance criteria.
