# Header Redesign — Technical Specification

> **Version:** 1.0.0 **Date:** 2026-07-31 **Status:** Draft **Scope:** Header redesign with user menu, theme switcher,
> zoom controls, search placeholder, notifications placeholder, and help menu.

---

## 1. Goal and Context

### 1.1 Objective

Replace the current minimal header (sidebar toggle + display name + logout button) with a full-featured application
header that provides:

- **Branding** — app icon and name linking to home.
- **Search** — styled search input placeholder (no backend logic).
- **User menu** — avatar with role-colored border, dropdown with user info, language picker, theme sheet, zoom controls,
  preferences link, and sign-out.
- **Notifications** — bell icon opening a right-side sheet (placeholder).
- **Help** — question-mark icon opening a dropdown with FAQ, Documentation, and Support links.

### 1.2 Current State

The existing header lives in [`header.ts`](ui/src/app/shell/header/header.ts) and
[`header.html`](ui/src/app/shell/header/header.html):

- Left: sidebar toggle button (`hlmSidebarTrigger`).
- Right: user display name + "Logout" button (authenticated only).
- Uses [`AuthStore`](ui/src/app/stores/auth-store.ts:22) for auth state.
- Sits inside `<ui-sidebar>` in [`app-shell.html`](ui/src/app/shell/app-shell/app-shell.html:1), above `<main>`.

### 1.3 Architectural Constraints

- **Angular 22+** standalone components, zoneless, signals, signal forms.
- **Spartan UI** (Helm layer) for all UI primitives.
- **Tailwind CSS v4** for styling.
- **@ng-icons/lucide** for icons.
- **Monorepo** — changes span `ui/`, `server/`, and `shared/`.
- **No avatar field** on the User entity; icon-based fallback is required.

---

## 2. Users and Roles (RBAC)

The header displays role-dependent visual styling. The role is sourced from
[`AuthStore.tenantRole`](ui/src/app/stores/auth-store.ts:28).

| TenantRole | Avatar Border Color (Light)   | Avatar Border Color (Dark)    | Label  |
| ---------- | ----------------------------- | ----------------------------- | ------ |
| `owner`    | `oklch(0.65 0.2 145)` (green) | `oklch(0.7 0.18 145)` (green) | Owner  |
| `admin`    | `oklch(0.65 0.2 265)` (blue)  | `oklch(0.7 0.18 265)` (blue)  | Admin  |
| `member`   | `oklch(0.65 0.15 80)` (amber) | `oklch(0.7 0.13 80)` (amber)  | Member |
| `null`     | `var(--border)`               | `var(--border)`               | —      |

The user menu info block displays:

- **Role**: `owner` / `admin` / `member` (from `AuthStore.tenantRole`).
- **Subscription**: `free` / `premium` (from `TenantStore.activeTenant().subscription`).

---

## 3. Functional Requirements

### 3.1 Global Header Behavior

| #    | Requirement                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| FR-1 | Header is visible on ALL pages (authenticated and unauthenticated).                                        |
| FR-2 | Header uses `position: sticky; top: 0; z-index: 50` to remain above all content including sidebar.         |
| FR-3 | Header height is defined by CSS variable `--header-height: 4rem` (64px).                                   |
| FR-4 | All other layout elements (`<main>`, notification sheet, sidebar) reference `--header-height` for offsets. |
| FR-5 | Remove the sidebar toggle button (`hlmSidebarTrigger`) from the header.                                    |

### 3.2 Left Section — Branding

| #    | Requirement                                                               |
| ---- | ------------------------------------------------------------------------- |
| FR-6 | Display an app icon (Lucide `lucideLayoutDashboard`) + text "Task Board". |
| FR-7 | Clicking the branding area navigates to `/` (home).                       |
| FR-8 | The branding area is an `<a>` element with `routerLink="/"`.              |

### 3.3 Center Section — Search

