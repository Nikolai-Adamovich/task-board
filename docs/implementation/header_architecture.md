# Header Redesign — Architecture

> **Version:** 1.0.0 · **Date:** 2026-07-31 · **Status:** Draft · **Scope:** Header redesign with user menu, theme
> switcher, zoom controls, search placeholder, notifications placeholder, and help menu.
>
> **Reference:** [Header Technical Specification v1.0.0](header_spec.md) · [System Architecture v4.0.0](architecture.md)

---

## 1. System Context

### 1.1 How the Header Feature Fits Into the Existing Architecture

The header redesign is a **cross-cutting UI feature** that touches all three monorepo packages (`shared/`, `server/`,
`ui/`) but does not introduce a new architectural layer. It extends the existing shell components and adds a new
user-preferences vertical slice.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TASK BOARD APPLICATION                             │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  Angular SPA (zoneless, signals, standalone components)                 │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────┐  ┌──────────────────────────────────┐  │   │
│  │  │  AppShell                   │  │  Existing Stores                 │  │   │
│  │  │  ├── Header ← REWRITE      │  │  ├── AuthStore (auth, user, role)│  │   │
│  │  │  │   ├── Branding           │  │  └── TenantStore (tenants, active│  │   │
│  │  │  │   ├── Search             │  │      tenant)                     │  │   │
│  │  │  │   └── Actions            │  │                                  │  │   │
│  │  │  │       ├── SignInButton    │  │  New Store                       │  │   │
│  │  │  │       ├── UserMenu       │  │  └── PreferencesStore            │  │   │
│  │  │  │       ├── Notifications  │  │      (zoom, theme, language)     │  │   │
│  │  │  │       └── HelpMenu       │  └──────────────────────────────────┘  │  │
│  │  │  ├── Sidebar (existing)     │                                         │  │
│  │  │  └── <router-outlet>        │  New Pages:                            │  │
│  │  │      └── Feature pages      │  ├── /faq (Accordion)                  │  │
│  │  └─────────────────────────────┘  ├── /docs                             │  │
│  │                                    ├── /support                          │  │
│  │  ┌─────────────────────────────┐  └── /settings                         │  │
│  │  │  HTTP Interceptors          │                                         │  │
│  │  │  (auth, tenant, error)      │  New Client:                           │  │
│  │  └─────────────────────────────┘  └── UserPreferencesClient             │  │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                      │
│                              HTTPS (Bearer JWT)                                │
│                                         │                                      │
├─────────────────────────────────────────┼──────────────────────────────────────┤
│                              BACKEND (Hono on Workers)                         │
│  ┌─────────────────────────────────────┼────────────────────────────────────┐  │
│  │  Middleware Pipeline:               │                                    │  │
│  │  ErrorHandler → Auth → RouteHandler │  (no TenantContext or RBAC)        │  │
│  ├─────────────────────────────────────┼────────────────────────────────────┤  │
│  │  New Route:                         │                                    │  │
│  │  /api/v1/users/:id/preferences      │                                    │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │  New Repository: UserPreferencesRepository                               │  │
│  │  New Service: UserPreferencesService                                     │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │  MongoDB Atlas                                                          │  │
│  │  New Collection: user_preferences (indexed on userId)                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Architectural Decisions

| Decision                                                                                    | Rationale                                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Separate `user_preferences` collection (not embedded)                                       | Avoids bloating the `users` document; independent lifecycle; unique index on `userId`      |
| Preferences endpoint does NOT require TenantContext/RBAC                                    | Preferences are user-scoped, not tenant-scoped; only requires auth middleware              |
| `PreferencesStore` injected at root, lazily loads                                           | Theme must apply before first paint (from `localStorage`); zoom restores async after login |
| Header renders on ALL pages (inside `AppShell` for tenant routes, outside for auth/landing) | Ensures consistent branding and search placeholder everywhere                              |
| `/settings` is a new global route (not tenant-scoped)                                       | User preferences are cross-tenant; future settings page can nest tenant-specific settings  |
| `dropdown-menu` and `accordion` Spartan components needed                                   | Not currently installed; required for user menu, help menu, and FAQ page                   |

### 1.3 Middleware Pipeline — User Preferences Routes

The user preferences endpoints use a **stripped-down middleware pipeline** — auth only, no tenant context or RBAC:

```
Request → ErrorHandler → AuthMiddleware → RouteHandler
```

This mirrors the pattern used for `/api/v1/tenants` (tenant list/create) and `/api/v1/invitations` — endpoints that are
user-scoped rather than tenant-scoped. The route handler itself enforces that the authenticated `userId` matches the
`:id` path parameter.

---

## 2. Component Architecture

### 2.1 Component Tree

```
ui-header (REWRITE)
├── ui-header-branding              (NEW)
│   └── <a routerLink="/">
│       ├── lucideLayoutDashboard icon
│       └── "Task Board" text
│
├── ui-header-search                (NEW)
│   ├── lucideSearch icon (left)
│   ├── <input placeholder="Search…">
│   └── lucideX button (right, visible when input non-empty)
│
└── ui-header-actions               (NEW)
    ├── ui-sign-in-button           (NEW, @if !isAuthenticated)
    │   └── <a routerLink="/auth/login">Sign in</a>
    │
    ├── ui-user-menu                (NEW, @if isAuthenticated)
    │   ├── trigger: HlmAvatar + displayName
    │   ├── BrnDropdownMenuContent (Spartan)
    │   │   ├── info block (email, role label, subscription badge)
    │   │   ├── HlmMenuSeparator
    │   │   ├── Language submenu (BrnMenuTriggerSubMenu)
    │   │   │   └── English, Polish, Ukrainian, German, French
    │   │   ├── Themes item → opens ui-theme-sheet
    │   │   ├── Zoom block (ui-user-menu-zoom-controls, inline)
    │   │   ├── HlmMenuSeparator
    │   │   ├── Preferences link → /settings
    │   │   └── Sign out item
    │   │
    │   └── ui-theme-sheet           (NEW, HlmSheet — bottom slide)
    │       ├── "Light" option (role="radio")
    │       └── "Dark" option (role="radio")
    │
    ├── ui-notifications-button     (NEW, @if isAuthenticated)
    │   ├── trigger: lucideBell icon button
    │   └── HlmSheet (right-side slide, offset by --header-height)
    │       └── "No notifications" placeholder
    │
    └── ui-help-menu                (NEW, always visible)
        ├── trigger: lucideCircleHelp icon button
        └── BrnDropdownMenuContent
            ├── FAQ → /faq
            ├── Documentation → /docs
            └── Support → /support
```

### 2.2 Component Details

#### 2.2.1 `Header` (root — REWRITE)

| Property       | Value                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| Selector       | `ui-header`                                                                  |
| File           | [`ui/src/app/shell/header/header.ts`](ui/src/app/shell/header/header.ts)     |
| Template       | [`ui/src/app/shell/header/header.html`](ui/src/app/shell/header/header.html) |
| Responsibility | Layout container with sticky positioning; delegates to child components      |
| Dependencies   | `AuthStore`, `PreferencesStore`                                              |
| Signals        | `isAuthenticated = computed(() => this.authStore.isAuthenticated())`         |

