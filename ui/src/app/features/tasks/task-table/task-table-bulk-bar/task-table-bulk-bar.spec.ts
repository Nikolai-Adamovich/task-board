/**
 * Tests for the TaskTableBulkBar sub-component (M-13 / 4.2):
 *
 * - Renders the selection count and the three bulk-field selects
 * - Emits field changes (status/assignee/sprint)
 * - Disables Apply while the exactly-one-field contract is violated
 * - Emits `apply` and `clear` from the buttons
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TaskTableBulkBar } from './task-table-bulk-bar';

describe('TaskTableBulkBar', () => {
  let fixture: ComponentFixture<TaskTableBulkBar>;
  let component: TaskTableBulkBar;

  function setup(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              'taskTable.bulk.selected': 'Selected: {{count}}',
              'taskTable.bulk.apply': 'Apply',
              'taskTable.bulk.clear': 'Clear',
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });

    fixture = TestBed.createComponent(TaskTableBulkBar);
    fixture.componentRef.setInput('selectedCount', 2);

    Object.entries(inputs).forEach(([key, value]) => {
      fixture.componentRef.setInput(key, value);
    });

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** The Apply / Clear buttons — hlm-select triggers render <button> elements too */
  function actionButtons() {
    return fixture.debugElement
      .queryAll(By.css('button'))
      .filter((el) => ['Apply', 'Clear'].includes((el.nativeElement.textContent as string).trim()));
  }

  it('should render the selection count', () => {
    setup();

    expect(fixture.nativeElement.textContent).toContain('Selected: 2');
  });

  it('should render the three bulk-field selects', () => {
    setup();

    expect(fixture.debugElement.queryAll(By.css('hlm-select')).length).toBe(3);
  });

  it('should emit field changes from the selects', () => {
    setup();

    const status: string[] = [];
    const assignee: string[] = [];
    const sprint: string[] = [];

    component.statusChange.subscribe((v) => status.push(v));
    component.assigneeChange.subscribe((v) => assignee.push(v));
    component.sprintChange.subscribe((v) => sprint.push(v));

    const selects = fixture.debugElement.queryAll(By.css('hlm-select'));

    selects[0]?.triggerEventHandler('valueChange', 'st1');
    selects[1]?.triggerEventHandler('valueChange', 'u1');
    selects[2]?.triggerEventHandler('valueChange', 's1');

    expect(status).toEqual(['st1']);
    expect(assignee).toEqual(['u1']);
    expect(sprint).toEqual(['s1']);
  });

  it('should disable Apply when the exactly-one-field contract is violated', () => {
    setup({ canApply: false });

    const applyButton = actionButtons()[0];

    expect(applyButton?.nativeElement.disabled).toBe(true);
  });

  it('should disable Apply while a bulk update is in flight', () => {
    setup({ canApply: true, applying: true });

    const applyButton = actionButtons()[0];

    expect(applyButton?.nativeElement.disabled).toBe(true);
  });

  it('should enable Apply when exactly one field is chosen and not applying', () => {
    setup({ canApply: true, applying: false });

    expect(actionButtons()[0]?.nativeElement.disabled).toBe(false);
  });

  it('should emit apply and clear from the buttons', () => {
    setup({ canApply: true });

    let applied = 0;
    let cleared = 0;

    component.apply.subscribe(() => applied++);
    component.clear.subscribe(() => cleared++);

    const [applyButton, clearButton] = actionButtons();

    applyButton?.nativeElement.click();
    clearButton?.nativeElement.click();

    expect(applied).toBe(1);
    expect(cleared).toBe(1);
  });
});
