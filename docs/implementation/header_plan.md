# Header Redesign — Implementation Plan

> **Version:** 1.0.0 · **Date:** 2026-07-31 · **Based on:** [header_spec.md](header_spec.md),
> [header_architecture.md](header_architecture.md)
>
> **Total tasks:** 28 · **Phases:** 7 · **Estimated effort:** ~40 developer-hours

---

## Phase 1: Setup & Dependencies

> Install Spartan UI components, create shared schemas/contracts, and add API path constants. No backend or frontend
> logic yet — just the building blocks.

---

### Task T-H001: Install Spartan UI `dropdown-menu` and `accordion` components

- **Goal:** Add the two missing Spartan UI components required by the header and FAQ page.
- **Affected files/modules:**
  - `ui/components.json` (modified by CLI)
  - `ui/src/libs/ui/` or equivalent Spartan output directory (new generated files)
- **Acceptance criteria:**
  - [ ] `npx spartan add dropdown-menu` succeeds without errors.
  - [ ] `npx spartan add accordion` succeeds without errors.
  - [ ] `BrnDropdownMenuTrigger`, `BrnDropdownMenuContent`, `BrnMenuTriggerSubMenu` are importable.
  - [ ] `BrnAccordion`, `BrnAccordionItem`, `BrnAccordionContent` are importable.
  - [ ] `HlmDropdownMenuImports` and `HlmAccordionImports` are importable.
  - [ ] The Angular app compiles (`ng build`) without errors after installation.
- **Dependencies:** None.

---

### Task T-H002: Create shared `UserPreferences` Zod schemas

- **Goal:** Define the `UserPreferences` and `UpdateUserPreferences` Zod schemas in the shared package.
- **Affected files/modules:**
  - `shared/src/schemas/user-preferences.ts` (create)
  - `shared/src/schemas/user-preferences.spec.ts` (create)
- **Acceptance criteria:**
  - [ ] `UserPreferencesSchema` validates: `userId` (uuid), `zoom` (int 25–500, default 100), `theme` (`'light'` |
        `'dark'`, default `'light'`), `language` (string 2–10 chars, default `'en'`), `updatedAt` (ISO datetime).
  - [ ] `UpdateUserPreferencesSchema` validates: `zoom` (optional int 25–500), `theme` (optional enum), `language`
        (optional string).
  - [ ] `UserPreferences` and `UpdateUserPreferences` types are inferred from schemas.
  - [ ] Unit tests cover valid input, defaults, and boundary/invalid cases.
  - [ ] Tests pass: `cd shared && npm test`.
- **Dependencies:** None.

---

### Task T-H003: Create shared user-preferences API contracts

- **Goal:** Define the API contract for GET/PUT user preferences endpoints.
- **Affected files/modules:**
  - `shared/src/contracts/user-preferences.contracts.ts` (create)
- **Acceptance criteria:**
  - [ ] `userPreferencesContracts.get` defines `GET /users/:id/preferences` with `UserPreferencesSchema` response and
        `ErrorResponseSchema` error.
  - [ ] `userPreferencesContracts.update` defines `PUT /users/:id/preferences` with `UpdateUserPreferencesSchema` body,
        `UserPreferencesSchema` response, and `ErrorResponseSchema` error.
  - [ ] Contract uses `HttpMethod` enum from `shared/src/constants/http.ts`.
  - [ ] No TypeScript compilation errors.
- **Dependencies:** T-H002.

---

### Task T-H004: Add preferences path to shared constants and update barrel exports

- **Goal:** Expose the new preferences path and re-export all new schemas/contracts from the shared barrel file.
- **Affected files/modules:**
  - [`shared/src/constants/paths.ts`](../shared/src/constants/paths.ts) (modify) — add
    `preferences: '/users/:id/preferences'` to `users` section
  - [`shared/src/index.ts`](../shared/src/index.ts) (modify) — add exports for `UserPreferencesSchema`,
    `UpdateUserPreferencesSchema`, `UserPreferences`, `UpdateUserPreferences`, `userPreferencesContracts`
- **Acceptance criteria:**
  - [ ] `ApiPaths.users.preferences` resolves to `'/users/:id/preferences'`.
  - [ ] All new schemas, types, and contracts are accessible via `import { ... } from '@task-board/shared'`.
  - [ ] `cd shared && npm test` passes.
  - [ ] `cd shared && npx tsc --noEmit` passes.
- **Dependencies:** T-H002, T-H003.

---

## Phase 2: Backend

> Implement the user-preferences vertical slice on the server: repository, service, routes, and tests.

---

### Task T-H005: Create `UserPreferencesRepository` with MongoDB collection setup

- **Goal:** Implement the data access layer for user preferences, including the `user_preferences` collection and unique
  index on `userId`.
- **Affected files/modules:**
  - `server/src/repositories/user-preferences.repository.ts` (create)
  - `server/src/repositories/user-preferences.repository.test.ts` (create)
