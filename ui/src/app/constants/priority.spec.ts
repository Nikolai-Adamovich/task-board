import type { TaskPriorityLevel } from '@task-board/shared';
import { describe, expect, it } from 'vitest';
import {
  NeutralDotColor,
  priorityBadgeVariant,
  priorityLabelKey,
  statusBadgeVariant,
  roleBadgeVariant,
  memberStatusBadgeVariant,
  taskTypeBadgeVariant,
} from './priority';

describe('priorityBadgeVariant', () => {
  it('should return the mapped variant for each priority', () => {
    expect(priorityBadgeVariant(0)).toBe('outline');
    expect(priorityBadgeVariant(1)).toBe('secondary');
    expect(priorityBadgeVariant(2)).toBe('default');
    expect(priorityBadgeVariant(3)).toBe('destructive');
  });

  it('should return the neutral fallback for unknown priorities', () => {
    expect(priorityBadgeVariant(99 as TaskPriorityLevel)).toBe('outline');
  });
});

describe('priorityLabelKey', () => {
  it('should return the i18n key for every priority value', () => {
    expect(priorityLabelKey(0)).toBe('priority.low');
    expect(priorityLabelKey(1)).toBe('priority.medium');
    expect(priorityLabelKey(2)).toBe('priority.high');
    expect(priorityLabelKey(3)).toBe('priority.critical');
  });

  it('should return an empty key for unknown priorities so callers fall back to the raw value', () => {
    expect(priorityLabelKey(99 as TaskPriorityLevel)).toBe('');
  });
});

describe('statusBadgeVariant', () => {
  it('should return variants for sprint statuses', () => {
    expect(statusBadgeVariant('FUTURE')).toBe('secondary');
    expect(statusBadgeVariant('ACTIVE')).toBe('default');
    expect(statusBadgeVariant('COMPLETED')).toBe('outline');
  });

  it('should return variants for tenant/project statuses', () => {
    expect(statusBadgeVariant('ARCHIVED')).toBe('secondary');
    expect(statusBadgeVariant('DELETION_PENDING')).toBe('destructive');
  });

  it('should return the neutral fallback for unknown statuses', () => {
    expect(statusBadgeVariant('unknown')).toBe('outline');
  });
});

describe('roleBadgeVariant', () => {
  it('should return the mapped variant for each tenant role', () => {
    expect(roleBadgeVariant('OWNER')).toBe('default');
    expect(roleBadgeVariant('ADMIN')).toBe('secondary');
    expect(roleBadgeVariant('MEMBER')).toBe('outline');
  });

  it('should return the neutral fallback for unknown roles', () => {
    expect(roleBadgeVariant('unknown')).toBe('outline');
  });
});

describe('taskTypeBadgeVariant', () => {
  it('should return the semantic variant for each built-in task type key', () => {
    expect(taskTypeBadgeVariant('TASK')).toBe('default');
    expect(taskTypeBadgeVariant('BUG')).toBe('destructive');
    expect(taskTypeBadgeVariant('STORY')).toBe('secondary');
  });

  it('should be case-insensitive', () => {
    expect(taskTypeBadgeVariant('bug')).toBe('destructive');
  });

  it('should return the outline fallback for unknown or missing keys', () => {
    expect(taskTypeBadgeVariant('EPIC')).toBe('outline');
    expect(taskTypeBadgeVariant(undefined)).toBe('outline');
    expect(taskTypeBadgeVariant(null)).toBe('outline');
  });
});

describe('memberStatusBadgeVariant', () => {
  it('should return the mapped variant for member statuses', () => {
    expect(memberStatusBadgeVariant('ACTIVE')).toBe('default');
    expect(memberStatusBadgeVariant('PENDING')).toBe('secondary');
    expect(memberStatusBadgeVariant('DECLINED')).toBe('destructive');
    expect(memberStatusBadgeVariant('ACCESS_REVOKED')).toBe('destructive');
  });

  it('should return the neutral fallback for unknown statuses', () => {
    expect(memberStatusBadgeVariant('unknown')).toBe('outline');
  });
});

describe('NeutralDotColor', () => {
  it('should be defined', () => {
    expect(NeutralDotColor).toBe('bg-muted-foreground');
  });
});
