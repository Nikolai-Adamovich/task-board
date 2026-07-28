import { type Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { tenantGuard } from './guards/tenant.guard';
import { projectGuard } from './guards/project.guard';

export const routes: Routes = [
  // Auth routes (unauthenticated)
  {
    path: 'auth/login',
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./auth/register/register').then((m) => m.Register),
  },

  // Root redirect to dashboard
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },

  // Tenant-scoped routes (authenticated + tenant guard)
  {
    path: 'tenants/:tenantId',
    canActivate: [authGuard, tenantGuard],
    loadComponent: () => import('./shell/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/project-list/project-list').then((m) => m.ProjectList),
      },
      {
        path: 'projects/:projectId',
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
        ],
      },
    ],
  },

  // Wildcard redirect
  {
    path: '**',
    redirectTo: '',
  },
];