- **Acceptance criteria:**
  - [ ] `UserPreferencesDocument` interface defines: `_id?`, `userId`, `zoom`, `theme`, `language`, `updatedAt`.
  - [ ] `UserPreferencesRepository` class with constructor accepting `Collection<UserPreferencesDocument>`.
  - [ ] `findByUserId(userId)` returns `UserPreferences | null` — maps MongoDB document to domain type.
  - [ ] `upsert(userId, data)` uses `findOneAndUpdate` with `$set` + `$setOnInsert`, returns updated document.
  - [ ] Unique index `{ userId: 1 }` is created (either in repository init or via a setup helper).
  - [ ] `toDomain()` helper converts `UserPreferencesDocument` → `UserPreferences` (strip `_id`, convert `Date` → ISO
        string).
  - [ ] Unit tests cover: find existing, find non-existent (returns null), upsert insert, upsert update.
  - [ ] Tests pass: `cd server && npm test`.
- **Dependencies:** T-H002 (uses `UserPreferences` type from shared).

---

### Task T-H006: Create `UserPreferencesService`

- **Goal:** Implement business logic for reading and updating user preferences with default fallback.
- **Affected files/modules:**
  - `server/src/services/user-preferences.service.ts` (create)
  - `server/src/services/user-preferences.service.test.ts` (create)
- **Acceptance criteria:**
  - [ ] `UserPreferencesService` class with constructor accepting `UserPreferencesRepository`.
  - [ ] `getPreferences(userId)` returns existing preferences or defaults
        (`{ userId, zoom: 100, theme: 'light', language: 'en', updatedAt: <now> }`).
  - [ ] `updatePreferences(userId, data)` delegates to `repo.upsert(userId, data)`.
  - [ ] Unit tests cover: get with existing data, get with no data (returns defaults), update delegates to repo.
  - [ ] Tests pass: `cd server && npm test`.
- **Dependencies:** T-H005.

---

### Task T-H007: Create user-preferences Hono routes

- **Goal:** Implement the GET and PUT endpoints for user preferences with auth-only middleware and own-user enforcement.
- **Affected files/modules:**
  - `server/src/routes/user-preferences.ts` (create)
  - `server/src/routes/user-preferences.test.ts` (create)
- **Acceptance criteria:**
  - [ ] `createUserPreferencesRoutes()` returns a `Hono<AppEnv>` router.
  - [ ] `GET /:id/preferences` — requires auth (`c.get('userId')`), enforces own-user (returns 403 if mismatch), returns
        preferences (200).
  - [ ] `PUT /:id/preferences` — requires auth, enforces own-user, validates body with `UpdateUserPreferencesSchema`,
        upserts and returns updated preferences (200).
  - [ ] Validation errors return 400 with `ErrorResponseSchema` shape.
  - [ ] Unauthorized requests (no userId in context) return 401.
  - [ ] Forbidden requests (userId !== :id) return 403.
  - [ ] Tests pass: `cd server && npm test`.
- **Dependencies:** T-H006, T-H004.

---

### Task T-H008: Register user-preferences routes in server index

- **Goal:** Wire the user-preferences routes into the Hono app at the correct position in the middleware pipeline (after
  auth, before tenant-context).
- **Affected files/modules:**
  - [`server/src/index.ts`](../server/src/index.ts) (modify)
  - [`server/src/routes/index.ts`](../server/src/routes/index.ts) (modify — add to route registry)
- **Acceptance criteria:**
  - [ ] `createUserPreferencesRoutes()` is imported and registered at `app.route('/api/v1/users', ...)`.
  - [ ] The route registration is placed **after** `authMiddleware` and **before** `tenantContextMiddleware` in the
        middleware chain.
  - [ ] `GET /api/v1/users/:id/preferences` returns 200 with preferences when authenticated.
  - [ ] `PUT /api/v1/users/:id/preferences` returns 200 with updated preferences when authenticated.
  - [ ] Existing server tests still pass: `cd server && npm test`.
- **Dependencies:** T-H007.

---

## Phase 3: Frontend Foundation

> Build the `PreferencesStore`, `UserPreferencesClient`, CSS variables, and restructure the global header shell. This
> phase creates the foundation that all header sub-components depend on.

---

### Task T-H009: Create `UserPreferencesClient` HTTP service

- **Goal:** Implement the frontend HTTP client for the user-preferences API.
- **Affected files/modules:**
  - `ui/src/app/services/user-preferences-client.ts` (create)
- **Acceptance criteria:**
  - [ ] `UserPreferencesClient` class using `HttpClient` and `API_BASE_URL` token.
  - [ ] `getPreferences(userId: string)` sends `GET /api/v1/users/:id/preferences`, returns
        `Observable<UserPreferences>`.
  - [ ] `updatePreferences(userId: string, data: UpdateUserPreferences)` sends `PUT /api/v1/users/:id/preferences`,
        returns `Observable<UserPreferences>`.
  - [ ] Uses `ApiPaths.users.preferences` for path construction.
  - [ ] TypeScript compiles without errors.
- **Dependencies:** T-H004.

---

### Task T-H010: Create `PreferencesStore` with signals, debounced zoom save, and dual-write theme persistence

- **Goal:** Implement the root-level singleton store that manages zoom, theme, and language state with backend
  persistence.
