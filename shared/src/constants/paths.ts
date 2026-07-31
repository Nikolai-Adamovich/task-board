/** API base path prefix for all endpoints */
export const API_BASE_PATH = '/api/v1' as const;

/** Named API route paths (relative to base path) */
export const ApiPaths = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    me: '/auth/me',
  },
  tenants: {
    base: '/tenants',
    byId: '/tenants/:id',
    members: '/tenants/:id/members',
    memberById: '/tenants/:id/members/:userId',
  },
  users: {
    base: '/users',
    byId: '/users/:id',
    preferences: '/users/:id/preferences',
  },
  projects: {
    base: '/projects',
    byId: '/projects/:id',
    members: '/projects/:id/members',
    memberById: '/projects/:id/members/:userId',
  },
  boards: {
    base: '/boards',
    byId: '/boards/:id',
    columns: '/boards/:id/columns',
    columnById: '/boards/:id/columns/:columnId',
  },
  tasks: {
    base: '/tasks',
    byId: '/tasks/:id',
    move: '/tasks/:id/move',
    assign: '/tasks/:id/assign',
  },
  sprints: {
    base: '/sprints',
    byId: '/sprints/:id',
  },
} as const;