| #     | Requirement                                                                   |
| ----- | ----------------------------------------------------------------------------- |
| FR-9  | Display a search input with a `lucideSearch` icon on the left.                |
| FR-10 | When text is entered, show a clear "X" button (`lucideX`) on the right.       |
| FR-11 | When the input is empty, the clear button is hidden.                          |
| FR-12 | No actual search logic is implemented — this is a styled placeholder.         |
| FR-13 | Input has `placeholder="Search…"` and `aria-label="Search"`.                  |
| FR-14 | The search field is hidden on screens narrower than `768px` (Tailwind `md:`). |

### 3.4 Right Section (RTL order: Sign in | User Menu | Notifications | Help)

#### 3.4a Sign In (Unauthenticated)

| #     | Requirement                                                                          |
| ----- | ------------------------------------------------------------------------------------ |
| FR-15 | When not authenticated, display a "Sign in" button/link navigating to `/auth/login`. |
| FR-16 | Label text is "Sign in" (NOT "Login").                                               |

#### 3.4b User Menu (Authenticated)

| #     | Requirement                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| FR-17 | Display an avatar (Spartan UI `hlm-avatar`) with the user's initials as fallback.                                           |
| FR-18 | Avatar has a 2px circular border whose color maps to the user's `tenantRole`.                                               |
| FR-19 | Display the user's `displayName` next to the avatar (hidden on `< md` screens).                                             |
| FR-20 | The `displayName` text color matches the role-based border color.                                                           |
| FR-21 | Clicking the avatar/name opens a dropdown menu (Spartan UI `dropdown-menu`).                                                |
| FR-22 | Dropdown contains an **info block**: user email, role label, subscription badge.                                            |
| FR-23 | Dropdown contains a **Language** submenu listing languages (English, Polish, etc.) — no actual switching logic yet.         |
| FR-24 | Dropdown contains a **Themes** item that opens a Sheet sliding up from bottom.                                              |
| FR-25 | Theme Sheet shows "Light" and "Dark" options, each with a label and color swatch rectangles.                                |
| FR-26 | Selecting a theme applies/removes the `dark` class on `document.documentElement` and persists the choice to `localStorage`. |
| FR-27 | Dropdown contains a **Zoom** block with title "Zoom", "-" and "+" buttons, and a percentage indicator (e.g., "100%").       |
| FR-28 | Zoom values cycle through: 25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500.                    |
| FR-29 | Zoom applies via CSS `transform: scale()` on the `<html>` element.                                                          |
| FR-30 | Zoom value is persisted to the backend with a 5-second debounce.                                                            |
| FR-31 | Dropdown contains a **Preferences** link navigating to the user settings page.                                              |
| FR-32 | Dropdown contains a **Sign out** item (NOT "Logout") that calls `authStore.logout()`.                                       |

#### 3.4c Notifications (Authenticated)

| #     | Requirement                                                            |
| ----- | ---------------------------------------------------------------------- |
| FR-33 | Display a bell icon (`lucideBell`) with title "Notifications".         |
| FR-34 | Clicking opens a Sheet from the right side.                            |
| FR-35 | Sheet top offset equals `--header-height` (must not cover the header). |
| FR-36 | Sheet content is a placeholder ("No notifications").                   |

#### 3.4d Help

| #     | Requirement                                                |
| ----- | ---------------------------------------------------------- |
| FR-37 | Display a "?" icon (`lucideCircleHelp`) with title "Help". |
| FR-38 | Clicking opens a dropdown menu with three items.           |
| FR-39 | **FAQ** — navigates to `/faq`.                             |
| FR-40 | **Documentation** — navigates to `/docs`.                  |
| FR-41 | **Support** — navigates to `/support`.                     |

### 3.5 Renaming

| #     | Requirement                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| FR-42 | All user-visible "Login" text → "Sign in" throughout the app.                                                             |
| FR-43 | All user-visible "Logout" text → "Sign out" throughout the app.                                                           |
| FR-44 | Internal identifiers (`login`, `logout`, route paths like `/auth/login`) remain unchanged — only display text is renamed. |

### 3.6 Backend — User Preferences