- **Affected files/modules:**
  - `ui/src/app/stores/preferences-store.ts` (create)
  - `ui/src/app/stores/preferences-store.spec.ts` (create)
- **Acceptance criteria:**
  - [ ] `PreferencesStore` is decorated with `@Service()` (root-level singleton).
  - [ ] Signals: `zoom` (default 100), `theme` (default `'light'`), `language` (default `'en'`).
  - [ ] `loadPreferences()` calls `GET /api/v1/users/:id/preferences` (via `UserPreferencesClient`), sets all signals,
        applies zoom and theme CSS, syncs `localStorage`.
  - [ ] `setZoom(value)` sets signal, applies CSS `--zoom` variable, schedules 5-second debounced `PUT` save.
  - [ ] `setTheme(theme)` sets signal, toggles `dark` class on `document.documentElement`, writes
        `localStorage('taskboard_theme')`, and immediately `PUT`s to backend.
  - [ ] `setLanguage(language)` sets signal only (no backend save — placeholder).
  - [ ] Zoom debounce timer resets on each call; only the final value is persisted.
  - [ ] `restoreThemeFromLocalStorage()` reads `localStorage('taskboard_theme')` synchronously and applies the class.
  - [ ] Unit tests cover: setZoom signal + CSS update, setTheme signal + class toggle + localStorage, debounce timer
        behavior, loadPreferences sets all signals.
  - [ ] Tests pass: `cd ui && npx ng test --no-watch`.
- **Dependencies:** T-H009, T-H002.

---

### Task T-H011: Add CSS variables and zoom transform styles

- **Goal:** Define the CSS custom properties for header height, zoom, and role-based colors, plus the zoom transform
  CSS.
- **Affected files/modules:**
  - [`ui/src/styles.css`](../ui/src/styles.css) (modify)
- **Acceptance criteria:**
  - [ ] `:root` includes `--header-height: 4rem`, `--zoom: 1`, `--role-owner`, `--role-admin`, `--role-member`
        (light-theme oklch values).
  - [ ] `:root.dark` includes `--header-height: 4rem`, `--role-owner`, `--role-admin`, `--role-member` (dark-theme oklch
        values).
  - [ ] `html` has `transform: scale(var(--zoom, 1))`, `transform-origin: 0 0`.
  - [ ] `body` has `width: calc(100vw / var(--zoom, 1))`, `min-height: calc(100vh / var(--zoom, 1))`,
        `overflow-x: hidden`.
  - [ ] `.ui-header` class:
        `position: sticky; top: 0; z-index: 50; height: var(--header-height); background: var(--background); border-bottom: 1px solid var(--border);`.
  - [ ] `.ui-notification-sheet` class: `top: var(--header-height); height: calc(100vh - var(--header-height));`.
  - [ ] No existing styles are broken (app compiles and renders correctly).
- **Dependencies:** None.

---

### Task T-H012: Create `getRoleColor` and zoom utility functions

- **Goal:** Implement pure utility functions for role-to-color mapping and zoom value navigation.
- **Affected files/modules:**
  - `ui/src/app/shell/header/role-color.util.ts` (create)
  - `ui/src/app/shell/header/zoom.util.ts` (create)
- **Acceptance criteria:**
  - [ ] `getRoleColor(role: TenantRole | null): string` maps `owner` → `var(--role-owner)`, `admin` →
        `var(--role-admin)`, `member` → `var(--role-member)`, `null` → `var(--border)`.
  - [ ] `ZOOM_VALUES` constant: `[25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500]`.
  - [ ] `getNextZoom(current: number, direction: 'in' | 'out'): number` navigates the array, clamping at boundaries,
        returning 100 as fallback for unknown values.
  - [ ] TypeScript compiles without errors.
- **Dependencies:** None.

---

### Task T-H013: Restructure global header — move `<ui-header />` to `app.html`, strip sidebar from AppShell

- **Goal:** Make the header render globally on all pages (authenticated and unauthenticated) by moving it from
  `AppShell` into the root `app.html`.
- **Affected files/modules:**
  - [`ui/src/app/app.html`](../ui/src/app/app.html) (modify) — add `<ui-header />` above `<router-outlet />`
  - [`ui/src/app/app.ts`](../ui/src/app/app.ts) (modify) — import `Header` component
  - [`ui/src/app/shell/app-shell/app-shell.html`](../ui/src/app/shell/app-shell/app-shell.html) (modify) — remove
    `<ui-header />`, keep sidebar + main + outlet
  - [`ui/src/app/shell/app-shell/app-shell.ts`](../ui/src/app/shell/app-shell/app-shell.ts) (modify) — remove `Header`
    import
- **Acceptance criteria:**
  - [ ] `app.html` renders `<ui-header />` followed by `<router-outlet />`.
  - [ ] `app.ts` imports the `Header` component.
  - [ ] `AppShell` no longer imports or renders `<ui-header />` — it only renders `<ui-sidebar>` wrapping
        `<main><router-outlet /></main>`.
  - [ ] Header is visible on unauthenticated pages (login, register, landing).
  - [ ] Header is visible on authenticated pages (dashboard, projects, boards).
  - [ ] Sidebar still functions correctly within tenant-scoped routes.
  - [ ] `ng build` succeeds without errors.