**Template layout:**

```html
<header class="ui-header">
  <ui-header-branding />
  <ui-header-search />
  <ui-header-actions />
</header>
```

The root header applies `position: sticky; top: 0; z-index: 50; height: var(--header-height)` via CSS class `ui-header`.
The sidebar toggle button (`hlmSidebarTrigger`) is **removed**.

#### 2.2.2 `HeaderBranding`

| Property      | Value                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Selector      | `ui-header-branding`                                                                                                       |
| File          | [`ui/src/app/shell/header/header-branding/header-branding.ts`](ui/src/app/shell/header/header-branding/header-branding.ts) |
| Dependencies  | `RouterLink`                                                                                                               |
| Icon          | `lucideLayoutDashboard`                                                                                                    |
| Accessibility | `<a aria-label="Task Board - Home" routerLink="/">`                                                                        |

#### 2.2.3 `HeaderSearch`

| Property      | Value                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Selector      | `ui-header-search`                                                                                                 |
| File          | [`ui/src/app/shell/header/header-search/header-search.ts`](ui/src/app/shell/header/header-search/header-search.ts) |
| State         | `searchValue = signal('')` — local component state only                                                            |
| Responsive    | Hidden on `< md` screens via `hidden md:block`                                                                     |
| Accessibility | `aria-label="Search"` on input; `aria-label="Clear search"` on clear button                                        |

No backend integration — this is a styled placeholder per FR-12.

#### 2.2.4 `HeaderActions`

| Property       | Value                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Selector       | `ui-header-actions`                                                                                                    |
| File           | [`ui/src/app/shell/header/header-actions/header-actions.ts`](ui/src/app/shell/header/header-actions/header-actions.ts) |
| Dependencies   | `AuthStore`                                                                                                            |
| Responsibility | Conditional rendering of SignIn, UserMenu, Notifications, Help based on auth                                           |

```html
<div class="flex items-center gap-2">
  @if (authStore.isAuthenticated()) {
  <ui-user-menu />
  <ui-notifications-button />
  } @else {
  <ui-sign-in-button />
  }
  <ui-help-menu />
</div>
```

#### 2.2.5 `SignInButton`

| Property     | Value                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Selector     | `ui-sign-in-button`                                                                                                    |
| File         | [`ui/src/app/shell/header/sign-in-button/sign-in-button.ts`](ui/src/app/shell/header/sign-in-button/sign-in-button.ts) |
| Dependencies | `RouterLink`, `HlmButtonImports`                                                                                       |
| Text         | "Sign in" (NOT "Login") per FR-16                                                                                      |
| Navigation   | `routerLink="/auth/login"`                                                                                             |

#### 2.2.6 `UserMenu` (most complex sub-component)

| Property       | Value                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Selector       | `ui-user-menu`                                                                                             |
| File           | [`ui/src/app/shell/header/user-menu/user-menu.ts`](ui/src/app/shell/header/user-menu/user-menu.ts)         |
| Dependencies   | `AuthStore`, `TenantStore`, `PreferencesStore`, `BrnDropdownMenu`, `HlmAvatar`, `HlmBadge`, `HlmSeparator` |
| Sub-components | `ui-user-menu-theme-sheet`, `ui-user-menu-zoom-controls`                                                   |

**Signal bindings:**

```typescript
// Read from AuthStore
readonly user = this.authStore.currentUser;          // signal<User | null>
readonly role = this.authStore.tenantRole;           // signal<TenantRole | null>

// Read from TenantStore
readonly subscription = computed(() =>
  this.tenantStore.activeTenant()?.subscription ?? 'free'
);

// Role-derived styling
readonly roleColor = computed(() => getRoleColor(this.role()));
readonly roleLabel = computed(() => {
  const r = this.role();
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : '—';
});

// Initials for avatar fallback
readonly initials = computed(() => {
  const name = this.user()?.displayName ?? '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
});
```

**Dropdown menu items (in order):**

1. **Info block** (non-interactive) — email, role label, subscription badge
2. `HlmMenuSeparator`
3. **Language submenu** — `BrnMenuTriggerSubMenu` → 5 language items (display-only, no switching logic)
4. **Themes** — click opens theme sheet
5. **Zoom controls** — inline component (see 2.2.7)
6. `HlmMenuSeparator`
7. **Preferences** — `routerLink="/settings"`
8. **Sign out** — calls `authStore.logout()`

#### 2.2.7 `UserMenuZoomControls` (inline in dropdown)

| Property     | Value                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Selector     | `ui-user-menu-zoom-controls`                                                                                                                                                   |
| File         | [`ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.ts`](ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.ts) |
| Dependencies | `PreferencesStore`, `HlmButtonImports`                                                                                                                                         |
| State        | Reads `preferencesStore.zoom` signal                                                                                                                                           |

```typescript
protected readonly zoom = this.preferencesStore.zoom;

protected zoomIn(): void {
  this.preferencesStore.setZoom(getNextZoom(this.zoom(), 'in'));
}

protected zoomOut(): void {
  this.preferencesStore.setZoom(getNextZoom(this.zoom(), 'out'));
}
```

**Template:**

```html
<div class="flex items-center gap-2 px-2 py-1.5">
  <span class="text-sm font-medium">Zoom</span>
  <button
    hlmBtn
    variant="outline"
    size="sm"
    (click)="zoomOut()"
    aria-label="Zoom out"
    [disabled]="zoom() === ZOOM_VALUES[0]"
  >
    −
  </button>
  <span class="min-w-[3ch] text-center text-sm" aria-live="polite">{{ zoom() }}%</span>
  <button
    hlmBtn
    variant="outline"
    size="sm"
    (click)="zoomIn()"
    aria-label="Zoom in"
    [disabled]="zoom() === ZOOM_VALUES[ZOOM_VALUES.length - 1]"
  >
    +
  </button>
</div>
```

#### 2.2.8 `UserMenuThemeSheet`

| Property        | Value                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector        | `ui-user-menu-theme-sheet`                                                                                                                                             |
| File            | [`ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.ts`](ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.ts) |
| Dependencies    | `PreferencesStore`, `HlmSheetImports`, `HlmButtonImports`                                                                                                              |
| Sheet direction | Bottom slide-up                                                                                                                                                        |
| Accessibility   | `role="dialog"`, `aria-label="Choose theme"`; options use `role="radio"` in `radiogroup`                                                                               |

**Sheet content:**

```html
<div role="radiogroup" aria-label="Theme">
  <label role="radio" [attr.aria-checked]="theme() === 'light'" (click)="selectTheme('light')">
    <div class="h-6 w-10 rounded bg-white border"></div>
    <span>Light</span>
  </label>
  <label role="radio" [attr.aria-checked]="theme() === 'dark'" (click)="selectTheme('dark')">
    <div class="h-6 w-10 rounded bg-gray-900 border"></div>
    <span>Dark</span>
  </label>
</div>
```

