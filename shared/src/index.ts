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
  InvitationStatus,
  InvitationStatusValues,
  BoardType,
  BoardTypeValues,
  TaskRelationshipType,
  TaskRelationshipTypeValues,
  TenantStatus,
  TenantStatusValues,
  ProjectStatus,
  ProjectStatusValues,
  ArchiveReason,
  ArchiveReasonValues,
  AuditAction,
  AuditActionValues,
  AuditEntityType,
  AuditEntityTypeValues,
} from './constants/roles.js';
export { ExpandState } from './constants/expand-state.js';
export { HttpMethod, HttpMethodValues } from './constants/http.js';
export { API_BASE_PATH, ApiPaths } from './constants/paths.js';
export { DEFAULT_THEME_ID } from './constants/theme.js';

// ─── Types ───────────────────────────────────────────────────────────────────
export type { User, CreateUser } from './types/user.js';

export type { LoginRequest, RegisterRequest, AuthResponse, AcceptInvitation, InvitationDetails } from './types/auth.js';

export type {
  IdentitySnapshot,
  Tenant,
  CreateTenant,
  UpdateTenant,
  Invitation,
  TenantMember,
  MyInvitation,
} from './types/tenant.js';

export type { Project, CreateProject, UpdateProject, ProjectMember } from './types/project.js';

export type { Board, BoardColumn, CreateBoard, UpdateBoard } from './types/board.js';

export type { Task, CreateTask, UpdateTask } from './types/task.js';

export type { Sprint, CreateSprint, UpdateSprint } from './types/sprint.js';

export type { Status, CreateStatus, UpdateStatus } from './types/status.js';

export type { TaskType, CreateTaskType, UpdateTaskType } from './types/task-type.js';

export type { Label, CreateLabel, UpdateLabel } from './types/label.js';

export type { Comment, CreateComment, UpdateComment } from './types/comment.js';

export type { TaskRelationship, CreateTaskRelationship } from './types/task-relationship.js';

export type { Filter, FilterCriteria, FilterSort, CreateFilter, UpdateFilter } from './types/filter.js';

export type { AuditEvent, AuditActor, AuditChange } from './types/audit.js';

export type { UserProjectBoardPreference, UpdateUserProjectBoardPreference } from './types/user-preference.js';

export type {
  ThemeManifestItem,
  UserPreferences,
  UpdateUserPreferences,
  PaginatedResponse,
  PaginationParams,
  ErrorCode,
  ErrorResponse,
  SupportRequest,
} from './types/common.js';