- **Dependencies:** T-H011 (CSS variables must exist for header styling to work).

---

## Phase 4: Header Components

> Build each header sub-component top-down, starting from the container and working into the leaf components. Each
> component is standalone and testable.

---

### Task T-H014: Create `HeaderBranding` component

- **Goal:** Implement the left section of the header with the app icon and "Task Board" text linking to home.
- **Affected files/modules:**
  - `ui/src/app/shell/header/header-branding/header-branding.ts` (create)
  - `ui/src/app/shell/header/header-branding/header-branding.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-header-branding`.
  - [ ] Renders `<a routerLink="/" aria-label="Task Board - Home">` with `lucideLayoutDashboard` icon + "Task Board"
        text.
  - [ ] Uses `@ng-icons/lucide` for the icon.
  - [ ] Uses `RouterLink` for SPA navigation (no full page reload).
  - [ ] TypeScript compiles without errors.
- **Dependencies:** None.

---

### Task T-H015: Create `HeaderSearch` component

- **Goal:** Implement the center search placeholder with icon, input, and conditional clear button.
- **Affected files/modules:**
  - `ui/src/app/shell/header/header-search/header-search.ts` (create)
  - `ui/src/app/shell/header/header-search/header-search.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-header-search`.
  - [ ] Local signal: `searchValue = signal('')`.
  - [ ] Renders `lucideSearch` icon on the left of the input.
  - [ ] Input has `placeholder="Search…"` and `aria-label="Search"`.
  - [ ] When `searchValue()` is non-empty, a clear button (`lucideX`, `aria-label="Clear search"`) appears; clicking it
        resets the signal.
  - [ ] Hidden on screens < 768px via Tailwind `hidden md:block` (or equivalent).
  - [ ] No backend logic — purely UI placeholder.
- **Dependencies:** None.

---

### Task T-H016: Create `SignInButton` component

- **Goal:** Implement the "Sign in" button visible when the user is not authenticated.
- **Affected files/modules:**
  - `ui/src/app/shell/header/sign-in-button/sign-in-button.ts` (create)
  - `ui/src/app/shell/header/sign-in-button/sign-in-button.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-sign-in-button`.
  - [ ] Renders a button/link with text "Sign in" (NOT "Login") and `routerLink="/auth/login"`.
  - [ ] Uses `HlmButtonImports` for styling.
  - [ ] TypeScript compiles without errors.
- **Dependencies:** None.

---

### Task T-H017: Create `UserMenuZoomControls` component

- **Goal:** Implement the inline zoom controls (−, percentage, +) that render inside the user dropdown menu.
- **Affected files/modules:**
  - `ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.ts` (create)
  - `ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-user-menu-zoom-controls`.
  - [ ] Injects `PreferencesStore` to read `zoom` signal and call `setZoom()`.
  - [ ] Uses `getNextZoom()` from `zoom.util.ts`.
  - [ ] "−" button: calls `setZoom(getNextZoom(zoom(), 'out'))`, disabled when zoom is at minimum (25).
  - [ ] "+" button: calls `setZoom(getNextZoom(zoom(), 'in'))`, disabled when zoom is at maximum (500).
  - [ ] Percentage display: `{{ zoom() }}%` with `aria-live="polite"`.
  - [ ] Buttons have `aria-label="Zoom out"` / `aria-label="Zoom in"`.
  - [ ] Uses `HlmButtonImports` for button styling.
- **Dependencies:** T-H010 (PreferencesStore), T-H012 (zoom util).

---

### Task T-H018: Create `UserMenuThemeSheet` component

- **Goal:** Implement the bottom-sliding sheet for theme selection (Light/Dark) with color swatches.
- **Affected files/modules:**
  - `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.ts` (create)
  - `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-user-menu-theme-sheet`.
  - [ ] Accepts `@Input({ required: true }) open: boolean` signal and emits `openChange` output.
  - [ ] Uses Spartan `HlmSheetImports` with `side="bottom"`.
  - [ ] Sheet has `role="dialog"` and `aria-label="Choose theme"`.
  - [ ] Renders two options in a `radiogroup`: "Light" (white swatch) and "Dark" (dark swatch).
  - [ ] Each option has `role="radio"` and `[attr.aria-checked]` bound to current theme.
  - [ ] Selecting a theme calls `preferencesStore.setTheme(value)` and closes the sheet.
  - [ ] Current theme is read from `PreferencesStore.theme` signal.
- **Dependencies:** T-H010 (PreferencesStore).

---

### Task T-H019: Create `UserMenu` component (dropdown menu)

- **Goal:** Implement the authenticated user menu — avatar with role-colored border, dropdown with info block, language
  submenu, themes, zoom, preferences, and sign out.