#### 2.2.9 `NotificationsButton`

| Property        | Value                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector        | `ui-notifications-button`                                                                                                                      |
| File            | [`ui/src/app/shell/header/notifications-button/notifications-button.ts`](ui/src/app/shell/header/notifications-button/notifications-button.ts) |
| Dependencies    | `HlmSheetImports`, `HlmButtonImports`, `lucideBell`                                                                                            |
| Sheet direction | Right slide-in                                                                                                                                 |
| Offset          | Sheet positioned at `top: var(--header-height)` via CSS class                                                                                  |
| Content         | "No notifications" placeholder                                                                                                                 |
| Accessibility   | `aria-label="Notifications"`, `aria-haspopup="dialog"`                                                                                         |

#### 2.2.10 `HelpMenu`

| Property      | Value                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Selector      | `ui-help-menu`                                                                                     |
| File          | [`ui/src/app/shell/header/help-menu/help-menu.ts`](ui/src/app/shell/header/help-menu/help-menu.ts) |
| Dependencies  | `BrnDropdownMenu`, `HlmButtonImports`, `lucideCircleHelp`, `RouterLink`                            |
| Visibility    | Always visible (authenticated and unauthenticated)                                                 |
| Accessibility | `aria-haspopup="menu"`, `aria-expanded` toggle                                                     |

**Menu items:**

| Label         | Icon               | Navigation              |
| ------------- | ------------------ | ----------------------- |
| FAQ           | `lucideCircleHelp` | `routerLink="/faq"`     |
| Documentation | `lucideBookOpen`   | `routerLink="/docs"`    |
| Support       | `lucideLifeBuoy`   | `routerLink="/support"` |

---

## 3. State Management

### 3.1 Existing Stores (Referenced, Not Modified)

| Store                                                 | Signals Used by Header                                     |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| [`AuthStore`](ui/src/app/stores/auth-store.ts:22)     | `currentUser`, `isAuthenticated`, `tenantRole`, `logout()` |
| [`TenantStore`](ui/src/app/stores/tenant-store.ts:14) | `activeTenant()?.subscription`                             |

### 3.2 New Store: `PreferencesStore`

| Property     | Value                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| File         | [`ui/src/app/stores/preferences-store.ts`](ui/src/app/stores/preferences-store.ts) |
| Decorator    | `@Service()` (root-level singleton)                                                |
| Dependencies | `HttpClient`, `API_BASE_URL`, `AuthStore`                                          |

**State signals:**

```typescript
readonly zoom = signal<number>(100);
readonly theme = signal<'light' | 'dark'>('light');
readonly language = signal<string>('en');
```

**Public methods:**

| Method                  | Behavior                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `loadPreferences()`     | `GET /api/v1/users/:id/preferences` → sets all signals; falls back to defaults on 404    |
| `setZoom(value)`        | Sets zoom signal → applies CSS → schedules debounced save (5s)                           |
| `setTheme(theme)`       | Sets theme signal → toggles `dark` class → persists to `localStorage` → saves to backend |
| `setLanguage(language)` | Sets language signal (no backend save — placeholder only)                                |

**Private methods:**

| Method                | Behavior                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `applyZoom(value)`    | `document.documentElement.style.setProperty('--zoom', String(value / 100))` |
| `applyTheme(theme)`   | `document.documentElement.classList.toggle('dark', theme === 'dark')`       |
| `scheduleZoomSave()`  | Clears existing timer → sets 5s timeout → calls `saveToBackend({ zoom })`   |
| `saveToBackend(data)` | `PUT /api/v1/users/:id/preferences` with partial data                       |

**Initialization sequence:**

```
AppShell constructor (or effect)
  │
  ├─ 1. Restore theme from localStorage (synchronous, immediate)
  │     └─ preferencesStore.theme.set(localStorage.getItem('taskboard_theme') ?? 'light')
  │     └─ preferencesStore.applyTheme(theme)
  │
  ├─ 2. Apply zoom from localStorage (if available, before backend response)
  │     └─ preferencesStore.applyZoom(savedZoom)
  │
  └─ 3. After auth succeeds → preferencesStore.loadPreferences()
        ├─ GET /api/v1/users/:id/preferences
        ├─ Apply zoom from response (overrides localStorage)
        ├─ Apply theme from response (overrides localStorage)
        └─ Sync localStorage with backend values
```

**Theme persistence strategy (dual-write):**

```
User selects theme
  │
  ├─ 1. localStorage.setItem('taskboard_theme', theme)  ← immediate, survives logout
  ├─ 2. applyTheme(theme)                                ← immediate DOM update
  └─ 3. PUT /api/v1/users/:id/preferences { theme }     ← cross-device sync
```

### 3.3 Store Dependency Graph

```
PreferencesStore
  ├── inject(AuthStore)      → reads userId for API calls
  ├── inject(HttpClient)     → GET/PUT preferences
  └── inject(API_BASE_URL)   → API base path

UserMenu
  ├── inject(AuthStore)      → user, tenantRole, isAuthenticated
  ├── inject(TenantStore)    → activeTenant().subscription
  └── inject(PreferencesStore) → zoom, theme, setZoom(), setTheme()

Header
  ├── inject(AuthStore)      → isAuthenticated
  └── inject(PreferencesStore) → (indirect, via child components)
```

---

## 4. Backend Architecture

### 4.1 New Route: User Preferences

| Property     | Value                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| File         | [`server/src/routes/user-preferences.ts`](server/src/routes/user-preferences.ts)                                   |
| Base path    | `/api/v1/users/:id/preferences`                                                                                    |
| Middleware   | `authMiddleware` only (no `tenantContextMiddleware`, no RBAC)                                                      |
| Registration | In [`server/src/index.ts`](server/src/index.ts:1), registered **after** auth middleware, **before** tenant context |

**Endpoints:**

| Method | Path                            | Auth     | Own-user | Behavior                                                                     |
| ------ | ------------------------------- | -------- | -------- | ---------------------------------------------------------------------------- |
| `GET`  | `/api/v1/users/:id/preferences` | Required | Yes      | Returns preferences or defaults (200)                                        |
| `PUT`  | `/api/v1/users/:id/preferences` | Required | Yes      | Upserts preferences (200); validates body with `UpdateUserPreferencesSchema` |

**Own-user enforcement:** The route handler compares `c.get('userId')` with `c.req.param('id')`. If they don't match,
return `403 Forbidden`.

**Registration in [`server/src/index.ts`](server/src/index.ts:1):**

```typescript
// After: app.use('/api/v1/*', authMiddleware);
// Before: app.use('/api/v1/*', tenantContextMiddleware);

import { createUserPreferencesRoutes } from './routes/user-preferences.js';
app.route('/api/v1/users', createUserPreferencesRoutes());
```

This placement ensures the route passes through `authMiddleware` but NOT `tenantContextMiddleware` or RBAC.