| #     | Requirement                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------- |
| FR-45 | New `UserPreferences` entity stored in MongoDB with fields: `userId`, `zoom`, `theme`, `language`, `updatedAt`. |
| FR-46 | `GET /api/v1/users/:id/preferences` — returns the user's preferences (auth required, own user only).            |
| FR-47 | `PUT /api/v1/users/:id/preferences` — upserts user preferences (auth required, own user only).                  |
| FR-48 | Zoom persistence uses a 5-second debounce on the frontend before calling `PUT`.                                 |

---

## 4. Non-Functional Requirements

| #     | Requirement                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------- |
| NFR-1 | Header renders within 100ms on initial page load (no blocking HTTP calls for unauthenticated view). |
| NFR-2 | Dropdown/sheet open/close animations complete within 200ms.                                         |
| NFR-3 | Zoom CSS transform does not cause layout reflow — use `transform-origin: top left`.                 |
| NFR-4 | All interactive elements have visible focus indicators (`outline-ring`).                            |
| NFR-5 | Header meets WCAG 2.1 AA for color contrast in both light and dark themes.                          |
| NFR-6 | Dropdown menus are keyboard-navigable (Arrow keys, Escape to close, Tab to move).                   |
| NFR-7 | The zoom debounce timer resets on each keystroke/button press; only the final value is persisted.   |
| NFR-8 | User preferences endpoint returns within 200ms (MongoDB indexed on `userId`).                       |

---

## 5. User Stories / Scenarios

### US-1: Unauthenticated user sees branding and sign-in

> As a visitor, I see the app branding on the left, a search placeholder in the center, a Help menu, and a "Sign in"
> button on the right so I can access the application.

**Scenario:**

1. Navigate to any page without being logged in.
2. Header is visible with "Task Board" branding, search input, Help icon, and "Sign in" button.
3. No user menu or notification bell is displayed.
4. Clicking "Sign in" navigates to `/auth/login`.

### US-2: Authenticated user opens user menu and sees info

> As an authenticated user, I can click my avatar to see my email, role, and subscription status.

**Scenario:**

1. Log in as a user with role `admin` and subscription `free`.
2. Header shows avatar with blue border + display name.
3. Click avatar → dropdown opens showing email, "Admin" role, "Free" subscription badge.

### US-3: User switches theme

> As an authenticated user, I can switch between Light and Dark themes from the header.

**Scenario:**

1. Open user menu → click "Themes".
2. Sheet slides up from bottom showing "Light" and "Dark" options with color swatches.
3. Click "Dark" → `:root.dark` class is applied, page transitions to dark theme.
4. Close sheet and reload page → dark theme persists.

### US-4: User adjusts zoom

> As an authenticated user, I can zoom the application in/out and the setting persists.

**Scenario:**

1. Open user menu → zoom block shows "100%".
2. Click "+" three times → indicator shows "125%", page scales up.
3. Wait 6 seconds → zoom "125" is saved to backend.
4. Refresh page → zoom restores to 125%.

### US-5: User opens notifications

> As an authenticated user, I can open the notification panel from the header.

**Scenario:**

1. Click bell icon → sheet slides in from the right, not covering the header.
2. Sheet shows "No notifications" placeholder.
3. Press Escape or click overlay → sheet closes.

### US-6: User navigates help pages

> As a user, I can access FAQ, Documentation, and Support from the Help menu.

**Scenario:**

1. Click "?" icon → dropdown appears with FAQ, Documentation, Support.
2. Click "FAQ" → navigates to `/faq` page with accordion Q&A.
3. Click "Documentation" → navigates to `/docs` page.
4. Click "Support" → navigates to `/support` page with contact form.

---

## 6. Acceptance Criteria

### AC-1: Header Layout

- [ ] Header is `position: sticky; top: 0` with `z-index: 50`.
- [ ] `--header-height: 4rem` CSS variable is defined in [`styles.css`](ui/src/styles.css:1).
- [ ] Header renders on unauthenticated pages (login, register, landing).
- [ ] Sidebar toggle button is removed from header.

### AC-2: Branding