- **Affected files/modules:**
  - `ui/src/app/shell/header/user-menu/user-menu.ts` (create)
  - `ui/src/app/shell/header/user-menu/user-menu.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-user-menu`.
  - [ ] Injects `AuthStore`, `TenantStore`, `PreferencesStore`.
  - [ ] Computed signals: `user`, `role`, `subscription`, `roleColor`, `roleLabel`, `initials`.
  - [ ] Avatar uses `HlmAvatarImports` with initials fallback and 2px border colored by `roleColor()`.
  - [ ] Display name shown next to avatar, hidden on `< md` screens, text color matches `roleColor()`.
  - [ ] Dropdown (`BrnDropdownMenu`) contains in order:
    1. Info block: email, role label, subscription badge (`HlmBadgeImports`).
    2. Separator.
    3. Language submenu (`BrnMenuTriggerSubMenu`) with 5 languages: English, Polish, Ukrainian, German, French
       (display-only).
    4. "Themes" item → opens theme sheet.
    5. Zoom controls (`<ui-user-menu-zoom-controls />`).
    6. Separator.
    7. "Preferences" link → `routerLink="/settings"`.
    8. "Sign out" item → calls `authStore.logout()`.
  - [ ] Theme sheet (`<ui-user-menu-theme-sheet />`) is rendered with open state controlled by a local signal.
  - [ ] Avatar has `role="img"` and `aria-label="<displayName>'s avatar"`.
  - [ ] Trigger has `aria-haspopup="menu"` and `aria-expanded` toggle.
- **Dependencies:** T-H010 (PreferencesStore), T-H012 (role-color util), T-H017 (zoom controls), T-H018 (theme sheet).

---

### Task T-H020: Create `NotificationsButton` component

- **Goal:** Implement the bell icon button that opens a right-side sheet with placeholder content.
- **Affected files/modules:**
  - `ui/src/app/shell/header/notifications-button/notifications-button.ts` (create)
  - `ui/src/app/shell/header/notifications-button/notifications-button.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-notifications-button`.
  - [ ] Renders a ghost icon button with `lucideBell` and `aria-label="Notifications"`.
  - [ ] Clicking toggles a local `sheetOpen` signal.
  - [ ] Uses Spartan `HlmSheetImports` with `side="right"`.
  - [ ] Sheet content has class `ui-notification-sheet` (offset by `--header-height`).
  - [ ] Sheet displays "Notifications" title and "No notifications" placeholder text.
  - [ ] Trigger has `aria-haspopup="dialog"`.
- **Dependencies:** T-H011 (CSS classes).

---

### Task T-H021: Create `HelpMenu` component

- **Goal:** Implement the "?" dropdown menu with FAQ, Documentation, and Support links.
- **Affected files/modules:**
  - `ui/src/app/shell/header/help-menu/help-menu.ts` (create)
  - `ui/src/app/shell/header/help-menu/help-menu.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-help-menu`.
  - [ ] Renders a ghost icon button with `lucideCircleHelp` and `aria-label="Help"`.
  - [ ] Dropdown (`BrnDropdownMenu`) with three items:
    1. FAQ — `lucideCircleHelp` icon, `routerLink="/faq"`.
    2. Documentation — `lucideBookOpen` icon, `routerLink="/docs"`.
    3. Support — `lucideLifeBuoy` icon, `routerLink="/support"`.
  - [ ] Always visible (both authenticated and unauthenticated).
  - [ ] Trigger has `aria-haspopup="menu"` and `aria-expanded` toggle.
- **Dependencies:** T-H001 (Spartan dropdown-menu installed).

---

### Task T-H022: Create `HeaderActions` container component

- **Goal:** Implement the right-side actions container that conditionally renders Sign In, User Menu, Notifications, and
  Help based on auth state.
- **Affected files/modules:**
  - `ui/src/app/shell/header/header-actions/header-actions.ts` (create)
  - `ui/src/app/shell/header/header-actions/header-actions.html` (create)
- **Acceptance criteria:**
  - [ ] Selector: `ui-header-actions`.
  - [ ] Injects `AuthStore`.
  - [ ] Template:
        `@if (authStore.isAuthenticated()) { <ui-user-menu /> <ui-notifications-button /> } @else { <ui-sign-in-button /> } <ui-help-menu />`.
  - [ ] All child components are imported as standalone imports.
  - [ ] Layout uses `flex items-center gap-2`.
- **Dependencies:** T-H016 (SignInButton), T-H019 (UserMenu), T-H020 (NotificationsButton), T-H021 (HelpMenu).

---

### Task T-H023: Rewrite root `Header` component

- **Goal:** Replace the current header (sidebar toggle + display name + logout) with the new component tree (branding +
  search + actions).
- **Affected files/modules:**
  - [`ui/src/app/shell/header/header.ts`](../ui/src/app/shell/header/header.ts) (rewrite)
  - [`ui/src/app/shell/header/header.html`](../ui/src/app/shell/header/header.html) (rewrite)
- **Acceptance criteria:**
  - [ ] `header.ts` imports: `HeaderBranding`, `HeaderSearch`, `HeaderActions`. Removes `HlmSidebarImports` and the
        `logout()` method.
  - [ ] `header.html` renders:
        `<header class="ui-header"><ui-header-branding /><ui-header-search /><ui-header-actions /></header>`.
  - [ ] Sidebar trigger button (`hlmSidebarTrigger`) is removed.
  - [ ] Old "Logout" button is removed.
  - [ ] Header uses the `.ui-header` CSS class (sticky, z-index 50, header-height).
  - [ ] `ng build` succeeds.