### 4.2 New Service: `UserPreferencesService`

| Property | Value                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------- |
| File     | [`server/src/services/user-preferences.service.ts`](server/src/services/user-preferences.service.ts) |
| Pattern  | Plain TypeScript class (matches existing service pattern)                                            |

```typescript
export class UserPreferencesService {
  constructor(private readonly repo: UserPreferencesRepository) {}

  async getPreferences(userId: string): Promise<UserPreferences> {
    const existing = await this.repo.findByUserId(userId);
    return existing ?? this.getDefaultPreferences(userId);
  }

  async updatePreferences(userId: string, data: UpdateUserPreferences): Promise<UserPreferences> {
    return this.repo.upsert(userId, data);
  }

  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      zoom: 100,
      theme: 'light',
      language: 'en',
      updatedAt: new Date().toISOString(),
    };
  }
}
```

### 4.3 New Repository: `UserPreferencesRepository`

| Property      | Value                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| File          | [`server/src/repositories/user-preferences.repository.ts`](server/src/repositories/user-preferences.repository.ts) |
| Collection    | `user_preferences`                                                                                                 |
| Document type | `UserPreferencesDocument`                                                                                          |
| Index         | `{ userId: 1 }` (unique)                                                                                           |

**Document shape:**

```typescript
export interface UserPreferencesDocument {
  _id?: import('mongodb').ObjectId;
  userId: string; // references users.id
  zoom: number; // 25–500, default 100
  theme: string; // 'light' | 'dark'
  language: string; // 'en', 'pl', 'uk', 'de', 'fr'
  updatedAt: Date;
}
```

**Methods:**

```typescript
export class UserPreferencesRepository {
  constructor(private readonly collection: Collection<UserPreferencesDocument>) {}

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    const doc = await this.collection.findOne({ userId });
    return doc ? toDomain(doc) : null;
  }

  async upsert(userId: string, data: UpdateUserPreferences): Promise<UserPreferences> {
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { userId },
      {
        $set: { ...data, updatedAt: now },
        $setOnInsert: { userId, zoom: 100, theme: 'light', language: 'en' },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return toDomain(result!);
  }
}
```

### 4.4 MongoDB Collection Setup

```typescript
// In server startup or migration:
const db = getDb();
await db.collection('user_preferences').createIndex({ userId: 1 }, { unique: true });
```

The index is on `{ userId: 1 }` with `unique: true` to enforce one-preferences-per-user and enable fast lookups.

---

## 5. Shared Package Changes

### 5.1 New Schema: [`shared/src/schemas/user-preferences.ts`](shared/src/schemas/user-preferences.ts)

```typescript
import { z } from 'zod';

/** User preferences entity schema */
export const UserPreferencesSchema = z.object({
  userId: z.uuid(),
  zoom: z.number().int().min(25).max(500).default(100),
  theme: z.enum(['light', 'dark']).default('light'),
  language: z.string().min(2).max(10).default('en'),
  updatedAt: z.iso.datetime(),
});

/** Inferred UserPreferences type */
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/** Schema for updating user preferences (all fields optional) */
export const UpdateUserPreferencesSchema = z.object({
  zoom: z.number().int().min(25).max(500).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  language: z.string().min(2).max(10).optional(),
});

/** Inferred UpdateUserPreferences type */
export type UpdateUserPreferences = z.infer<typeof UpdateUserPreferencesSchema>;
```

### 5.2 New Contract: [`shared/src/contracts/user-preferences.contracts.ts`](shared/src/contracts/user-preferences.contracts.ts)

```typescript
import { HttpMethod } from '../constants/http.js';
import { UserPreferencesSchema, UpdateUserPreferencesSchema } from '../schemas/user-preferences.js';
import { ErrorResponseSchema } from '../schemas/common.js';

export const userPreferencesContracts = {
  get: {
    method: HttpMethod.GET,
    path: '/users/:id/preferences',
    response: UserPreferencesSchema,
    error: ErrorResponseSchema,
  },
  update: {
    method: HttpMethod.PUT,
    path: '/users/:id/preferences',
    body: UpdateUserPreferencesSchema,
    response: UserPreferencesSchema,
    error: ErrorResponseSchema,
  },
} as const;
```

### 5.3 Modified: [`shared/src/constants/paths.ts`](shared/src/constants/paths.ts:5)

Add `preferences` to the `users` section:

```typescript
users: {
  base: '/users',
  byId: '/users/:id',
  preferences: '/users/:id/preferences',  // NEW
},
```

### 5.4 Modified: [`shared/src/index.ts`](shared/src/index.ts:1)

Add barrel exports:

```typescript
// Schemas
export { UserPreferencesSchema, UpdateUserPreferencesSchema } from './schemas/user-preferences.js';
export type { UserPreferences, UpdateUserPreferences } from './schemas/user-preferences.js';

// Contracts
export { userPreferencesContracts } from './contracts/user-preferences.contracts.js';
```

---

## 6. CSS / Theming Architecture

### 6.1 New CSS Variables

Added to [`:root`](ui/src/styles.css:38) in [`styles.css`](ui/src/styles.css):

```css
:root {
  --header-height: 4rem;
  --zoom: 1;

  /* Role-based avatar/text colors (light theme) */
  --role-owner: oklch(0.65 0.2 145);
  --role-admin: oklch(0.65 0.2 265);
  --role-member: oklch(0.65 0.15 80);
}
```

Added to [`:root.dark`](ui/src/styles.css:70):

```css
:root.dark {
  --header-height: 4rem;

  /* Role-based avatar/text colors (dark theme — slightly brighter) */
  --role-owner: oklch(0.7 0.18 145);
  --role-admin: oklch(0.7 0.18 265);
  --role-member: oklch(0.7 0.13 80);
}
```

### 6.2 Zoom Transform

Applied to `<html>` via CSS:

```css
html {
  transform: scale(var(--zoom, 1));
  transform-origin: 0 0;
}

body {
  width: calc(100vw / var(--zoom, 1));
  min-height: calc(100vh / var(--zoom, 1));
  overflow-x: hidden;
}
```

The `--zoom` CSS variable is set dynamically by `PreferencesStore.applyZoom()`:

```typescript
document.documentElement.style.setProperty('--zoom', String(value / 100));
```

### 6.3 Header Sticky Positioning

```css
.ui-header {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--header-height);
}
```

All layout elements reference `--header-height`:

```css
/* Notification sheet must not cover the header */
.ui-notification-sheet {
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
}

/* Main content area */
main {
  /* AppShell already applies overflow-auto; no change needed */
}
```

### 6.4 Role Color Utility Function

New file: [`ui/src/app/shell/header/role-color.util.ts`](ui/src/app/shell/header/role-color.util.ts)

```typescript
import type { TenantRole } from '@task-board/shared';

export function getRoleColor(role: TenantRole | null): string {
  switch (role) {
    case 'owner':
      return 'var(--role-owner)';
    case 'admin':
      return 'var(--role-admin)';
    case 'member':
      return 'var(--role-member)';
    default:
      return 'var(--border)';
  }
}
```

