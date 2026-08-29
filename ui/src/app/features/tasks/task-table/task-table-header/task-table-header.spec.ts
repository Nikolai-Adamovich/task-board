/**
 * Tests for the TaskTableHeader sub-component (M-13 / 4.2):
 *
 * - Renders the search input with the buffered value + shortcut target attribute
 * - Emits the raw input event on keystrokes (parent owns the debounce)
 * - Emits openFilters / toggleDensity / createTask from the toolbar buttons
 * - Hides the New Task control for users who cannot write
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TaskTableHeader } from './task-table-header';

describe('TaskTableHeader', () => {
  let fixture: ComponentFixture<TaskTableHeader>;
  let component: TaskTableHeader;

  function setup(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });

    fixture = TestBed.createComponent(TaskTableHeader);

    Object.entries(inputs).forEach(([key, value]) => {
      fixture.componentRef.setInput(key, value);
    });

    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should render the search input with the buffered value and shortcut target', () => {
    setup({ searchValue: 'hello' });

    const input = fixture.debugElement.query(By.css('input[data-task-table-search]'));

    expect(input).toBeTruthy();
    expect(input.nativeElement.value).toBe('hello');
  });

  it('should emit the raw input event on keystrokes', () => {
    setup();

    const emitted: Event[] = [];

    component.searchInput.subscribe((e) => emitted.push(e));

    const input = fixture.debugElement.query(By.css('input[data-task-table-search]'));

    input.triggerEventHandler('input', { target: { value: 'foo' } });

    expect(emitted.length).toBe(1);
  });

  it('should emit openFilters and toggleDensity from the toolbar buttons', () => {
    setup();

    let filters = 0;
    let density = 0;

    component.openFilters.subscribe(() => filters++);
    component.toggleDensity.subscribe(() => density++);

    const buttons = fixture.debugElement.queryAll(By.css('button'));

    buttons[0]?.nativeElement.click();
    buttons[1]?.nativeElement.click();

    expect(filters).toBe(1);
    expect(density).toBe(1);
  });

  it('should hide the New Task control for users who cannot write', () => {
    setup({ canCreateTasks: false });

    expect(fixture.debugElement.queryAll(By.css('button')).length).toBe(2);
  });

  it('should emit createTask from the New Task button', () => {
    setup({ canCreateTasks: true });

    let created = 0;

    component.createTask.subscribe(() => created++);

    const buttons = fixture.debugElement.queryAll(By.css('button'));

    expect(buttons.length).toBe(3);

    buttons[2]?.nativeElement.click();

    expect(created).toBe(1);
  });
});
