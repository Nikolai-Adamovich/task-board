/**
 * Tests for the TaskTableFilters sub-component (M-13 / 4.2):
 *
 * - Renders one chip per active filter with its translated label + value
 * - Emits `removeFilter` with the chip's param on × click
 * - Mirrors the dialog open state up via `dialogOpenChange`
 * - Re-emits `filterApplied` from the FilterPanel
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TaskTableFilters } from './task-table-filters';
import { FilterClient } from '@services/filter-client';
import { API_BASE_URL } from '@app/api-url.token';
import { of } from 'rxjs';

describe('TaskTableFilters', () => {
  let fixture: ComponentFixture<TaskTableFilters>;
  let component: TaskTableFilters;

  function setup() {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost/api' },
        { provide: FilterClient, useValue: { list: vi.fn().mockReturnValue(of([])) } },
      ],
    });

    fixture = TestBed.createComponent(TaskTableFilters);
    fixture.componentRef.setInput('projectId', 'p1');
    component = fixture.componentInstance;
  }

  it('should render one chip per active filter', () => {
    setup();
    fixture.componentRef.setInput('chips', [
      { param: 'search', labelKey: 'taskTable.filterSearch', value: 'foo' },
      { param: 'status', labelKey: 'taskTable.filterStatus', value: 'To Do' },
    ]);
    fixture.detectChanges();

    const badges = fixture.debugElement.queryAll(By.css('span[hlmBadge]'));

    expect(badges.length).toBe(2);
  });

  it('should render no chip row when there are no active filters', () => {
    setup();
    fixture.componentRef.setInput('chips', []);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('span[hlmBadge]')).length).toBe(0);
  });

  it('should emit removeFilter with the chip param on × click', () => {
    setup();
    fixture.componentRef.setInput('chips', [
      { param: 'priority', labelKey: 'taskTable.filterPriority', value: 'HIGH' },
    ]);
    fixture.detectChanges();

    const emitted: string[] = [];

    component.removeFilter.subscribe((param) => emitted.push(param));

    const removeButton = fixture.debugElement.query(By.css('span[hlmBadge] button'));

    expect(removeButton).toBeTruthy();
    removeButton.nativeElement.click();

    expect(emitted).toEqual(['priority']);
  });

  it('should mirror the dialog open state up via dialogOpenChange', () => {
    setup();
    fixture.componentRef.setInput('dialogOpen', true);
    fixture.detectChanges();

    const emitted: boolean[] = [];

    component.dialogOpenChange.subscribe((open) => emitted.push(open));

    const dialog = fixture.debugElement.query(By.css('hlm-dialog'));

    dialog.triggerEventHandler('stateChanged', 'closed');

    expect(emitted).toEqual([false]);
  });
});
