import { type Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { tenantGuard } from './guards/tenant.guard';
import { projectGuard } from './guards/project.guard';

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

  // Root — dashboard handles all states internally (no authGuard)
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'workspace/create',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tenants/create-workspace/create-workspace').then((m) => m.CreateWorkspace),
  },

  // Tenant-scoped routes (authenticated + tenant guard)
  {
    path: 'tenants/:tenantId',
    canActivate: [authGuard, tenantGuard],
    loadComponent: () => import('./shell/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/tenants/workspace-detail/workspace-detail').then((m) => m.WorkspaceDetail),
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
            path: 'tasks/:taskId',
            loadComponent: () => import('./features/tasks/task-detail/task-detail').then((m) => m.TaskDetail),
          },
          {
            path: 'sprints',
            loadComponent: () => import('./features/sprints/sprint-list/sprint-list').then((m) => m.SprintList),
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

  // Settings (authenticated, no tenant context)
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },

  // Fallback
  {
    path: '**',
    redirectTo: '',
  },
];
