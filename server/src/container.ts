/**
 * Request-scoped composition root.
 *
 * Builds the full repository/service graph once per request.
 * ⚠️ Must stay request-scoped: repositories capture MongoDB `Collection`
 * objects bound to the per-request `MongoClient` (see index.ts) — caching
 * this graph at module level would leak closed sockets across requests
 * on Cloudflare Workers.
 */

import type { Document } from 'mongodb';
import { getCollection } from './db/mongo.js';
import { AuthService } from './services/auth.service.js';
import { AuditEnrichmentService } from './services/audit-enrichment.service.js';
import { AuditService } from './services/audit.service.js';
import { BoardService } from './services/board.service.js';
import { CommentService } from './services/comment.service.js';
import { CounterService } from './services/counter.service.js';
import { EmailService, ConsoleEmailService } from './services/email.service.js';
import { FilterService } from './services/filter.service.js';
import { LabelService } from './services/label.service.js';
import { ProjectService } from './services/project.service.js';
import { SprintService } from './services/sprint.service.js';
import { StatusService } from './services/status.service.js';
import { TaskRelationshipService } from './services/task-relationship.service.js';
import { TaskService } from './services/task.service.js';
import { TaskTypeService } from './services/task-type.service.js';
import { TenantMemberService } from './services/tenant-member.service.js';
import { TenantService } from './services/tenant.service.js';
import { UserPreferencesService } from './services/user-preferences.service.js';

import { AuditEventRepository, type AuditEventDocument } from './repositories/audit-event.repository.js';
import { BoardRepository, type BoardDocument } from './repositories/board.repository.js';
import { CommentRepository, type CommentDocument } from './repositories/comment.repository.js';
import { CounterRepository, type CounterDocument } from './repositories/counter.repository.js';
import { FilterRepository, type FilterDocument } from './repositories/filter.repository.js';
import { LabelRepository, type LabelDocument } from './repositories/label.repository.js';
import { ProjectMemberRepository, type ProjectMemberDocument } from './repositories/project-member.repository.js';
import { ProjectRepository, type ProjectDocument } from './repositories/project.repository.js';
import { SprintRepository, type SprintDocument } from './repositories/sprint.repository.js';
import { StatusRepository, type StatusDocument } from './repositories/status.repository.js';
import {
  TaskRelationshipRepository,
  type TaskRelationshipDocument,
} from './repositories/task-relationship.repository.js';
import { TaskRepository, type TaskDocument } from './repositories/task.repository.js';
import { TaskTypeRepository, type TaskTypeDocument } from './repositories/task-type.repository.js';
import { TenantMemberRepository, type TenantMemberDocument } from './repositories/tenant-member.repository.js';
import { TenantRepository, type TenantDocument } from './repositories/tenant.repository.js';
import { UserPreferencesRepository, type UserPreferencesDocument } from './repositories/user-preferences.repository.js';
import { UserSettingsRepository } from './repositories/user-settings.repository.js';
import { UserRepository, type UserDocument } from './repositories/user.repository.js';

/** Environment values required to build the service graph */
export interface ContainerEnv {
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  FRONTEND_URL?: string;
}

/** All application services, built once per request */
export interface Services {
  auth: AuthService;
  audit: AuditService;
  boards: BoardService;
  comments: CommentService;
  filters: FilterService;
  labels: LabelService;
  preferences: UserPreferencesService;
  projects: ProjectService;
  relationships: TaskRelationshipService;
  sprints: SprintService;
  statuses: StatusService;
  tasks: TaskService;
  taskTypes: TaskTypeService;
  tenantMembers: TenantMemberService;
  tenants: TenantService;
}