- **Dependencies:** T-H013 (global header restructure), T-H014 (Branding), T-H015 (Search), T-H022 (Actions).

---

## Phase 5: Help Pages & Settings

> Create the new page-level components and routes for FAQ, Documentation, Support, and Settings.

---

### Task T-H024: Create `Faq` page component with accordion

- **Goal:** Implement the FAQ page with a static list of questions and answers using the Spartan accordion component.
- **Affected files/modules:**
  - `ui/src/app/features/help/faq/faq.ts` (create)
  - `ui/src/app/features/help/faq/faq.html` (create)
- **Acceptance criteria:**
  - [ ] Standalone component with selector `ui-faq` (or route-level component).
  - [ ] Uses `BrnAccordion`, `HlmAccordionImports` from Spartan.
  - [ ] Contains a hardcoded array of at least 5 `{ question: string, answer: string }` objects.
  - [ ] Renders each Q&A as an accordion item.
  - [ ] Page has a heading "Frequently Asked Questions".
  - [ ] TypeScript compiles without errors.
- **Dependencies:** T-H001 (Spartan accordion installed).

---

### Task T-H025: Create `Docs` and `Support` page components

- **Goal:** Implement placeholder pages for Documentation and Support.
- **Affected files/modules:**
  - `ui/src/app/features/help/docs/docs.ts` (create)
  - `ui/src/app/features/help/docs/docs.html` (create)
  - `ui/src/app/features/help/support/support.ts` (create)
  - `ui/src/app/features/help/support/support.html` (create)
- **Acceptance criteria:**
  - [ ] `Docs` component: standalone, renders a heading "Documentation" and placeholder content.
  - [ ] `Support` component: standalone, renders a heading "Support" and a placeholder contact form (name, email,
        message fields — no backend submission).
  - [ ] Both components use Spartan `HlmCardImports` or `HlmButtonImports` for basic styling.
  - [ ] TypeScript compiles without errors.
- **Dependencies:** None.

---

### Task T-H026: Create `Settings` page and add all new routes to `app.routes.ts`

- **Goal:** Implement the global settings page (placeholder) and register all new routes (`/faq`, `/docs`, `/support`,
  `/settings`).
- **Affected files/modules:**
  - `ui/src/app/features/settings/settings.ts` (create)
  - `ui/src/app/features/settings/settings.html` (create)
  - [`ui/src/app/app.routes.ts`](../ui/src/app/app.routes.ts) (modify)
- **Acceptance criteria:**
  - [ ] `Settings` component: standalone, renders a heading "Settings" and placeholder content (future preferences
        page).
  - [ ] Route `/faq` added as top-level lazy-loaded route → `Faq` component.
  - [ ] Route `/docs` added as top-level lazy-loaded route → `Docs` component.
  - [ ] Route `/support` added as top-level lazy-loaded route → `Support` component.
  - [ ] Route `/settings` added as top-level lazy-loaded route with `canActivate: [authGuard]` → `Settings` component.
  - [ ] All routes use `loadComponent` for lazy loading.
  - [ ] Help pages are public (no guard); settings requires auth.
  - [ ] Existing routes are not broken.
  - [ ] `ng build` succeeds.
- **Dependencies:** T-H024, T-H025.

---

## Phase 6: Renaming & Polish

> Rename user-visible "Login" → "Sign in" and "Logout" → "Sign out" text throughout the app. Update E2E test
> descriptions.

---

### Task T-H027: Rename "Login" → "Sign in" and "Logout" → "Sign out" across the app

- **Goal:** Update all user-visible text to use "Sign in" / "Sign out" terminology. Internal identifiers and route paths
  remain unchanged.
- **Affected files/modules:**
  - [`ui/src/app/features/auth/accept-invitation/accept-invitation.html`](../ui/src/app/features/auth/accept-invitation/accept-invitation.html)
    (modify) — "Go to Login" → "Go to Sign in"
  - [`ui/src/app/features/auth/login/login.ts`](../ui/src/app/features/auth/login/login.ts) (modify) — error message
    "Login failed" → "Sign in failed"
  - `ui/e2e/auth.spec.ts` (modify) — test descriptions: "Login" → "Sign in", "Logout" → "Sign out"
- **Acceptance criteria:**
  - [ ] All user-visible "Login" text is replaced with "Sign in".
  - [ ] All user-visible "Logout" text is replaced with "Sign out".
  - [ ] Route path `/auth/login` remains unchanged.
  - [ ] Method names `login()`, `logout()` on `AuthStore` remain unchanged.
  - [ ] Type names `LoginRequest`, `LoginRequestSchema` remain unchanged.
  - [ ] E2E test descriptions updated to match new terminology.
  - [ ] `ng build` succeeds.
  - [ ] E2E tests pass: `cd ui && npx playwright test`.
- **Dependencies:** T-H023 (header rewrite — old logout button already removed).

---

## Phase 7: Integration & Testing

> Wire everything together, verify the full user journey, and run all test suites.

