/** API base path prefix for all endpoints */
export const API_BASE_PATH = '/api' as const;

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
    audit: '/tenants/:tenantId/audit',
  },
  invitations: {
    byId: '/invitations/:id',
    accept: '/invitations/:id/accept',
    decline: '/invitations/:id/decline',
  },
  projects: {
    base: '/tenants/:tenantId/projects',
    byId: '/projects/:id',
    members: '/projects/:id/members',
    memberById: '/projects/:id/members/:userId',
    tasks: '/projects/:projectId/tasks',
    sprints: '/projects/:projectId/sprints',
    boards: '/projects/:projectId/boards',
    statuses: '/projects/:projectId/statuses',
    taskTypes: '/projects/:projectId/task-types',
    labels: '/projects/:projectId/labels',
    filters: '/projects/:projectId/filters',
    audit: '/projects/:projectId/audit',
    preferences: '/projects/:projectId/preferences',
  },
  tasks: {
    byId: '/tasks/:id',
    my: '/tasks/my',
    comments: '/tasks/:taskId/comments',
    relationships: '/tasks/:taskId/relationships',
  },
  sprints: {
    byId: '/sprints/:id',
  },
  boards: {
    byId: '/boards/:id',
  },
  statuses: {
    byId: '/statuses/:id',
  },
  taskTypes: {
    byId: '/task-types/:id',
  },
  labels: {
    byId: '/labels/:id',
  },
  comments: {
    byId: '/comments/:id',
  },
  taskRelationships: {
    byId: '/task-relationships/:id',
  },
  filters: {
    byId: '/filters/:id',
  },
  preferences: {
    base: '/preferences',
  },
} as const;
