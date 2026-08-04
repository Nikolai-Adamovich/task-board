// @task-board/shared
// Single source of truth for types and constants.
// Runtime-library free — no imports from Zod, Angular, Hono, RxJS, etc.

// ─── Utilities ───────────────────────────────────────────────────────────────
export { valuesOf } from './utils/values-of.js';

// ─── Constants ───────────────────────────────────────────────────────────────
export {
  TenantRole,
  TenantRoleValues,
  ProjectRole,
  ProjectRoleValues,
  TaskPriority,
  TaskPriorityValues,
  SprintStatus,
  SprintStatusValues,
  MemberStatus,
  MemberStatusValues,
  SubscriptionTier,
  SubscriptionTierValues,
} from './constants/roles.js';
export { DefaultColumnNames } from './constants/columns.js';
export { ExpandState } from './constants/expand-state.js';
export { HttpMethod, HttpMethodValues } from './constants/http.js';
export { API_BASE_PATH, ApiPaths } from './constants/paths.js';
export { DEFAULT_THEME_ID } from './constants/theme.js';

// ─── Types ───────────────────────────────────────────────────────────────────
export type { User, CreateUser } from './types/user.js';

export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  AcceptInvitation,
  InvitationDetails,
  MyInvitation,
  PendingInvitation,
} from './types/auth.js';

export type { Tenant, CreateTenant, UpdateTenant, TenantMember, InviteMember, TenantWithRole } from './types/tenant.js';

export type { Project, CreateProject, UpdateProject, ProjectMember } from './types/project.js';

export type { Board, CreateBoard, UpdateBoard, Column, CreateColumn } from './types/board.js';

export type { Task, CreateTask, UpdateTask, MoveTask, AssignTask, MyTask } from './types/task.js';

export type { Sprint, CreateSprint, UpdateSprint } from './types/sprint.js';

export type {
  ThemeManifestItem,
  UserPreferences,
  UpdateUserPreferences,
  ErrorResponse,
  Pagination,
  ListQuery,
  SupportRequest,
} from './types/common.js';