Used in [`UserMenu`](ui/src/app/shell/header/user-menu/user-menu.ts) for:

- Avatar border: `[style.borderColor]="roleColor()"`
- Display name text: `[style.color]="roleColor()"`

### 6.5 Theme Persistence Flow

```
Page Load
  │
  ├─ 1. Synchronous: read localStorage('taskboard_theme')
  │     └─ applyTheme(value) → toggle 'dark' class on <html>
  │
  ├─ 2. Async: loadPreferences() → GET /api/v1/users/:id/preferences
  │     └─ if backend theme differs → applyTheme(backend.theme) + sync localStorage
  │
  └─ Ongoing: user changes theme
        ├─ localStorage write (immediate)
        ├─ DOM class toggle (immediate)
        └─ PUT backend (immediate, no debounce for theme)
```

---

## 7. Spartan UI Integration

### 7.1 Components to Install

| Component       | Install Command                 | Used By                |
| --------------- | ------------------------------- | ---------------------- |
| `dropdown-menu` | `npx spartan add dropdown-menu` | `UserMenu`, `HelpMenu` |
| `accordion`     | `npx spartan add accordion`     | `Faq` page             |

After installation, both components are available via:

- `BrnDropdownMenuTrigger`, `BrnDropdownMenuContent`, `BrnMenuTriggerSubMenu` (brain layer)
- `HlmDropdownMenuImports` (helm layer)
- `BrnAccordion`, `BrnAccordionItem`, `BrnAccordionContent` (brain layer)
- `HlmAccordionImports` (helm layer)

### 7.2 Existing Components Used

| Component             | Import                       | Used By                                     |
| --------------------- | ---------------------------- | ------------------------------------------- |
| `HlmAvatarImports`    | `@spartan-ng/helm/avatar`    | `UserMenu` (avatar with initials)           |
| `HlmBadgeImports`     | `@spartan-ng/helm/badge`     | `UserMenu` (subscription tier badge)        |
| `HlmButtonImports`    | `@spartan-ng/helm/button`    | All interactive buttons                     |
| `HlmSeparatorImports` | `@spartan-ng/helm/separator` | `UserMenu` (visual dividers)                |
| `HlmSheetImports`     | `@spartan-ng/helm/sheet`     | `UserMenuThemeSheet`, `NotificationsButton` |
| `HlmTooltipImports`   | `@spartan-ng/helm/tooltip`   | Icon buttons (optional)                     |

### 7.3 Spartan Usage Patterns

**Dropdown menu pattern (UserMenu):**

```html
<button [brnMenuTriggerFor]="userMenu" hlmBtn variant="ghost" size="sm">
  <ui-user-avatar [initials]="initials()" [borderColor]="roleColor()" />
  <span class="hidden md:inline" [style.color]="roleColor()">{{ user()?.displayName }}</span>
</button>

<ng-template #userMenu>
  <hlm-menu class="w-64">
    <!-- Info block -->
    <div class="px-3 py-2">
      <p class="text-sm">{{ user()?.email }}</p>
      <p class="text-xs text-muted-foreground">{{ roleLabel() }}</p>
      <hlm-badge>{{ subscription() }}</hlm-badge>
    </div>
    <hlm-menu-separator />

    <!-- Language submenu -->
    <button hlmMenuItem [brnMenuTriggerFor]="langMenu">Language</button>
    <ng-template #langMenu>
      <hlm-menu>
        @for (lang of languages; track lang.code) {
        <button hlmMenuItem (click)="selectLanguage(lang.code)">{{ lang.label }}</button>
        }
      </hlm-menu>
    </ng-template>

    <!-- Themes -->
    <button hlmMenuItem (click)="openThemeSheet()">Themes</button>

    <!-- Zoom controls -->
    <ui-user-menu-zoom-controls />

    <hlm-menu-separator />

    <!-- Preferences -->
    <a hlmMenuItem routerLink="/settings">Preferences</a>

    <!-- Sign out -->
    <button hlmMenuItem (click)="signOut()">Sign out</button>
  </hlm-menu>
</ng-template>
```

**Sheet pattern (Notifications):**

```html
<button hlmBtn variant="ghost" size="icon" (click)="sheetOpen.set(true)" aria-label="Notifications">
  <span class="i-lucide-bell h-5 w-5"></span>
</button>

<hlm-sheet [open]="sheetOpen()" (openChange)="sheetOpen.set($event)" side="right">
  <hlm-sheet-content class="ui-notification-sheet">
    <hlm-sheet-header>
      <h3 hlmSheetTitle>Notifications</h3>
    </hlm-sheet-header>
    <p class="text-muted-foreground text-sm">No notifications</p>
  </hlm-sheet-content>
</hlm-sheet>
```

---

## 8. Route Architecture

### 8.1 New Routes

All new routes are added to [`app.routes.ts`](ui/src/app/app.routes.ts:6).

#### 8.1.1 Help Pages (top-level, public)

These routes render inside the `AppShell` when a tenant context exists, or as standalone pages when accessed directly.
Since the header is global and visible on all pages, these are placed as **top-level routes** that lazy-load the
`AppShell` wrapper.

```typescript
// Top-level help pages (public, render inside AppShell)
{
  path: 'faq',
  loadComponent: () => import('./features/help/faq/faq').then((m) => m.Faq),
},
{
  path: 'docs',
  loadComponent: () => import('./features/help/docs/docs').then((m) => m.Docs),
},
{
  path: 'support',
  loadComponent: () => import('./features/help/support/support').then((m) => m.Support),
},
```

**Decision:** These are top-level routes (not nested under `tenants/:tenantId`) because:

- They are public — no auth required
- They should be accessible from the Help menu on any page
- They don't need tenant context

**Challenge:** The `AppShell` currently wraps the `router-outlet` and is only loaded for tenant-scoped routes. For help
pages to show the header, either:

- **Option A (recommended):** Move `<ui-header />` out of `AppShell` into [`app.html`](ui/src/app/app.html) so it
  renders globally, and `AppShell` only contains sidebar + outlet.
- **Option B:** Create a lighter shell wrapper for public pages that includes the header but not the sidebar.

#### 8.1.2 Settings Page (global, authenticated)

```typescript
// Global settings route (authenticated, no tenant context)
{
  path: 'settings',
  canActivate: [authGuard],
  loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
},
```

**Decision:** `/settings` is a global route (not tenant-scoped) because user preferences are cross-tenant. The
`authGuard` ensures only authenticated users can access it. A future `/settings` page can nest tenant-specific settings
under `/settings/tenant/:tenantId` if needed.

### 8.2 Updated Route Tree

