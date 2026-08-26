import { type Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { tenantGuard } from './guards/tenant.guard';
import { projectGuard } from './guards/project.guard';
import { tenantRedirectGuard } from './guards/tenant-redirect.guard';

export const routes: Routes = [
  // Auth routes (unauthenticated)
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'auth/accept-invitation',
    loadComponent: () => import('./features/auth/accept-invitation/accept-invitation').then((m) => m.AcceptInvitation),
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },

  // Root — entry handles visitor / new-user / pending-invitations states and
  // redirects authenticated users with an accessible tenant to its home (DEC-033)
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'workspace/create',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tenants/create-workspace/create-workspace').then((m) => m.CreateWorkspace),
  },

  // Tenant-scoped routes via slug (DEC-032): /t/:tenantSlug/...
  {
    path: 't/:tenantSlug',
    canActivate: [authGuard, tenantGuard],
    loadComponent: () => import('./shell/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/tenants/tenant-home/tenant-home').then((m) => m.TenantHome),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/tenants/tenant-settings/tenant-settings').then((m) => m.TenantSettings),
      },
      {
        path: 'settings/members',
        loadComponent: () =>
          import('./features/tenants/tenant-member-list/tenant-member-list').then((m) => m.TenantMemberList),
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/project-list/project-list').then((m) => m.ProjectList),
      },
      {
        path: 'projects/:projectKey',
        canActivate: [projectGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/projects/project-detail/project-detail').then((m) => m.ProjectDetail),
          },
          {
            path: 'boards/:boardId',
            loadComponent: () => import('./features/boards/board-view/board-view').then((m) => m.BoardView),
          },
          {
            path: 'tasks',
            loadComponent: () => import('./features/tasks/task-table/task-table').then((m) => m.TaskTable),
          },
          {
            // Must be registered BEFORE `tasks/:taskNumber` so "new" is not treated as a task number (U1)
            path: 'tasks/new',
            loadComponent: () => import('./features/tasks/create-task/create-task').then((m) => m.TaskCreate),
          },
          {
            path: 'tasks/:taskNumber',
            loadComponent: () => import('./features/tasks/task-detail/task-detail').then((m) => m.TaskDetail),
          },
          {
            path: 'sprints',
            loadComponent: () => import('./features/sprints/sprint-list/sprint-list').then((m) => m.SprintList),
          },
          {
            path: 'sprints/backlog',
            loadComponent: () => import('./features/sprints/backlog-view/backlog-view').then((m) => m.BacklogView),
          },
          {
            path: 'sprints/:sprintId',
            loadComponent: () => import('./features/sprints/sprint-detail/sprint-detail').then((m) => m.SprintDetail),
          },
          {
            path: 'members',
            loadComponent: () =>
              import('./features/projects/project-member-list/project-member-list').then((m) => m.ProjectMemberList),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('./features/projects/project-settings-hub/project-settings-hub').then((m) => m.ProjectSettingsHub),
          },
          {
            path: 'settings/general',
            loadComponent: () =>
              import('./features/projects/project-settings-general/project-settings-general').then(
                (m) => m.ProjectSettingsGeneral,
              ),
          },
          {
            path: 'settings/boards',
            loadComponent: () => import('./features/projects/board-manager/board-manager').then((m) => m.BoardManager),
          },
          {
            path: 'settings/danger-zone',
            loadComponent: () =>
              import('./features/projects/project-danger-zone/project-danger-zone').then((m) => m.ProjectDangerZone),
          },
          {
            path: 'settings/statuses',
            loadComponent: () =>
              import('./features/statuses/status-manager/status-manager').then((m) => m.StatusManager),
          },
          {
            path: 'settings/task-types',
            loadComponent: () =>
              import('./features/task-types/task-type-manager/task-type-manager').then((m) => m.TaskTypeManager),
          },
          {
            path: 'settings/labels',
            loadComponent: () => import('./features/labels/label-manager/label-manager').then((m) => m.LabelManager),
          },
          {
            path: 'audit',
            loadComponent: () =>
              import('./features/audit/audit-log-viewer/audit-log-viewer').then((m) => m.AuditLogViewer),
          },
        ],
      },
    ],
  },

  // Legacy /tenants/:id paths → redirect to the slug URL (DEC-032)
  {
    path: 'tenants/:tenantId',
    canActivate: [authGuard, tenantRedirectGuard],
    redirectTo: '',
  },

  // Help pages (public)
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

  // User preferences (authenticated, no tenant context) — V3-7: renamed from
  // `/settings` to `/profile/preferences`; the old URL redirects for bookmarks.
  {
    path: 'profile/preferences',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'settings',
    redirectTo: 'profile/preferences',
    pathMatch: 'full',
  },

  // Fallback
  {
    path: '**',
    redirectTo: '',
  },
];