---

### Task T-H028: Wire PreferencesStore initialization and run full verification

- **Goal:** Ensure `PreferencesStore` initializes correctly on app load (theme from localStorage, preferences from
  backend after auth), and verify the complete header feature end-to-end.
- **Affected files/modules:**
  - [`ui/src/app/shell/app-shell/app-shell.ts`](../ui/src/app/shell/app-shell/app-shell.ts) (modify — inject
    `PreferencesStore`, trigger `restoreThemeFromLocalStorage()` on init, trigger `loadPreferences()` after auth)
  - `ui/src/app/stores/preferences-store.ts` (may need minor adjustments)
- **Acceptance criteria:**
  - [ ] `PreferencesStore.restoreThemeFromLocalStorage()` is called synchronously on `AppShell` construction (or in an
        `effect`/`afterNextRender`).
  - [ ] `PreferencesStore.loadPreferences()` is called after `AuthStore` signals authentication success.
  - [ ] Theme persists across page reloads (from localStorage immediately, confirmed by backend).
  - [ ] Zoom persists across page reloads (from backend).
  - [ ] Zoom debounce works — rapid clicks only result in one `PUT` after 5 seconds of inactivity.
  - [ ] All header sub-components render correctly in their final positions.
  - [ ] Header is visible on unauthenticated pages (login, register).
  - [ ] Header is visible on authenticated pages (dashboard, projects, boards).
  - [ ] All server tests pass: `cd server && npm test`.
  - [ ] All shared tests pass: `cd shared && npm test`.
  - [ ] All UI unit tests pass: `cd ui && npx ng test --no-watch`.
  - [ ] All E2E tests pass: `cd ui && npx playwright test`.
  - [ ] `ng build` succeeds with no errors or warnings.
- **Dependencies:** T-H010 (PreferencesStore), T-H013 (global header), T-H023 (header rewrite), T-H026 (routes), T-H027
  (renaming).

---

## Dependency Summary

```
Phase 1 (Setup)
  T-H001 ──────────────────────────────────────────────────────────┐
  T-H002 ──┬──► T-H003 ──┬──► T-H004 ────────────────────┐       │
            │              │                               │       │
Phase 2 (Backend)          │                               │       │
  T-H005 ◄─┘              │                               │       │
  T-H006 ◄── T-H005       │                               │       │
  T-H007 ◄── T-H006, T-H004                               │       │
  T-H008 ◄── T-H007       │                               │       │
                           │                               │       │
Phase 3 (Frontend Foundation)                              │       │
  T-H009 ◄────────────────┘                               │       │
  T-H010 ◄── T-H009, T-H002                               │       │
  T-H011 ──────────────────────────────────────────────────┤       │
  T-H012 ──────────────────────────────────────────────────┤       │
  T-H013 ◄── T-H011                                       │       │
                                                            │       │
Phase 4 (Header Components)                                 │       │
  T-H014 ──────────────────────────────────────────────────┤       │
  T-H015 ──────────────────────────────────────────────────┤       │
  T-H016 ──────────────────────────────────────────────────┤       │
  T-H017 ◄── T-H010, T-H012                               │       │
  T-H018 ◄── T-H010                                       │       │
  T-H019 ◄── T-H010, T-H012, T-H017, T-H018              │       │
  T-H020 ◄── T-H011                                       │       │
  T-H021 ◄── T-H001 ◄─────────────────────────────────────┘       │
  T-H022 ◄── T-H016, T-H019, T-H020, T-H021                     │
  T-H023 ◄── T-H013, T-H014, T-H015, T-H022                     │
                                                                    │
Phase 5 (Help Pages & Settings)                                     │
  T-H024 ◄── T-H001 ◄─────────────────────────────────────────────┘
  T-H025 ──────────────────────────────────────────────────┐       │
  T-H026 ◄── T-H024, T-H025                               │       │
                                                            │       │
Phase 6 (Renaming)                                            │       │
  T-H027 ◄── T-H023                                         │       │
                                                                │       │
Phase 7 (Integration)                                           │       │
  T-H028 ◄── T-H010, T-H013, T-H023, T-H026, T-H027           │       │
```

## Parallel Execution Opportunities

Tasks that can be developed **simultaneously** by different developers:

| Wave | Tasks (can run in parallel)                            |
| ---- | ------------------------------------------------------ |
| 1    | T-H001, T-H002, T-H011, T-H012                         |
| 2    | T-H003, T-H005, T-H009, T-H014, T-H015, T-H016, T-H025 |
| 3    | T-H004, T-H006, T-H010, T-H024                         |
| 4    | T-H007, T-H017, T-H018, T-H021                         |
| 5    | T-H008, T-H019, T-H020                                 |
| 6    | T-H022, T-H026                                         |
| 7    | T-H023                                                 |
| 8    | T-H027                                                 |
| 9    | T-H028                                                 |

## File Manifest Summary

### Files to Create (40)