```
/
  (Dashboard)                          ← existing, no guard
/auth
  /login                               ← existing
  /register                            ← existing
  /accept-invitation                   ← existing
/workspace/create                      ← existing, authGuard
/faq                                   ← NEW, public
/docs                                  ← NEW, public
/support                               ← NEW, public
/settings                              ← NEW, authGuard
/tenants/:tenantId                     ← existing, authGuard + tenantGuard
  /projects                            ← existing
  /projects/:projectId                 ← existing, projectGuard
    /boards/:boardId                   ← existing
    /tasks/:taskId                     ← existing
    /sprints                           ← existing
    /sprints/:sprintId                 ← existing
  /settings                            ← existing (tenant settings)
  /settings/members                    ← existing
  /upgrade                             ← existing
**                                     ← wildcard → /
```

### 8.3 Help Page Components

#### 8.3.1 `Faq`

| Property     | Value                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| File         | [`ui/src/app/features/help/faq/faq.ts`](ui/src/app/features/help/faq/faq.ts) |
| Dependencies | `BrnAccordion`, `HlmAccordionImports` (Spartan `accordion` component)        |
| Content      | Static Q&A data (hardcoded array of `{ question, answer }` objects)          |

#### 8.3.2 `Docs`

| Property | Value                                                                            |
| -------- | -------------------------------------------------------------------------------- |
| File     | [`ui/src/app/features/help/docs/docs.ts`](ui/src/app/features/help/docs/docs.ts) |
| Content  | Placeholder documentation page                                                   |

#### 8.3.3 `Support`

| Property | Value                                                                                        |
| -------- | -------------------------------------------------------------------------------------------- |
| File     | [`ui/src/app/features/help/support/support.ts`](ui/src/app/features/help/support/support.ts) |
| Content  | Placeholder contact form (no backend submission)                                             |

---

## 9. Data Flow Diagrams

### 9.1 Theme Switch Flow

```
UserMenu
  │
  ├─ 1. User clicks "Themes" → themeSheetOpen.set(true)
  │
  ├─ 2. ThemeSheet renders (bottom slide-up Sheet)
  │     └─ Shows "Light" and "Dark" options with color swatches
  │
  ├─ 3. User clicks "Dark"
  │     └─ PreferencesStore.setTheme('dark')
  │           ├─ this.theme.set('dark')
  │           ├─ this.applyTheme('dark')
  │           │     └─ document.documentElement.classList.add('dark')
  │           ├─ localStorage.setItem('taskboard_theme', 'dark')
  │           └─ this.saveToBackend({ theme: 'dark' })
  │                 └─ PUT /api/v1/users/:id/preferences { theme: 'dark' }
  │                       └─ UserPreferencesService.updatePreferences()
  │                             └─ UserPreferencesRepository.upsert()
  │                                   └─ MongoDB findOneAndUpdate (upsert)
  │
  ├─ 4. Sheet closes
  │
  └─ 5. On page reload:
        ├─ localStorage('taskboard_theme') → 'dark' → applyTheme('dark') [immediate]
        └─ GET /api/v1/users/:id/preferences → { theme: 'dark' } [async, confirms]
```

### 9.2 Zoom Control Flow

```
UserMenu → ZoomControls
  │
  ├─ 1. User clicks "+" (current: 100%)
  │     └─ PreferencesStore.setZoom(110)
  │           ├─ this.zoom.set(110)
  │           ├─ this.applyZoom(110)
  │           │     └─ document.documentElement.style.setProperty('--zoom', '1.1')
  │           │     └─ CSS: html { transform: scale(1.1) }
  │           │     └─ CSS: body { width: calc(100vw / 1.1) }
  │           └─ this.scheduleZoomSave()
  │                 ├─ clearTimeout(previousTimer)
  │                 └─ setTimeout(5000) →
  │                       this.saveToBackend({ zoom: 110 })
  │                         └─ PUT /api/v1/users/:id/preferences { zoom: 110 }
  │
  ├─ 2. User clicks "+" again (within 5s → timer resets)
  │     └─ PreferencesStore.setZoom(125)
  │           ├─ this.zoom.set(125)
  │           ├─ this.applyZoom(125) → CSS updates immediately
  │           └─ this.scheduleZoomSave() → timer resets to 5s
  │
  ├─ 3. 5 seconds pass with no interaction
  │     └─ PUT /api/v1/users/:id/preferences { zoom: 125 }
  │
  └─ 4. On page reload:
        └─ GET /api/v1/users/:id/preferences → { zoom: 125 }
              └─ applyZoom(125) → page restores at 125%
```

### 9.3 User Menu Open / Info Display Flow

```
Header (authenticated)
  │
  ├─ 1. AuthStore.currentUser() → { id, email, displayName }
  ├─ 2. AuthStore.tenantRole() → 'admin'
  ├─ 3. TenantStore.activeTenant() → { subscription: 'free' }
  │
  ├─ 4. UserMenu computed signals:
  │     ├─ user = AuthStore.currentUser()
  │     ├─ role = AuthStore.tenantRole()
  │     ├─ subscription = TenantStore.activeTenant()?.subscription
  │     ├─ roleColor = getRoleColor(role) → 'var(--role-admin)'
  │     ├─ roleLabel = 'Admin'
  │     └─ initials = 'JD' (from "John Doe")
  │
  ├─ 5. Avatar renders with:
  │     ├─ Initials "JD"
  │     ├─ Border: 2px solid var(--role-admin) [blue]
  │     └─ aria-label="John Doe's avatar"
  │
  ├─ 6. Display name renders:
  │     ├─ Text: "John Doe"
  │     ├─ Color: var(--role-admin) [blue]
  │     └─ Hidden on < md screens
  │
  └─ 7. User clicks avatar → dropdown opens:
        ├─ Info block: "john@example.com", "Admin", [Free] badge
        ├─ Language → submenu (display only)
        ├─ Themes → opens theme sheet
        ├─ Zoom → "−" [100%] "+"
        ├─ Preferences → /settings
        └─ Sign out → authStore.logout()
```

### 9.4 Preferences Load on App Init

```
AppShell (or root component)
  │
  ├─ 1. [Synchronous] Read localStorage('taskboard_theme')
  │     └─ if 'dark' → document.documentElement.classList.add('dark')
  │
  ├─ 2. [Synchronous] Read localStorage('taskboard_zoom') [optional cache]
  │     └─ if present → applyZoom(cachedZoom)
  │
  ├─ 3. [Async] AuthStore.fetchCurrentUser() completes
  │     └─ User is authenticated → userId available
  │
  └─ 4. [Async] PreferencesStore.loadPreferences()
        ├─ GET /api/v1/users/:id/preferences
        │     └─ UserPreferencesService.getPreferences(userId)
        │           └─ UserPreferencesRepository.findByUserId(userId)
        │                 ├─ Found → return { zoom: 125, theme: 'dark', language: 'en' }
        │                 └─ Not found → return defaults { zoom: 100, theme: 'light', language: 'en' }
        │
        ├─ Apply zoom: zoom.set(125) → applyZoom(125)
        ├─ Apply theme: theme.set('dark') → applyTheme('dark')
        ├─ Sync localStorage: 'taskboard_theme' = 'dark'
        └─ language.set('en')
```

