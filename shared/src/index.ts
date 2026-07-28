// @task-board/shared
// Single source of truth for types, schemas, contracts, constants, and validators.

// ─── Constants ───────────────────────────────────────────────────────────────
export { TenantRole, ProjectRole, TaskPriority, SprintStatus } from './constants/roles.js';
export { DefaultColumnNames } from './constants/columns.js';
export { HttpMethod } from './constants/http.js';
export { API_BASE_PATH, ApiPaths } from './constants/paths.js';

// ─── Validators ─────────────────────────────────────────────────────────────
export { uuid } from './validators/uuid.js';
export { slug } from './validators/slug.js';
export { paginationQuery } from './validators/pagination.js';

// ─── Schemas ────────────────────────────────────────────────────────────────
export {
  ErrorResponseSchema,
  PaginationSchema,
  createPaginatedResponseSchema,
  ListQuerySchema,
} from './schemas/common.js';
export type { ErrorResponse, Pagination, ListQuery } from './schemas/common.js';

export { UserSchema, CreateUserSchema } from './schemas/user.js';
export type { User, CreateUser } from './schemas/user.js';

export { LoginRequestSchema, RegisterRequestSchema, AuthResponseSchema } from './schemas/auth.js';
export type { LoginRequest, RegisterRequest, AuthResponse } from './schemas/auth.js';

export { TenantSchema, CreateTenantSchema, UpdateTenantSchema, TenantMemberSchema } from './schemas/tenant.js';
export type { Tenant, CreateTenant, UpdateTenant, TenantMember } from './schemas/tenant.js';

export { ProjectSchema, CreateProjectSchema, UpdateProjectSchema, ProjectMemberSchema } from './schemas/project.js';
export type { Project, CreateProject, UpdateProject, ProjectMember } from './schemas/project.js';

export {
  BoardSchema,
  CreateBoardSchema,
  UpdateBoardSchema,
  ColumnSchema,
  CreateColumnSchema,
} from './schemas/board.js';
export type { Board, CreateBoard, UpdateBoard, Column, CreateColumn } from './schemas/board.js';

export { TaskSchema, CreateTaskSchema, UpdateTaskSchema, MoveTaskSchema, AssignTaskSchema } from './schemas/task.js';
export type { Task, CreateTask, UpdateTask, MoveTask, AssignTask } from './schemas/task.js';

export { SprintSchema, CreateSprintSchema, UpdateSprintSchema } from './schemas/sprint.js';
export type { Sprint, CreateSprint, UpdateSprint } from './schemas/sprint.js';

// ─── Contracts ──────────────────────────────────────────────────────────────
export type { ApiContract } from './contracts/common.contracts.js';
export { authContracts } from './contracts/auth.contracts.js';
export { userContracts } from './contracts/user.contracts.js';
export { tenantContracts } from './contracts/tenant.contracts.js';
export { projectContracts } from './contracts/project.contracts.js';
export { boardContracts } from './contracts/board.contracts.js';
export { taskContracts } from './contracts/task.contracts.js';
export { sprintContracts } from './contracts/sprint.contracts.js';