| #   | File                                                                                     | Task   |
| --- | ---------------------------------------------------------------------------------------- | ------ |
| 1   | `shared/src/schemas/user-preferences.ts`                                                 | T-H002 |
| 2   | `shared/src/schemas/user-preferences.spec.ts`                                            | T-H002 |
| 3   | `shared/src/contracts/user-preferences.contracts.ts`                                     | T-H003 |
| 4   | `server/src/repositories/user-preferences.repository.ts`                                 | T-H005 |
| 5   | `server/src/repositories/user-preferences.repository.test.ts`                            | T-H005 |
| 6   | `server/src/services/user-preferences.service.ts`                                        | T-H006 |
| 7   | `server/src/services/user-preferences.service.test.ts`                                   | T-H006 |
| 8   | `server/src/routes/user-preferences.ts`                                                  | T-H007 |
| 9   | `server/src/routes/user-preferences.test.ts`                                             | T-H007 |
| 10  | `ui/src/app/services/user-preferences-client.ts`                                         | T-H009 |
| 11  | `ui/src/app/stores/preferences-store.ts`                                                 | T-H010 |
| 12  | `ui/src/app/stores/preferences-store.spec.ts`                                            | T-H010 |
| 13  | `ui/src/app/shell/header/role-color.util.ts`                                             | T-H012 |
| 14  | `ui/src/app/shell/header/zoom.util.ts`                                                   | T-H012 |
| 15  | `ui/src/app/shell/header/header-branding/header-branding.ts`                             | T-H014 |
| 16  | `ui/src/app/shell/header/header-branding/header-branding.html`                           | T-H014 |
| 17  | `ui/src/app/shell/header/header-search/header-search.ts`                                 | T-H015 |
| 18  | `ui/src/app/shell/header/header-search/header-search.html`                               | T-H015 |
| 19  | `ui/src/app/shell/header/sign-in-button/sign-in-button.ts`                               | T-H016 |
| 20  | `ui/src/app/shell/header/sign-in-button/sign-in-button.html`                             | T-H016 |
| 21  | `ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.ts`   | T-H017 |
| 22  | `ui/src/app/shell/header/user-menu/user-menu-zoom-controls/user-menu-zoom-controls.html` | T-H017 |
| 23  | `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.ts`       | T-H018 |
| 24  | `ui/src/app/shell/header/user-menu/user-menu-theme-sheet/user-menu-theme-sheet.html`     | T-H018 |
| 25  | `ui/src/app/shell/header/user-menu/user-menu.ts`                                         | T-H019 |
| 26  | `ui/src/app/shell/header/user-menu/user-menu.html`                                       | T-H019 |
| 27  | `ui/src/app/shell/header/notifications-button/notifications-button.ts`                   | T-H020 |
| 28  | `ui/src/app/shell/header/notifications-button/notifications-button.html`                 | T-H020 |
| 29  | `ui/src/app/shell/header/help-menu/help-menu.ts`                                         | T-H021 |
| 30  | `ui/src/app/shell/header/help-menu/help-menu.html`                                       | T-H021 |
| 31  | `ui/src/app/shell/header/header-actions/header-actions.ts`                               | T-H022 |
| 32  | `ui/src/app/shell/header/header-actions/header-actions.html`                             | T-H022 |
| 33  | `ui/src/app/features/help/faq/faq.ts`                                                    | T-H024 |
| 34  | `ui/src/app/features/help/faq/faq.html`                                                  | T-H024 |
| 35  | `ui/src/app/features/help/docs/docs.ts`                                                  | T-H025 |
| 36  | `ui/src/app/features/help/docs/docs.html`                                                | T-H025 |
| 37  | `ui/src/app/features/help/support/support.ts`                                            | T-H025 |
| 38  | `ui/src/app/features/help/support/support.html`                                          | T-H025 |
| 39  | `ui/src/app/features/settings/settings.ts`                                               | T-H026 |
| 40  | `ui/src/app/features/settings/settings.html`                                             | T-H026 |

### Files to Modify (11)

| #   | File                                                                | Task           |
| --- | ------------------------------------------------------------------- | -------------- |
| 1   | `shared/src/constants/paths.ts`                                     | T-H004         |
| 2   | `shared/src/index.ts`                                               | T-H004         |
| 3   | `server/src/index.ts`                                               | T-H008         |
| 4   | `server/src/routes/index.ts`                                        | T-H008         |
| 5   | `ui/src/styles.css`                                                 | T-H011         |
| 6   | `ui/src/app/app.html`                                               | T-H013         |
| 7   | `ui/src/app/app.ts`                                                 | T-H013         |
| 8   | `ui/src/app/shell/app-shell/app-shell.html`                         | T-H013         |
| 9   | `ui/src/app/shell/app-shell/app-shell.ts`                           | T-H013, T-H028 |
| 10  | `ui/src/app/shell/header/header.ts`                                 | T-H023         |
| 11  | `ui/src/app/shell/header/header.html`                               | T-H023         |
| 12  | `ui/src/app/app.routes.ts`                                          | T-H026         |
| 13  | `ui/src/app/features/auth/accept-invitation/accept-invitation.html` | T-H027         |
| 14  | `ui/src/app/features/auth/login/login.ts`                           | T-H027         |
| 15  | `ui/e2e/auth.spec.ts`                                               | T-H027         |