---

## 10. File Manifest

### 10.1 Files to Create

| #   | File                                                                                     | Description                                                |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `ui/src/app/shell/header/header-branding/header-branding.ts`                             | Branding component (icon + "Task Board" link)              |
| 2   | `ui/src/app/shell/header/header-branding/header-branding.html`                           | Branding template                                          |
| 3   | `ui/src/app/shell/header/header-search/header-search.ts`                                 | Search placeholder component                               |
| 4   | `ui/src/app/shell/header/header-search/header-search.html`                               | Search template                                            |
| 5   | `ui/src/app/shell/header/header-actions/header-actions.ts`                               | Actions container (auth-conditional rendering)             |
| 6   | `ui/src/app/shell/header/header-actions/header-actions.html`                             | Actions template                                           |
| 7   | `ui/src/app/shell/header/sign-in-button/sign-in-button.ts`                               | Sign-in button (unauthenticated)                           |
| 8   | `ui/src/app/shell/header/sign-in-button/sign-in-button.html`                             | Sign-in button template                                    |
| 9   | `ui/src/app/shell/header/user-menu/user-menu.ts`                                         | User dropdown menu (most complex)                          |
| 10  | `ui/src/app/shell/header/user-menu/user-menu.html`                                       | User menu template                                         |
| 11  | `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.ts`       | Theme selection sheet                                      |
| 12  | `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.html`     | Theme sheet template                                       |
| 13  | `ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.ts`   | Zoom controls (inline in dropdown)                         |
| 14  | `ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.html` | Zoom controls template                                     |
| 15  | `ui/src/app/shell/header/notifications-button/notifications-button.ts`                   | Notification bell + right-side sheet                       |
| 16  | `ui/src/app/shell/header/notifications-button/notifications-button.html`                 | Notifications template                                     |
| 17  | `ui/src/app/shell/header/help-menu/help-menu.ts`                                         | Help dropdown menu                                         |
| 18  | `ui/src/app/shell/header/help-menu/help-menu.html`                                       | Help menu template                                         |
| 19  | `ui/src/app/shell/header/role-color.util.ts`                                             | `getRoleColor()` utility function                          |
| 20  | `ui/src/app/shell/header/zoom.util.ts`                                                   | `ZOOM_VALUES` array + `getNextZoom()` function             |
| 21  | `ui/src/app/stores/preferences-store.ts`                                                 | PreferencesStore (signals, zoom debounce, theme, language) |
| 22  | `ui/src/app/stores/preferences-store.spec.ts`                                            | PreferencesStore unit tests                                |
| 23  | `ui/src/app/services/user-preferences-client.ts`                                         | UserPreferencesClient (HTTP methods for preferences API)   |
| 24  | `ui/src/app/features/help/faq/faq.ts`                                                    | FAQ page component (uses accordion)                        |
| 25  | `ui/src/app/features/help/faq/faq.html`                                                  | FAQ template                                               |
| 26  | `ui/src/app/features/help/docs/docs.ts`                                                  | Documentation page component (placeholder)                 |
| 27  | `ui/src/app/features/help/docs/docs.html`                                                | Documentation template                                     |
| 28  | `ui/src/app/features/help/support/support.ts`                                            | Support page component (placeholder form)                  |
| 29  | `ui/src/app/features/help/support/support.html`                                          | Support template                                           |
| 30  | `ui/src/app/features/settings/settings.ts`                                               | Settings page component (global, authenticated)            |
| 31  | `ui/src/app/features/settings/settings.html`                                             | Settings template                                          |
| 32  | `shared/src/schemas/user-preferences.ts`                                                 | UserPreferences + UpdateUserPreferences Zod schemas        |
| 33  | `shared/src/schemas/user-preferences.spec.ts`                                            | Schema unit tests                                          |
| 34  | `shared/src/contracts/user-preferences.contracts.ts`                                     | API contracts for GET/PUT preferences                      |
| 35  | `server/src/routes/user-preferences.ts`                                                  | Hono route handlers for preferences endpoints              |
| 36  | `server/src/routes/user-preferences.test.ts`                                             | Route tests                                                |
| 37  | `server/src/services/user-preferences.service.ts`                                        | Business logic for preferences                             |
| 38  | `server/src/services/user-preferences.service.test.ts`                                   | Service tests                                              |
| 39  | `server/src/repositories/user-preferences.repository.ts`                                 | MongoDB data access for preferences                        |
| 40  | `server/src/repositories/user-preferences.repository.test.ts`                            | Repository tests                                           |

### 10.2 Files to Modify

| #   | File                                                                                                                                     | Change                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | [`ui/src/app/shell/header/header.ts`](ui/src/app/shell/header/header.ts:1)                                                               | REWRITE — replace sidebar toggle + logout with new component tree |
| 2   | [`ui/src/app/shell/header/header.html`](ui/src/app/shell/header/header.html:1)                                                           | REWRITE — new layout: branding + search + actions                 |
| 3   | [`ui/src/app/app.routes.ts`](ui/src/app/app.routes.ts:6)                                                                                 | Add `/faq`, `/docs`, `/support`, `/settings` routes               |
| 4   | [`ui/src/app/app.html`](ui/src/app/app.html:1)                                                                                           | Add `<ui-header />` for global rendering (if Option A chosen)     |
| 5   | [`ui/src/styles.css`](ui/src/styles.css:38)                                                                                              | Add `--header-height`, `--zoom`, `--role-*` variables; zoom CSS   |
| 6   | [`shared/src/constants/paths.ts`](shared/src/constants/paths.ts:5)                                                                       | Add `preferences` path to `users` section                         |
| 7   | [`shared/src/index.ts`](shared/src/index.ts:1)                                                                                           | Add barrel exports for new schemas + contracts                    |
| 8   | [`server/src/index.ts`](server/src/index.ts:1)                                                                                           | Register user-preferences routes                                  |
| 9   | [`ui/src/app/features/auth/accept-invitation/accept-invitation.html`](ui/src/app/features/auth/accept-invitation/accept-invitation.html) | "Go to Login" → "Go to Sign in"                                   |
| 10  | `ui/src/app/features/auth/login/login.ts`                                                                                                | Error message: "Login failed" → "Sign in failed"                  |
| 11  | `ui/e2e/auth.spec.ts`                                                                                                                    | Test descriptions: "Login" → "Sign in", "Logout" → "Sign out"     |

---

## 11. Dependency Graph

### 11.1 Component → Store Dependencies

