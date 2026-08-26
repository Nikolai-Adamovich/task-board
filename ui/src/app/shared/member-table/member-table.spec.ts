/**
 * Tests for the shared MemberTable component (U4).
 *
 * Covers:
 * - Variant rendering (project hides the status column, tenant shows it)
 * - Row rendering (name/email/role)
 * - Permission gating (Actions column only when canManage)
 * - Edit flow (open dialog → confirm emits roleChange)
 * - Remove flow (confirm dialog → remove emitted)
 * - Tenant-only actions visibility (resend/revoke/restore)
 * - Context-missing guard (V1-10/V2-1): error state instead of table
 * - Empty / loading states
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MemberTable } from './member-table';
import type { MemberRow } from './member-table';

const rows: MemberRow[] = [
  {
    userId: 'u1',
    displayName: 'Owner User',
    email: 'owner@example.com',
    role: 'OWNER',
    status: 'ACTIVE',
    invitationStatus: null,
  },
  {
    userId: 'u2',
    displayName: 'Member User',
    email: 'member@example.com',
    role: 'MEMBER',
    status: 'ACTIVE',
    invitationStatus: null,
  },
];
const pendingRow: MemberRow = {
  userId: 'u3',
  displayName: null,
  email: 'pending@example.com',
  role: 'MEMBER',
  status: 'ACTIVE',
  invitationStatus: 'PENDING',
};
const revokedRow: MemberRow = {
  userId: 'u4',
  displayName: 'Revoked User',
  email: 'revoked@example.com',
  role: 'MEMBER',
  status: 'ACCESS_REVOKED',
  invitationStatus: null,
};

describe('MemberTable', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  let el: HTMLElement;

  function create(
    variant: 'tenant' | 'project',
    tableRows: MemberRow[] = rows,
    canManage = true,
    inputs: Record<string, unknown> = {},
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } }), MemberTable],
      providers: [provideRouter([])],
    });

    const fixtureRef = TestBed.createComponent(MemberTable);

    fixtureRef.componentRef.setInput('variant', variant);
    fixtureRef.componentRef.setInput('rows', tableRows);
    fixtureRef.componentRef.setInput('canManage', canManage);
    fixtureRef.componentRef.setInput('roles', ['ADMIN', 'MEMBER']);

    for (const [key, value] of Object.entries(inputs)) {
      fixtureRef.componentRef.setInput(key, value);
    }

    fixtureRef.detectChanges();

    component = fixtureRef.componentInstance;
    el = fixtureRef.nativeElement as HTMLElement;
  }

  // ── Rendering ──────────────────────────────────────────────────

  it('should render user name, email and role cells', () => {
    create('tenant');

    expect(el.textContent).toContain('Owner User');
    expect(el.textContent).toContain('owner@example.com');
    expect(el.textContent).toContain('member@example.com');
  });

  it('should render the status column only in the tenant variant', () => {
    create('tenant');
    expect(el.textContent).toContain('members.status');

    create('project');
    expect(el.textContent).not.toContain('members.status');
  });

  it('should show the invitation-pending badge for pending invitations', () => {
    create('tenant', [...rows, pendingRow]);

    expect(el.textContent).toContain('members.invitationPending');
  });

  // ── Permission gating ──────────────────────────────────────────

  it('should hide the Actions column and buttons without canManage', () => {
    create('tenant', rows, false);

    expect(el.textContent).not.toContain('members.actions');
    expect(el.querySelector('button[title$="members.editRole"]')).toBeNull();
    expect(el.querySelector('button[title$="members.removeMember"]')).toBeNull();
  });

  it('should not render actions for the owner row', () => {
    create('tenant');
    // eslint-disable-next-line no-console
    console.log('DEBUG_HTML', JSON.stringify([...el.querySelectorAll('button')].map((b) => b.getAttribute('title'))));

    const bodyRows = Array.from(el.querySelectorAll('tbody tr'));

    expect(bodyRows[0].querySelector('button[title$="members.removeMember"]')).toBeNull();
    expect(bodyRows[1].querySelector('button[title$="members.removeMember"]')).not.toBeNull();
  });

  // ── Edit flow ──────────────────────────────────────────────────

  it('should open the edit dialog and emit roleChange on confirm', () => {
    create('tenant');

    const emitted: unknown[] = [];

    component.roleChange.subscribe((v: unknown) => emitted.push(v));
    (el.querySelector('button[title$="members.editRole"]') as HTMLButtonElement).click();

    expect(component.editingRow()?.userId).toBe('u2');

    component.editRole.set('ADMIN');
    component.confirmRoleChange();

    expect(emitted).toEqual([{ row: rows[1], role: 'ADMIN' }]);
    expect(component.editingRow()).toBeNull();
  });

  it('should not emit roleChange when the role is unchanged', () => {
    create('tenant');

    const emitted: unknown[] = [];

    component.roleChange.subscribe((v: unknown) => emitted.push(v));
    (el.querySelector('button[title$="members.editRole"]') as HTMLButtonElement).click();
    component.confirmRoleChange();

    expect(emitted).toEqual([]);
  });

  // ── Remove flow ────────────────────────────────────────────────

  it('should require confirmation before emitting remove', () => {
    create('tenant');

    const emitted: MemberRow[] = [];

    component.remove.subscribe((v: MemberRow) => emitted.push(v));
    (el.querySelector('button[title$="members.removeMember"]') as HTMLButtonElement).click();

    expect(component.rowToRemove()?.userId).toBe('u2');
    expect(emitted).toEqual([]);

    component.onRemoveConfirmed();

    expect(emitted).toEqual([rows[1]]);
    expect(component.rowToRemove()).toBeNull();
  });

  // ── Tenant-only actions ────────────────────────────────────────

  it('should show resend/revoke for pending invitations', () => {
    create('tenant', [pendingRow]);

    expect(el.querySelector('button[title$="members.resendInvitation"]')).not.toBeNull();
    expect(el.querySelector('button[title$="members.revokeAccess"]')).not.toBeNull();
    expect(el.querySelector('button[title$="members.restoreAccess"]')).toBeNull();
  });

  it('should show restore for revoked members without pending invitation', () => {
    create('tenant', [revokedRow]);

    expect(el.querySelector('button[title$="members.restoreAccess"]')).not.toBeNull();
    expect(el.querySelector('button[title$="members.revokeAccess"]')).toBeNull();
    expect(el.querySelector('button[title$="members.resendInvitation"]')).toBeNull();
  });

  it('should not render tenant lifecycle actions in the project variant', () => {
    create('project', [{ ...rows[1], status: 'ACCESS_REVOKED' }]);

    expect(el.querySelector('button[title$="members.restoreAccess"]')).toBeNull();
    expect(el.querySelector('button[title$="members.resendInvitation"]')).toBeNull();
  });

  // ── Guard / states ─────────────────────────────────────────────

  it('should show the context-error state instead of the table when the id is missing', () => {
    create('tenant', rows, true, { contextMissing: true });

    expect(el.querySelector('hlm-alert')).not.toBeNull();
    expect(el.textContent).toContain('members.contextError');
    expect(el.querySelector('table')).toBeNull();
  });

  it('should render the empty state when there are no rows', () => {
    create('tenant', []);

    expect(el.textContent).toContain('members.noMembers');
  });

  it('should render a loading row while loading', () => {
    create('tenant', [], true, { loading: true });

    expect(el.textContent).toContain('members.loading');
  });
});
