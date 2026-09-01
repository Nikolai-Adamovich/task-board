import { randomUUID } from 'node:crypto';
import type { ClientSession, Collection } from 'mongodb';
import { TenantRole, ProjectRole, ProjectStatus, ArchiveReason, DELETION_GRACE_PERIOD_MS } from '@task-board/shared';
import type { Project, ProjectMember, CreateProject, UpdateProject } from '@task-board/shared';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { TransactionsUnsupportedError, withTransaction } from '../db/mongo.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { ProjectMemberRepository } from '../repositories/project-member.repository.js';
import type { AuditService } from './audit.service.js';

// ─── Constants ───────────────────────────────────────────────────────────────

// DR-1: `name` is the human-readable display name shown in boards/tables;
// `key` is the stable seed identifier used for board-column wiring and
// defaultStatusId (keys/positions/normalizedNames are unchanged).
const SEED_STATUSES = [
  { key: 'TODO', name: 'To Do', normalizedName: 'todo', position: 0 },
  { key: 'IN_PROGRESS', name: 'In Progress', normalizedName: 'in_progress', position: 1 },
  { key: 'IN_REVIEW', name: 'In Review', normalizedName: 'in_review', position: 2 },
  { key: 'REOPENED', name: 'Reopened', normalizedName: 'reopened', position: 3 },
  { key: 'DONE', name: 'Done', normalizedName: 'done', position: 4 },
];
const SEED_TASK_TYPES = [
  { key: 'TASK', name: 'Task', icon: '📋', position: 0 },
  { key: 'BUG', name: 'Bug', icon: '🐛', position: 1 },
  { key: 'STORY', name: 'Story', icon: '📖', position: 2 },
];
// Board columns: TODO+REOPENED, IN_PROGRESS, IN_REVIEW, DONE
const SEED_BOARD_COLUMNS = [
  { name: 'To Do', statusRefs: ['TODO', 'REOPENED'], position: 0 },
  { name: 'In Progress', statusRefs: ['IN_PROGRESS'], position: 1 },
  { name: 'In Review', statusRefs: ['IN_REVIEW'], position: 2 },
  { name: 'Done', statusRefs: ['DONE'], position: 3 },
];

// ─── Interfaces for cascade delete ───────────────────────────────────────────