- [ ] Left section shows app icon + "Task Board" text.
- [ ] Clicking navigates to `/` without full page reload (SPA navigation).

### AC-3: Search Placeholder

- [ ] Center section shows a styled input with search icon.
- [ ] Clear button appears only when input has text.
- [ ] Search field is hidden on viewports < 768px.
- [ ] Input has `aria-label="Search"`.

### AC-4: Sign In (Unauthenticated)

- [ ] "Sign in" button is visible when no user is authenticated.
- [ ] Clicking navigates to `/auth/login`.
- [ ] No user menu, notifications, or avatar is shown.

### AC-5: User Menu (Authenticated)

- [ ] Avatar displays user initials in a circle with 2px role-colored border.
- [ ] Display name is shown next to avatar (hidden on small screens).
- [ ] Clicking opens dropdown with: info block, Language submenu, Themes, Zoom, Preferences, Sign out.
- [ ] Info block shows email, role label, and subscription tier.
- [ ] "Sign out" label is used (not "Logout").

### AC-6: Theme Switcher

- [ ] "Themes" item opens a Sheet sliding up from bottom.
- [ ] Sheet shows Light and Dark options with color swatch rectangles.
- [ ] Selecting a theme toggles `:root.dark` class and persists to `localStorage`.
- [ ] Theme persists across page reloads.

### AC-7: Zoom Controls

- [ ] Zoom block shows "-", percentage indicator, and "+" buttons.
- [ ] Zoom cycles through the defined values: 25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300,
      400, 500.
- [ ] Zoom applies via `transform: scale()` on `<html>`.
- [ ] Zoom is persisted to backend after 5-second debounce.
- [ ] Zoom restores from backend on page load.

### AC-8: Notifications

- [ ] Bell icon is visible when authenticated.
- [ ] Clicking opens a right-side Sheet offset from the header by `--header-height`.
- [ ] Sheet shows placeholder content.

### AC-9: Help Menu

- [ ] "?" icon opens dropdown with FAQ, Documentation, Support items.
- [ ] FAQ navigates to `/faq` with accordion content.
- [ ] Documentation navigates to `/docs`.
- [ ] Support navigates to `/support` with contact form placeholder.

### AC-10: Renaming

- [ ] All visible "Login" text replaced with "Sign in" (except internal identifiers and route paths).
- [ ] All visible "Logout" text replaced with "Sign out".
- [ ] "Go to Login" in [`accept-invitation.html`](ui/src/app/features/auth/accept-invitation/accept-invitation.html:17)
      → "Go to Sign in".

### AC-11: Backend API

- [ ] `UserPreferences` schema exists in `shared/` with Zod validation.
- [ ] `GET /api/v1/users/:id/preferences` returns preferences (200) or defaults (200).
- [ ] `PUT /api/v1/users/:id/preferences` upserts preferences (200).
- [ ] Endpoints require authentication and restrict access to own-user only.
- [ ] MongoDB index on `{ userId: 1 }` for the preferences collection.

### AC-12: Accessibility

- [ ] All interactive header elements have `aria-label` attributes.
- [ ] Dropdown menus support keyboard navigation (ArrowUp/Down, Escape, Tab).
- [ ] Sheets trap focus when open and restore focus on close.
- [ ] Avatar has `role="img"` and `aria-label` with user name.
- [ ] Theme swatches have `role="radio"` within a `radiogroup`.
- [ ] Zoom buttons have `aria-label` like "Zoom in" / "Zoom out" and `aria-live="polite"` on the percentage display.

---

## 7. Out of Scope

| Item                                                | Reason                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| Actual search backend / results                     | Placeholder only — no search service exists yet.                 |
| Language switching logic                            | Submenu is UI-only; i18n framework not chosen.                   |
| Real notifications system                           | Placeholder sheet only.                                          |
| User avatar upload / image storage                  | No avatar field on User entity.                                  |
| User settings page (`/settings/preferences`)        | Route is defined but page content is out of scope for this spec. |
| Billing / payment integration                       | Subscription tier is display-only.                               |
| Mobile hamburger menu / responsive sidebar collapse | Separate concern.                                                |