/** Build the full service graph for the current request. */
export function buildServices(env: ContainerEnv): Services {
  // ── Repositories ──────────────────────────────────────────────────────────
  const auditRepo = new AuditEventRepository(getCollection<AuditEventDocument>('audit_events'));
  const boardRepo = new BoardRepository(getCollection<BoardDocument>('boards'));
  const commentRepo = new CommentRepository(getCollection<CommentDocument>('comments'));
  const counterRepo = new CounterRepository(getCollection<CounterDocument>('counters'));
  const filterRepo = new FilterRepository(getCollection<FilterDocument>('filters'));
  const labelRepo = new LabelRepository(getCollection<LabelDocument>('labels'));
  const projectMemberRepo = new ProjectMemberRepository(getCollection<ProjectMemberDocument>('project_members'));
  const projectRepo = new ProjectRepository(getCollection<ProjectDocument>('projects'));
  const relationshipRepo = new TaskRelationshipRepository(
    getCollection<TaskRelationshipDocument>('task_relationships'),
  );
  const sprintRepo = new SprintRepository(getCollection<SprintDocument>('sprints'));
  const statusRepo = new StatusRepository(getCollection<StatusDocument>('statuses'));
  const taskRepo = new TaskRepository(getCollection<TaskDocument>('tasks'));
  const taskTypeRepo = new TaskTypeRepository(getCollection<TaskTypeDocument>('task_types'));
  const tenantMemberRepo = new TenantMemberRepository(getCollection<TenantMemberDocument>('tenant_members'));
  const tenantRepo = new TenantRepository(getCollection<TenantDocument>('tenants'));
  const userRepo = new UserRepository(getCollection<UserDocument>('users'));
  // ── Cross-cutting services ────────────────────────────────────────────────
  const counterService = new CounterService(counterRepo);
  const auditEnrichment = new AuditEnrichmentService({
    tasks: taskRepo,
    sprints: sprintRepo,
    statuses: statusRepo,
    labels: labelRepo,
    taskTypes: taskTypeRepo,
    boards: boardRepo,
    projects: projectRepo,
    users: userRepo,
    comments: commentRepo,
    tenants: tenantRepo,
    tenantMembers: tenantMemberRepo,
  });
  const auditService = new AuditService(auditRepo, userRepo, auditEnrichment);
  const emailService = env.RESEND_API_KEY
    ? new EmailService(env.RESEND_API_KEY, 'noreply@taskboard.app', env.FRONTEND_URL || '')
    : new ConsoleEmailService();

  return {
    auth: new AuthService(
      userRepo,
      tenantRepo,
      tenantMemberRepo,
      env.JWT_SECRET,
      emailService,
      env.FRONTEND_URL || 'http://localhost:4200',
    ),
    audit: auditService,
    boards: new BoardService(boardRepo, statusRepo),
    comments: new CommentService(commentRepo, userRepo, taskRepo, projectMemberRepo),
    filters: new FilterService(filterRepo),
    labels: new LabelService(labelRepo, taskRepo),
    preferences: new UserPreferencesService(
      new UserPreferencesRepository(getCollection<UserPreferencesDocument>('user_preferences')),
      boardRepo,
      new UserSettingsRepository(getCollection('user_settings')),
    ),
    projects: new ProjectService(projectRepo, projectMemberRepo, {
      taskTypes: getCollection<Document>('task_types'),
      statuses: getCollection<Document>('statuses'),
      boards: getCollection<Document>('boards'),
    }),
    relationships: new TaskRelationshipService(relationshipRepo, taskRepo),
    sprints: new SprintService(sprintRepo, projectRepo, taskRepo, auditService, projectMemberRepo),
    statuses: new StatusService(statusRepo, taskRepo, boardRepo, projectRepo, auditService, projectMemberRepo),
    tasks: new TaskService(
      taskRepo,
      counterService,
      projectRepo,
      projectMemberRepo,
      statusRepo,
      taskTypeRepo,
      userRepo,
      sprintRepo,
      commentRepo,
      relationshipRepo,
      auditService,
    ),
    taskTypes: new TaskTypeService(taskTypeRepo, taskRepo, projectRepo, auditService),
    tenantMembers: new TenantMemberService(tenantRepo, tenantMemberRepo, userRepo, emailService),
    tenants: new TenantService(tenantRepo, tenantMemberRepo, userRepo, undefined, undefined, projectMemberRepo),
  };
}