export interface ProjectCascadeTaskRepo {
  findIdsByProject(projectId: string): Promise<string[]>;
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeSprintRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeBoardRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeLabelRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeStatusRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeTaskTypeRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeRelationshipRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeCommentRepo {
  deleteByTaskIds(taskIds: string[]): Promise<void>;
}

export interface ProjectCascadeFilterRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeAuditRepo {
  deleteByProject(projectId: string): Promise<void>;
}

export interface ProjectCascadeCounterRepo {
  deleteByProject(projectId: string): Promise<void>;
}

// ─── Project Service ─────────────────────────────────────────────────────────

export class ProjectService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly projectMemberRepo: ProjectMemberRepository,
    /** Direct collections for seed data (task_types, statuses, boards) */
    private readonly collections: {
      taskTypes: Collection;
      statuses: Collection;
      boards: Collection;
    },
    private readonly cascadeRepos?: {
      taskRepo: ProjectCascadeTaskRepo;
      sprintRepo: ProjectCascadeSprintRepo;
      boardRepo: ProjectCascadeBoardRepo;
      labelRepo: ProjectCascadeLabelRepo;
      statusRepo: ProjectCascadeStatusRepo;
      taskTypeRepo: ProjectCascadeTaskTypeRepo;
      relationshipRepo: ProjectCascadeRelationshipRepo;
      commentRepo: ProjectCascadeCommentRepo;
      filterRepo: ProjectCascadeFilterRepo;
      auditRepo: ProjectCascadeAuditRepo;
      counterRepo: ProjectCascadeCounterRepo;
    },
    private readonly auditService?: AuditService,
  ) {}

  // ─── Project CRUD ──────────────────────────────────────────────────────────

  async listProjects(tenantId: string): Promise<Project[]> {
    return this.projectRepo.findByTenant(tenantId);
  }

  /**
   * Create a new project with atomic seed data (BR-003 / DEC-025).
   * Validates key format and uniqueness within tenant.
   * Seeds TaskTypes, Statuses, default Board, and creates creator membership.
   *
   * The whole seed runs inside a MongoDB transaction: an abort leaves no
   * partially initialized project visible. On deployments without transaction
   * support (standalone `mongod`), falls back to ordered inserts with a
   * compensating delete — see {@link createProjectWithCompensatingCleanup}.
   */
  async createProject(tenantId: string, userId: string, userRole: string, input: CreateProject): Promise<Project> {
    this.requireTenantAdmin(userRole);

    // Validate key format
    this.validateKey(input.key);

    // Check key uniqueness within tenant
    const existing = await this.projectRepo.findByTenantAndKey(tenantId, input.key);

    if (existing) {
      throw new ConflictError('A project with this key already exists in this tenant', 'DUPLICATE_PROJECT_KEY');
    }

    let project: Project;

    try {
      // DEC-025: insert project + statuses + task types + default board +
      // creator membership atomically; commit ⇒ all visible, abort ⇒ nothing.
      project = await withTransaction(async (session) => {
        const created = await this.projectRepo.create(tenantId, input, { session });
        const statusMap = await this.seedStatuses(created.id, session);

        await this.seedBoard(created.id, statusMap, session);

        await this.seedTaskTypes(created.id, session);

        // Link the default status on the project (still inside the transaction)
        await this.projectRepo.update(created.id, { defaultStatusId: statusMap.get('TODO') ?? '' }, { session });

        // Add creator as PROJECT_ADMIN
        await this.projectMemberRepo.create(
          { userId, projectId: created.id, role: ProjectRole.PROJECT_ADMIN },
          { session },
        );

        return created;
      });
    } catch (err) {
      if (err instanceof TransactionsUnsupportedError) {
        // Fallback policy (DEC-025): standalone MongoDB (no replica set) cannot
        // run transactions. Log clearly and use the legacy compensating-cleanup
        // path so local dev does not hard-fail. Production (Atlas Free replica
        // set) and docker-compose dev both run a replica set and never hit this.
        console.warn(
          '[projects] MongoDB topology does not support transactions — falling back to compensating-cleanup seed. ' +
            'Run local MongoDB as a single-node replica set (see docker-compose.yml) for atomic seeding.',
        );
        project = await this.createProjectWithCompensatingCleanup(tenantId, userId, input);
      } else {
        throw err;
      }
    }

    // Return the updated project
    const updated = await this.projectRepo.findById(project.id);

    // Audit side effect
    if (this.auditService) {
      await this.auditService.log({
        tenantId,
        projectId: project.id,
        entityType: 'PROJECT',
        entityId: project.id,
        action: 'CREATED',
        actorId: userId,
      });
    }

    return updated ?? project;
  }

  async getProject(id: string): Promise<Project> {
    const project = await this.projectRepo.findById(id);

    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  }

  async getProjectByKey(tenantId: string, key: string): Promise<Project> {
    const project = await this.projectRepo.findByTenantAndKey(tenantId, key);

    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  }

  async updateProject(id: string, userRole: string, input: UpdateProject, userId?: string): Promise<Project> {
    this.requireTenantAdmin(userRole);

    const project = await this.getProject(id);

    this.requireNotArchived(project);

    // Key immutability check — reject if key is being changed and tasks exist
    // Note: UpdateProject doesn't include key, but we guard against future changes
    // The key field is not in the update schema, so this is a safety net

    const updated = await this.projectRepo.update(id, input);

    if (!updated) {
      throw new NotFoundError('Project not found');
    }

    // Audit side effect
    if (this.auditService && userId) {
      const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

      if (input.name !== undefined) changes.push({ field: 'name', oldValue: project.name, newValue: input.name });
      if (input.description !== undefined)
        changes.push({ field: 'description', oldValue: project.description, newValue: input.description });
      await this.auditService.log({
        tenantId: project.tenantId,
        projectId: id,
        entityType: 'PROJECT',
        entityId: id,
        action: 'UPDATED',
        actorId: userId,
        changes,
      });
    }

    return updated;
  }

  // ─── Project Lifecycle ─────────────────────────────────────────────────────

  async deleteProject(id: string, userRole: string, userId?: string): Promise<void> {
    this.requireTenantAdmin(userRole);

    const project = await this.getProject(id);

    this.requireNotArchived(project);

    const deletionScheduledAt = new Date(Date.now() + DELETION_GRACE_PERIOD_MS);

    await this.projectRepo.update(id, {
      status: ProjectStatus.DELETION_PENDING,
      deletionScheduledAt,
    });

    // Audit side effect
    if (this.auditService && userId) {
      await this.auditService.log({
        tenantId: project.tenantId,
        projectId: id,
        entityType: 'PROJECT',
        entityId: id,
        action: 'DELETED',
        actorId: userId,
      });
    }
  }

  async archiveProject(id: string, userRole: string): Promise<void> {
    this.requireTenantAdmin(userRole);

    const project = await this.getProject(id);

    this.requireNotArchived(project);

    await this.projectRepo.update(id, {
      status: ProjectStatus.ARCHIVED,
      archiveReason: ArchiveReason.PROJECT_ARCHIVE,
    });
  }

  async restoreProject(id: string, userRole: string): Promise<void> {
    this.requireTenantAdmin(userRole);

    await this.projectRepo.update(id, {
      status: ProjectStatus.ACTIVE,
      archiveReason: null,
      deletionScheduledAt: null,
    });
  }

  async cancelDeletion(id: string, userRole: string): Promise<void> {
    this.requireTenantAdmin(userRole);

    await this.projectRepo.update(id, {
      status: ProjectStatus.ACTIVE,
      deletionScheduledAt: null,
    });
  }

  async permanentDelete(id: string): Promise<void> {
    const project = await this.getProject(id);

    if (project.status !== ProjectStatus.DELETION_PENDING) {
      throw new AppError(400, 'CONFLICT', 'Project must be in DELETION_PENDING status');
    }

    // Full cascade delete if cascade repos are available.
    // Comments are keyed by `taskId` (no `projectId` field) — collect the
    // project's task ids and delete their comments BEFORE removing the tasks.
    if (this.cascadeRepos) {
      const taskIds = await this.cascadeRepos.taskRepo.findIdsByProject(id);

      await this.cascadeRepos.commentRepo.deleteByTaskIds(taskIds);
      await this.cascadeRepos.relationshipRepo.deleteByProject(id);
      await this.cascadeRepos.taskRepo.deleteByProject(id);
      await this.cascadeRepos.sprintRepo.deleteByProject(id);
      await this.cascadeRepos.boardRepo.deleteByProject(id);
      await this.cascadeRepos.labelRepo.deleteByProject(id);
      await this.cascadeRepos.statusRepo.deleteByProject(id);
      await this.cascadeRepos.taskTypeRepo.deleteByProject(id);
      await this.cascadeRepos.filterRepo.deleteByProject(id);
      await this.cascadeRepos.auditRepo.deleteByProject(id);
      await this.cascadeRepos.counterRepo.deleteByProject(id);
    }

    // Remove all memberships
    const members = await this.projectMemberRepo.findByProject(id);

    for (const member of members) {
      await this.projectMemberRepo.delete(id, member.userId);
    }

    await this.projectRepo.delete(id);
  }

  // ─── Project Member Management ─────────────────────────────────────────────

  async addMember(projectId: string, userId: string, role: string, requesterRole: string): Promise<ProjectMember> {
    this.requireTenantAdmin(requesterRole);

    await this.getProject(projectId);

    const existing = await this.projectMemberRepo.findByUserAndProject(userId, projectId);

    if (existing) {
      throw new ConflictError('User is already a member of this project');
    }

    return this.projectMemberRepo.create({
      userId,
      projectId,
      role,
    });
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    role: string,
    requesterRole: string,
  ): Promise<ProjectMember> {
    this.requireTenantAdmin(requesterRole);

    await this.getProject(projectId);

    const updated = await this.projectMemberRepo.updateRole(projectId, userId, role);

    if (!updated) {
      throw new NotFoundError('Project member not found');
    }

    return updated;
  }

  async removeMember(projectId: string, userId: string, requesterRole: string): Promise<void> {
    this.requireTenantAdmin(requesterRole);

    await this.getProject(projectId);

    const deleted = await this.projectMemberRepo.delete(projectId, userId);

    if (!deleted) {
      throw new NotFoundError('Project member not found');
    }
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    await this.getProject(projectId);
    return this.projectMemberRepo.findByProjectWithUsers(projectId);
  }

  // ─── Seed Helpers ──────────────────────────────────────────────────────────

  private validateKey(key: string): void {
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Key must start with a letter and contain only uppercase letters and digits (2-10 chars)',
      );
    }
  }

  private async seedStatuses(projectId: string, session?: ClientSession): Promise<Map<string, string>> {
    const statusMap = new Map<string, string>();

    for (const status of SEED_STATUSES) {
      const id = randomUUID();

      await this.collections.statuses.insertOne(
        {
          id,
          projectId,
          name: status.name,
          normalizedName: status.normalizedName,
          position: status.position,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      );
      statusMap.set(status.key, id);
    }

    return statusMap;
  }

  private async seedTaskTypes(projectId: string, session?: ClientSession): Promise<void> {
    for (const taskType of SEED_TASK_TYPES) {
      await this.collections.taskTypes.insertOne(
        {
          id: randomUUID(),
          projectId,
          key: taskType.key,
          name: taskType.name,
          icon: taskType.icon,
          position: taskType.position,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      );
    }
  }

  /**
   * Seed the project's single board (single-board model, doc 102): identified
   * by projectId, no name/type, created atomically with the project.
   */
  private async seedBoard(projectId: string, statusMap: Map<string, string>, session?: ClientSession): Promise<void> {
    const columns = SEED_BOARD_COLUMNS.map((col) => ({
      id: randomUUID(),
      statusIds: col.statusRefs.map((ref) => statusMap.get(ref) ?? ''),
      position: col.position,
    }));

    await this.collections.boards.insertOne(
      {
        projectId,
        columns,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { session },
    );
  }

  /**
   * Legacy non-transactional seed path (DEC-025 fallback): ordered inserts
   * followed by a compensating delete of the project if any step fails.
   * Only used when the deployment's MongoDB cannot run transactions — there
   * is a small window where a partially seeded project is visible before the
   * cleanup completes.
   */
  private async createProjectWithCompensatingCleanup(
    tenantId: string,
    userId: string,
    input: CreateProject,
  ): Promise<Project> {
    const project = await this.projectRepo.create(tenantId, input);

    try {
      const statusMap = await this.seedStatuses(project.id);
      const todoStatusId = statusMap.get('TODO') ?? '';

      await this.seedBoard(project.id, statusMap);

      await this.seedTaskTypes(project.id);

      await this.projectRepo.update(project.id, { defaultStatusId: todoStatusId });

      await this.projectMemberRepo.create({
        userId,
        projectId: project.id,
        role: ProjectRole.PROJECT_ADMIN,
      });
    } catch (err) {
      // If seeding fails, clean up the project
      await this.projectRepo.delete(project.id);
      throw err;
    }

    return project;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireTenantAdmin(role: string): void {
    if (role !== TenantRole.OWNER && role !== TenantRole.ADMIN) {
      throw new ForbiddenError('Only owner or admin can perform this action');
    }
  }

  private requireNotArchived(project: Project): void {
    if (project.status === ProjectStatus.ARCHIVED) {
      throw new AppError(409, 'PROJECT_ARCHIVED', 'Project is archived and cannot be modified');
    }
  }
}
