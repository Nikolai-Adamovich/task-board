import { describe, expect, it } from 'vitest';
import {
  NeutralDotColor,
  priorityBadgeVariant,
  priorityLabel,
  statusBadgeVariant,
  roleBadgeVariant,
  memberStatusBadgeVariant,
  taskTypeBadgeVariant,
} from './priority';

describe('priorityBadgeVariant', () => {
  it('should return the mapped variant for each priority', () => {
    expect(priorityBadgeVariant('LOW')).toBe('outline');
    expect(priorityBadgeVariant('MEDIUM')).toBe('secondary');
    expect(priorityBadgeVariant('HIGH')).toBe('default');
    expect(priorityBadgeVariant('CRITICAL')).toBe('destructive');
  });

  it('should return the neutral fallback for unknown priorities', () => {
    expect(priorityBadgeVariant('unknown')).toBe('outline');
  });
});

describe('priorityLabel', () => {
  it('should return title-case labels for every priority value', () => {
    expect(priorityLabel('LOW')).toBe('Low');
    expect(priorityLabel('MEDIUM')).toBe('Medium');
    expect(priorityLabel('HIGH')).toBe('High');
    expect(priorityLabel('CRITICAL')).toBe('Critical');
  });

  it('should fall back to the raw value for unknown priorities', () => {
    expect(priorityLabel('unknown')).toBe('unknown');
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
