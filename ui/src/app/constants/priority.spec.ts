import { describe, expect, it } from 'vitest';
import {
  NeutralColor,
  NeutralDotColor,
  priorityBadgeClass,
  statusBadgeClass,
  roleBadgeClass,
  memberStatusBadgeClass,
  taskTypeBadgeClass,
} from './priority';

describe('priorityBadgeClass', () => {
  it('should return the mapped class for each priority', () => {
    expect(priorityBadgeClass('LOW')).toBe('bg-blue-100 text-blue-700');
    expect(priorityBadgeClass('MEDIUM')).toBe('bg-yellow-100 text-yellow-700');
    expect(priorityBadgeClass('HIGH')).toBe('bg-orange-100 text-orange-700');
    expect(priorityBadgeClass('CRITICAL')).toBe('bg-red-100 text-red-700');
  });

  it('should return the neutral fallback for unknown priorities', () => {
    expect(priorityBadgeClass('unknown')).toBe(NeutralColor);
  });
});

describe('statusBadgeClass', () => {
  it('should return classes for sprint statuses', () => {
    expect(statusBadgeClass('FUTURE')).toBe('bg-blue-100 text-blue-700');
    expect(statusBadgeClass('ACTIVE')).toBe('bg-green-100 text-green-700');
    expect(statusBadgeClass('COMPLETED')).toBe('bg-gray-100 text-gray-600');
  });

  it('should return classes for tenant/project statuses', () => {
    expect(statusBadgeClass('ARCHIVED')).toBe('bg-amber-100 text-amber-700');
    expect(statusBadgeClass('DELETION_PENDING')).toBe('bg-red-100 text-red-700');
  });

  it('should return the neutral fallback for unknown statuses', () => {
    expect(statusBadgeClass('unknown')).toBe(NeutralColor);
  });
});

describe('roleBadgeClass', () => {
  it('should return the mapped class for each tenant role', () => {
    expect(roleBadgeClass('OWNER')).toBe('bg-purple-100 text-purple-700');
    expect(roleBadgeClass('ADMIN')).toBe('bg-blue-100 text-blue-700');
    expect(roleBadgeClass('MEMBER')).toBe('bg-gray-100 text-gray-600');
  });

  it('should return the neutral fallback for unknown roles', () => {
    expect(roleBadgeClass('unknown')).toBe(NeutralColor);
  });
});

describe('taskTypeBadgeClass', () => {
  it('should return the mapped class for each built-in task type key', () => {
    expect(taskTypeBadgeClass('TASK')).toBe('bg-blue-100 text-blue-700');
    expect(taskTypeBadgeClass('BUG')).toBe('bg-red-100 text-red-700');
    expect(taskTypeBadgeClass('STORY')).toBe('bg-green-100 text-green-700');
  });

  it('should be case-insensitive', () => {
    expect(taskTypeBadgeClass('bug')).toBe('bg-red-100 text-red-700');
  });

  it('should return the neutral fallback for unknown or missing keys', () => {
    expect(taskTypeBadgeClass('EPIC')).toBe(NeutralColor);
    expect(taskTypeBadgeClass(undefined)).toBe(NeutralColor);
    expect(taskTypeBadgeClass(null)).toBe(NeutralColor);
  });
});

describe('memberStatusBadgeClass', () => {
  it('should return the mapped class for member statuses', () => {
    expect(memberStatusBadgeClass('ACTIVE')).toBe('bg-green-100 text-green-700');
    expect(memberStatusBadgeClass('PENDING')).toBe('bg-amber-100 text-amber-700');
    expect(memberStatusBadgeClass('DECLINED')).toBe('bg-red-100 text-red-700');
    expect(memberStatusBadgeClass('ACCESS_REVOKED')).toBe('bg-red-100 text-red-700');
  });

  it('should return the neutral fallback for unknown statuses', () => {
    expect(memberStatusBadgeClass('unknown')).toBe(NeutralColor);
  });
});

describe('neutral dot color', () => {
  it('should be defined', () => {
    expect(NeutralDotColor).toBe('bg-gray-500');
  });
});