---

## 8. Open Questions / Assumptions

### Assumptions

| #   | Assumption                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | The user's `tenantRole` is always available when authenticated (populated from JWT by [`AuthStore`](ui/src/app/stores/auth-store.ts:101)).                     |
| A-2 | Subscription tier is read from [`TenantStore.activeTenant().subscription`](ui/src/app/stores/tenant-store.ts:17).                                              |
| A-3 | Theme persistence uses `localStorage` key `taskboard_theme` in addition to backend preferences.                                                                |
| A-4 | Zoom is applied via `transform: scale()` on `<html>` with `transform-origin: 0 0` and the body is given a compensating `width`/`min-height` to avoid clipping. |
| A-5 | The default zoom value is `100` (no transform applied).                                                                                                        |
| A-6 | The "Preferences" link navigates to `/tenants/:tenantId/settings` (existing settings page) or a future `/settings/preferences` route.                          |
| A-7 | The FAQ, Documentation, and Support pages are new lazy-loaded standalone components.                                                                           |
| A-8 | The `dropdown-menu` and `accordion` Spartan UI components need to be installed via `npx spartan add`.                                                          |

### Blocking Questions

| #    | Question                                                                                                                   | Impact                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| BQ-1 | Where should the "Preferences" link navigate? To existing `/tenants/:tenantId/settings` or a new global `/settings` route? | Affects route configuration.                |
| BQ-2 | Should the search field be visible on unauthenticated pages or only when logged in?                                        | Affects header template conditional logic.  |
| BQ-3 | What languages should appear in the Language submenu? (English + Polish? Or a full list?)                                  | Affects the language submenu data.          |
| BQ-4 | Should the user preferences collection be a separate MongoDB collection or embedded in the user document?                  | Affects backend schema design.              |
| BQ-5 | Should the zoom `transform` approach account for fixed-position elements (like modals) that may be affected by scaling?    | Affects zoom CSS implementation complexity. |

---

## 9. Component Breakdown

### 9.1 Component Tree

```
ui-header (existing, rewritten)
├── ui-header-branding          (new)
├── ui-header-search            (new)
└── ui-header-actions           (new)
    ├── ui-sign-in-button       (new, unauthenticated only)
    ├── ui-user-menu            (new, authenticated only)
    │   ├── BrnDropdownMenu (Spartan)
    │   ├── ui-theme-sheet      (new, Sheet)
    │   └── ui-zoom-controls    (new, inline in dropdown)
    ├── ui-notifications-button (new, authenticated only)
    │   └── HlmSheet (right-side)
    └── ui-help-menu            (new)
        └── BrnDropdownMenu (Spartan)
```

### 9.2 File Structure

```
ui/src/app/shell/header/
├── header.ts                          # Root header component (REWRITE)
├── header.html                        # Root header template (REWRITE)
├── header-branding/
│   ├── header-branding.ts
│   └── header-branding.html
├── header-search/
│   ├── header-search.ts
│   └── header-search.html
├── header-actions/
│   ├── header-actions.ts
│   └── header-actions.html
├── sign-in-button/
│   ├── sign-in-button.ts
│   └── sign-in-button.html
├── user-menu/
│   ├── user-menu.ts
│   ├── user-menu.html
│   ├── user-menu-theme-sheet/
│   │   ├── user-menu-theme-sheet.ts
│   │   └── user-menu-theme-sheet.html
│   └── user-menu-zoom-controls/
│       ├── user-menu-zoom-controls.ts
│       └── user-menu-zoom-controls.html
├── notifications-button/
│   ├── notifications-button.ts
│   └── notifications-button.html
└── help-menu/
    ├── help-menu.ts
    └── help-menu.html
```

### 9.3 New Route-Level Pages

```
ui/src/app/features/help/
├── faq/
│   ├── faq.ts
│   └── faq.html
├── docs/
│   ├── docs.ts
│   └── docs.html
└── support/
    ├── support.ts
    └── support.html
```

---

## 10. New Routes

Add to [`app.routes.ts`](ui/src/app/app.routes.ts:6):

