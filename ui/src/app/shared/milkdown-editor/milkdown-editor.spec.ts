/**
 * Tests for the MilkdownEditor component.
 *
 * Covers:
 * - Component creation
 * - Fallback mode activation
 * - Content input/output
 * - Textarea fallback behavior
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MilkdownEditor } from './milkdown-editor';

describe('MilkdownEditor', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  function setup(content = '') {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const fixture = TestBed.createComponent(MilkdownEditor);

    fixture.componentRef.setInput('content', content);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should be created', () => {
    setup();
    expect(component).toBeTruthy();
  });

  it('should initialize with loading state', async () => {
    // In test environment, afterNextRender fires asynchronously
    setup('Hello world');
    // Wait for afterNextRender to complete
    await new Promise((r) => setTimeout(r, 0));
    expect(component.fallbackMode()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should set fallbackContent from input', () => {
    setup('# Test');
    expect(component.fallbackContent()).toBe('# Test');
  });

  it('should emit contentChange on textarea input', () => {
    setup('');

    const emitted: string[] = [];

    component.contentChange.subscribe((v: string) => emitted.push(v));

    const event = { target: { value: 'new content' } } as unknown as Event;

    component.onFallbackInput(event);
    expect(emitted).toEqual(['new content']);
    expect(component.fallbackContent()).toBe('new content');
  });

  it('should handle empty content gracefully', () => {
    setup();
    expect(component.fallbackContent()).toBe('');
  });
});
