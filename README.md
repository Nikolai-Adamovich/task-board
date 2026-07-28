# Task Board

Multi-tenant SaaS platform for project management, task tracking, and team collaboration.

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Frontend | Angular 22, Spartan UI, Tailwind CSS        |
| Backend  | Hono (Cloudflare Workers), MongoDB          |
| Shared   | Zod v4 schemas, TypeScript contracts        |
| Tooling  | Vitest, Playwright, ESLint, Prettier, Husky |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 24
- [Docker](https://www.docker.com/) (for MongoDB)
- npm (comes with Node.js)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/Nikolai-Adamovich/task-board.git
cd task-board
npm install
```

### 2. Start MongoDB

First time only — create and start the container:

```bash
docker run -d --name task-board-mongo -p 27017:27017 mongo:8
```

On subsequent runs (e.g. after reboot) just restart the existing container:

```bash
docker start task-board-mongo
```

### 3. Configure environment

Create `server/.dev.vars`:

```env
MONGODB_URI=mongodb://localhost:27017/task-board
JWT_SECRET=<your-generated-secret>
```

Generate a random secret for local development:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output as the `JWT_SECRET` value.

### 4. Start the application

Open two terminals:

```bash
# Terminal 1 — Backend API (http://localhost:8787)
npm run dev -w server
```

```bash
# Terminal 2 — Frontend UI (http://localhost:4200)
npm run start -w ui
```

Open **http://localhost:4200** in your browser.

## Development Scripts

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `npm run lint`      | Run ESLint across all workspaces   |
| `npm run lint:fix`  | Auto-fix lint issues               |
| `npm run format`    | Format code with Prettier          |
| `npm run build`     | Build all packages                 |
| `npm run test`      | Run all tests (shared, server, ui) |
| `npm run test:e2e`  | Run Playwright E2E tests           |
| `npm run typecheck` | Type-check shared and server       |

## Project Structure

```
task-board/
├── shared/          # Zod schemas, TypeScript types, API contracts
├── server/          # Hono API (Cloudflare Workers)
│   ├── src/
│   │   ├── middleware/   # Auth, RBAC, validation, error handling
│   │   ├── repositories/ # Data access layer
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   └── types/        # Server-specific types
│   └── .dev.vars         # Local env vars (git-ignored)
├── ui/              # Angular SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── features/   # Feature modules (auth, boards, etc.)
│   │   │   ├── guards/     # Route guards
│   │   │   ├── shell/      # App shell, header, sidebar
│   │   │   └── stores/     # State management
│   │   └── environments/   # Environment configs
│   └── e2e/              # Playwright E2E tests
└── docs/            # Architecture & specifications
```

## License

Private — not licensed for public distribution.