```typescript
// Help pages (public, rendered inside app-shell when tenant context exists)
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

**Decision needed:** These routes should be either top-level (public) or nested under the tenant scope. If they need the
header with tenant context, they should be children of the `tenants/:tenantId` route. If they are fully public, they
should be top-level. Recommendation: **top-level** routes that render inside the app-shell (which already wraps
`<ui-header />` and `<router-outlet />`).

---

## 11. Backend API Changes

### 11.1 User Preferences Schema (`shared/`)

Add [`shared/src/schemas/user-preferences.ts`](shared/src/schemas/user-preferences.ts):

```typescript
import { z } from 'zod';

export const UserPreferencesSchema = z.object({
  userId: z.uuid(),
  zoom: z.number().int().min(25).max(500).default(100),
  theme: z.enum(['light', 'dark']).default('light'),
  language: z.string().min(2).max(10).default('en'),
  updatedAt: z.iso.datetime(),
});

export const UpdateUserPreferencesSchema = z.object({
  zoom: z.number().int().min(25).max(500).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  language: z.string().min(2).max(10).optional(),
});
```

### 11.2 API Contracts (`shared/`)

Add [`shared/src/contracts/user-preferences.contracts.ts`](shared/src/contracts/user-preferences.contracts.ts):

```typescript
export const userPreferencesContracts = {
  get: {
    method: 'GET' as const,
    path: '/users/:id/preferences',
    response: UserPreferencesSchema,
    error: ErrorResponseSchema,
  },
  update: {
    method: 'PUT' as const,
    path: '/users/:id/preferences',
    body: UpdateUserPreferencesSchema,
    response: UserPreferencesSchema,
    error: ErrorResponseSchema,
  },
};
```

### 11.3 API Paths (`shared/`)

Add to [`ApiPaths`](shared/src/constants/paths.ts:5):

```typescript
users: {
  base: '/users',
  byId: '/users/:id',
  preferences: '/users/:id/preferences',  // NEW
},
```

### 11.4 Server Routes (`server/`)

New file: [`server/src/routes/user-preferences.ts`](server/src/routes/user-preferences.ts)

- `GET /users/:id/preferences` — requires `authMiddleware`; verifies `userId === :id`; returns preferences or defaults.
- `PUT /users/:id/preferences` — requires `authMiddleware`; verifies `userId === :id`; upserts preferences.

### 11.5 Server Repository (`server/`)

New file:
[`server/src/repositories/user-preferences.repository.ts`](server/src/repositories/user-preferences.repository.ts)

- `findByUserId(userId: string): Promise<UserPreferences | null>`
- `upsert(userId: string, data: UpdateUserPreferences): Promise<UserPreferences>`

### 11.6 MongoDB Collection

Collection name: `user_preferences` Index: `{ userId: 1 }` (unique)

---

## 12. Spartan UI Components to Install

| Component       | Install Command                 | Usage                |
| --------------- | ------------------------------- | -------------------- |
| `dropdown-menu` | `npx spartan add dropdown-menu` | User menu, Help menu |
| `accordion`     | `npx spartan add accordion`     | FAQ page Q&A         |

Already installed and used: `avatar`, `badge`, `button`, `card`, `dialog`, `field`, `input`, `label`, `native-select`,
`separator`, `sheet`, `sidebar`, `skeleton`, `spinner`, `textarea`, `tooltip`.

---

## 13. CSS / Theming Changes

### 13.1 New CSS Variables

Add to [`:root`](ui/src/styles.css:38):

```css
:root {
  --header-height: 4rem;
  /* Role-based colors (light) */
  --role-owner: oklch(0.65 0.2 145);
  --role-admin: oklch(0.65 0.2 265);
  --role-member: oklch(0.65 0.15 80);
}
```

Add to [`:root.dark`](ui/src/styles.css:70):

```css
:root.dark {
  --header-height: 4rem;
  /* Role-based colors (dark) */
  --role-owner: oklch(0.7 0.18 145);
  --role-admin: oklch(0.7 0.18 265);
  --role-member: oklch(0.7 0.13 80);
}
```

### 13.2 Role Color Utility

Add a utility function or Tailwind plugin to map `TenantRole` to the CSS variable:

```typescript
// In a shared utility file
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