```
┌─────────────────────────┐
│        Header            │
│  depends on:             │
│  ├── AuthStore           │
│  └── PreferencesStore    │
└──────┬──────────────────┘
       │
       ├── HeaderBranding
       │   └── (no store deps, uses RouterLink)
       │
       ├── HeaderSearch
       │   └── (local signal only)
       │
       └── HeaderActions
           │
           ├── SignInButton
           │   └── (no store deps, uses RouterLink)
           │
           ├── UserMenu
           │   depends on:
           │   ├── AuthStore        → currentUser, tenantRole
           │   ├── TenantStore      → activeTenant().subscription
           │   └── PreferencesStore → setTheme(), zoom
           │   │
           │   ├── UserMenuThemeSheet
           │   │   └── PreferencesStore → theme, setTheme()
           │   │
           │   └── UserMenuZoomControls
           │       └── PreferencesStore → zoom, setZoom()
           │
           ├── NotificationsButton
           │   └── (no store deps)
           │
           └── HelpMenu
               └── (no store deps, uses RouterLink)
```

### 11.2 Store → Service Dependencies

```
PreferencesStore
  ├── inject(AuthStore)      → reads userId (from currentUser().id)
  ├── inject(HttpClient)     → GET/PUT requests
  └── inject(API_BASE_URL)   → base URL construction

AuthStore (existing, unchanged)
  └── inject(AuthClient)     → login, register, getCurrentUser

TenantStore (existing, unchanged)
  └── inject(TenantClient)   → listTenants, createTenant, etc.
```

### 11.3 Backend Dependency Chain

```
server/src/index.ts
  └── imports createUserPreferencesRoutes from './routes/user-preferences'
        │
        ├── injects UserPreferencesService
        │     └── injects UserPreferencesRepository
        │           └── uses getCollection<UserPreferencesDocument>('user_preferences')
        │
        └── uses authMiddleware (existing)
```

### 11.4 Shared Package Dependency Chain

```
shared/src/schemas/user-preferences.ts
  └── imports z from 'zod'

shared/src/contracts/user-preferences.contracts.ts
  ├── imports UserPreferencesSchema, UpdateUserPreferencesSchema
  ├── imports HttpMethod
  └── imports ErrorResponseSchema

shared/src/constants/paths.ts
  └── (modified to add preferences path)

shared/src/index.ts
  └── re-exports from schemas + contracts
```

---

## 12. Risk Assessment

### 12.1 High-Risk Items

| Risk                                                                             | Impact | Likelihood | Mitigation                                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zoom CSS transform breaks fixed-position elements** (modals, sheets, tooltips) | High   | Medium     | Document as known limitation (BQ-5 resolved). Fixed elements inside `<html>` will scale with zoom. Future fix: move modals to `<body>` level or use `position: fixed` with compensating calculations. |
| **Zoom transform causes horizontal scrollbar**                                   | Medium | Medium     | `body { overflow-x: hidden }` mitigates. Test at extreme zoom values (25%, 500%).                                                                                                                     |
| **`dropdown-menu` Spartan component installation fails or has breaking API**     | High   | Low        | Test installation immediately. Fallback: implement dropdown with native `<details>` + CSS.                                                                                                            |

### 12.2 Medium-Risk Items

| Risk                                                | Impact | Likelihood | Mitigation                                                                                                                                                           |
| --------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Header z-index conflicts with sidebar or sheets** | Medium | Medium     | Header uses `z-index: 50`. Sidebar and sheets use higher z-indexes (Spartan defaults). Test stacking context.                                                        |
| **Theme flicker on page load** (light → dark flash) | Medium | High       | Mitigate by reading `localStorage` synchronously before Angular bootstraps. Add inline `<script>` in `index.html` that sets `dark` class before Angular initializes. |
| **Preferences API latency blocks header render**    | Low    | Low        | Header renders immediately (no blocking HTTP). Preferences load async after auth succeeds.                                                                           |
| **Zoom debounce timer not cleared on logout**       | Low    | Medium     | `PreferencesStore` must clear the debounce timer in a cleanup method called on logout.                                                                               |

### 12.3 Low-Risk Items

| Risk                                         | Impact | Likelihood | Mitigation                                                                |
| -------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------- |
| **Language submenu items are display-only**  | Low    | N/A        | Expected behavior per spec. i18n framework deferred.                      |
| **Notifications sheet has no content**       | Low    | N/A        | Expected behavior per spec. Placeholder "No notifications" is sufficient. |
| **Search placeholder has no backend**        | Low    | N/A        | Expected behavior per spec. Styled input only.                            |
| **`/settings` page content is out of scope** | Low    | N/A        | Route defined but page content deferred. Empty placeholder component.     |

### 12.4 Assumptions

| #    | Assumption                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A-1  | `AuthStore.tenantRole` is always populated when authenticated (decoded from JWT).                                                   |
| A-2  | `TenantStore.activeTenant()?.subscription` is available when the user has at least one tenant.                                      |
| A-3  | Theme persistence uses `localStorage` key `taskboard_theme` as the synchronous source of truth, with backend as async sync.         |
| A-4  | Zoom applies via `transform: scale()` on `<html>` with `transform-origin: 0 0`; body compensating width/min-height avoids clipping. |
| A-5  | Default zoom value is `100` (no transform applied).                                                                                 |
| A-6  | The "Preferences" link navigates to `/settings` (new global route).                                                                 |
| A-7  | FAQ, Documentation, and Support are new lazy-loaded standalone components.                                                          |
| A-8  | The `dropdown-menu` and `accordion` Spartan UI components can be installed via `npx spartan add`.                                   |
| A-9  | The header renders globally on all pages (Option A: header moved to `app.html`).                                                    |
| A-10 | The `user_preferences` collection uses a unique index on `userId` for fast lookups and one-preferences-per-user enforcement.        |

### 12.5 Open Design Decisions

| #   | Decision                                                              | Recommendation                                                 | Rationale                                                          |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| D-1 | Should header be in `app.html` (global) or `AppShell` (tenant-only)?  | **Option A: Global in `app.html`**                             | Header spec requires visibility on ALL pages including auth routes |
| D-2 | Should help pages use a lightweight shell wrapper?                    | **Yes, if Option A is chosen** — no wrapper needed             | Header renders globally; sidebar only in tenant context            |
| D-3 | Should preferences load block the header render?                      | **No** — load async after auth; apply localStorage immediately | NFR-1: header renders within 100ms, no blocking HTTP               |
| D-4 | Should `PreferencesStore` be `providedIn: 'root'` or component-level? | **`providedIn: 'root'` via `@Service()`**                      | Preferences are global; must persist across route navigations      |

---

## Summary

| Item                       | Value                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture file**      | [`docs/implementation/header_architecture.md`](header_architecture.md)                                                                                           |
| **Spec file**              | [`docs/implementation/header_spec.md`](header_spec.md)                                                                                                           |
| **New files**              | 40 files (20 UI components, 2 utils, 1 store, 1 store test, 1 client, 3 help pages, 1 settings page, 2 shared schemas/contracts, 4 server files, 4 server tests) |
| **Modified files**         | 11 files (header rewrite, routes, styles, shared paths/index, server index, renaming)                                                                            |
| **New dependencies**       | `dropdown-menu` and `accordion` Spartan UI components                                                                                                            |
| **New MongoDB collection** | `user_preferences` (unique index on `userId`)                                                                                                                    |