### 13.3 Header Z-Index and Sticky Positioning

```css
.ui-header {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--header-height);
}
```

### 13.4 Notification Sheet Offset

The notification sheet must not cover the header:

```css
.ui-notification-sheet {
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
}
```

### 13.5 Zoom Transform

```css
html {
  transform: scale(var(--zoom, 1));
  transform-origin: 0 0;
  width: calc(100vw / var(--zoom, 1));
  min-height: calc(100vh / var(--zoom, 1));
}
```

The `--zoom` variable is set dynamically via JavaScript:
`document.documentElement.style.setProperty('--zoom', zoomValue / 100)`.

---

## 14. State Management Approach

### 14.1 Existing Stores (No Changes)

| Store                                                 | File                                                   | Purpose                       |
| ----------------------------------------------------- | ------------------------------------------------------ | ----------------------------- |
| [`AuthStore`](ui/src/app/stores/auth-store.ts:22)     | [`auth-store.ts`](ui/src/app/stores/auth-store.ts)     | Auth state, user, token, role |
| [`TenantStore`](ui/src/app/stores/tenant-store.ts:14) | [`tenant-store.ts`](ui/src/app/stores/tenant-store.ts) | Active tenant, tenant list    |

### 14.2 New Store: PreferencesStore

New file: [`ui/src/app/stores/preferences-store.ts`](ui/src/app/stores/preferences-store.ts)

```typescript
@Service()
export class PreferencesStore {
  private readonly httpClient = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly authStore = inject(AuthStore);

  readonly zoom = signal<number>(100);
  readonly theme = signal<'light' | 'dark'>('light');
  readonly language = signal<string>('en');

  private zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Load preferences from backend (called after login / on init). */
  async loadPreferences(): Promise<void> { ... }

  /** Update zoom locally and schedule debounced save. */
  setZoom(value: number): void {
    this.zoom.set(value);
    this.applyZoom(value);
    this.scheduleZoomSave();
  }

  /** Update theme locally, apply class, persist to localStorage + backend. */
  setTheme(theme: 'light' | 'dark'): void {
    this.theme.set(theme);
    this.applyTheme(theme);
    localStorage.setItem('taskboard_theme', theme);
    this.saveToBackend({ theme });
  }

  /** Apply zoom CSS transform to <html>. */
  private applyZoom(value: number): void {
    const scale = value / 100;
    document.documentElement.style.setProperty('--zoom', String(scale));
  }

  /** Apply theme class to <html>. */
  private applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  /** Debounced PUT to backend (5s). */
  private scheduleZoomSave(): void {
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    this.zoomDebounceTimer = setTimeout(() => {
      this.saveToBackend({ zoom: this.zoom() });
    }, 5000);
  }

  /** PUT preferences to backend. */
  private async saveToBackend(data: UpdateUserPreferences): Promise<void> { ... }
}
```

### 14.3 Store Initialization

[`PreferencesStore`](ui/src/app/stores/preferences-store.ts) is initialized in the
[`Dashboard`](ui/src/app/features/dashboard/dashboard.ts) component (or in
[`AppShell`](ui/src/app/shell/app-shell/app-shell.ts:8)) after authentication succeeds. Theme is restored from
`localStorage` immediately (synchronous) and from backend asynchronously.

---

## 15. Zoom Implementation Details

### 15.1 CSS Transform Approach

Apply to `<html>`:

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

### 15.2 Zoom Value Array

```typescript
const ZOOM_VALUES = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500] as const;
```

### 15.3 Zoom Navigation Logic

```typescript
function getNextZoom(current: number, direction: 'in' | 'out'): number {
  const idx = ZOOM_VALUES.indexOf(current);
  if (idx === -1) return 100; // fallback
  const next = direction === 'in' ? idx + 1 : idx - 1;
  return ZOOM_VALUES[Math.max(0, Math.min(ZOOM_VALUES.length - 1, next))];
}
```

### 15.4 Debounce

- On each "+" or "-" click, update the CSS immediately and reset a 5-second timer.
- After 5 seconds of inactivity, `PUT /api/v1/users/:id/preferences` with `{ zoom: <value> }`.
- On page load, `GET /api/v1/users/:id/preferences` → apply saved zoom.

---

## 16. Accessibility Considerations

| Area                  | Requirement                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Header landmark**   | Use `<header>` element with `role="banner"`.                                                        |
| **Navigation**        | Branding `<a>` has `aria-label="Task Board - Home"`.                                                |
| **Search**            | Input has `aria-label="Search"`. Clear button has `aria-label="Clear search"`.                      |
| **Avatar**            | `role="img"` with `aria-label="<displayName>'s avatar"`.                                            |
| **User menu trigger** | `aria-haspopup="menu"` and `aria-expanded` toggles.                                                 |
| **Dropdown items**    | Each item has `role="menuitem"`. Keyboard: ArrowUp/Down to navigate, Escape to close.               |
| **Theme sheet**       | `role="dialog"` with `aria-label="Choose theme"`. Theme options use `role="radio"` in `radiogroup`. |
| **Zoom controls**     | Buttons have `aria-label="Zoom out"` / `"Zoom in"`. Percentage has `aria-live="polite"`.            |
| **Notification bell** | `aria-label="Notifications"` with `aria-haspopup="dialog"`.                                         |
| **Help menu**         | `aria-haspopup="menu"` and `aria-expanded`.                                                         |
| **Focus management**  | Sheets trap focus; on close, focus returns to the trigger button.                                   |
| **Color contrast**    | Role-based border/text colors must pass 4.5:1 contrast ratio against `--background` in both themes. |

---

## 17. Renaming Scope

### 17.1 Files Affected

| File                                                                                             | Change                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [`header.html`](ui/src/app/shell/header/header.html:8)                                           | "Logout" → "Sign out" (removed in rewrite anyway)             |
| [`accept-invitation.html`](ui/src/app/features/auth/accept-invitation/accept-invitation.html:17) | "Go to Login" → "Go to Sign in"                               |
| [`login.ts`](ui/src/app/features/auth/login/login.ts:63)                                         | Error message: "Login failed" → "Sign in failed"              |
| [`e2e/auth.spec.ts`](ui/e2e/auth.spec.ts:1)                                                      | Test descriptions: "Login" → "Sign in", "Logout" → "Sign out" |

### 17.2 Internal Identifiers (NOT Changed)

- Route path `/auth/login` — remains unchanged.
- Method names `login()`, `logout()` on [`AuthStore`](ui/src/app/stores/auth-store.ts:50) — remain unchanged.
- `LoginRequest`, `LoginRequestSchema` types — remain unchanged.
- File names `login.ts`, `login.html` — remain unchanged.
- Comments referencing "login"/"logout" — may be updated for clarity but are not user-facing.

---

## 18. Summary

```json
{
  "tz_file": "docs/implementation/header_spec.md",
  "blocking_questions": [
    "Where should the 'Preferences' link navigate — existing tenant settings or a new global route?",
    "Should the search field be visible on unauthenticated pages?",
    "What languages should appear in the Language submenu?",
    "Should user preferences be a separate collection or embedded in the user document?",
    "Should the zoom transform account for fixed-position elements like modals?"
  ],
  "assumptions": [
    "tenantRole is always available from AuthStore JWT decode when authenticated",
    "Subscription tier is read from TenantStore.activeTenant().subscription",
    "Theme persistence uses localStorage in addition to backend preferences",
    "Zoom uses CSS transform: scale() on <html> with transform-origin: 0 0",
    "Default zoom value is 100 (no transform)",
    "Preferences link navigates to existing tenant settings page",
    "FAQ, Docs, and Support are new lazy-loaded standalone components",
    "dropdown-menu and accordion Spartan UI components need installation via npx spartan add"
  ]
}
```
