import { firstValueFrom } from 'rxjs';
/**
 * Tests for the MilkdownEditor component.
 *
 * Covers:
 * - Component creation
 * - Fallback mode activation
 * - Content input/output
 * - Raw textarea behavior
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { MilkdownEditor } from './milkdown-editor';
import { settle } from '@app/shared/testing/zoneless';

describe('MilkdownEditor', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;

  async function setup(content = '') {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ preloadLangs: true, langs: { en: {} } })],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const fixture = TestBed.createComponent(MilkdownEditor);

    fixture.componentRef.setInput('content', content);
    component = fixture.componentInstance;
    await settle(fixture);
  }

  it('should be created', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('should reach ready or fallback state after initialization', async () => {
    // afterNextRender + lazy Milkdown import settle asynchronously; in the
    // test env Milkdown cannot mount, so the component must end up in
    // fallback mode.
    await setup('Hello world');

    for (let i = 0; i < 100 && !component.editorReady() && !component.fallbackMode(); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(component.fallbackMode() || component.editorReady()).toBe(true);
  });

  it('should set fallbackContent from input', async () => {
    await setup('# Test');
    expect(component.fallbackContent()).toBe('# Test');
  });

  it('should emit contentChange on raw textarea input', async () => {
    await setup('');

    const emitted: string[] = [];

    component.contentChange.subscribe((v: string) => emitted.push(v));

    const event = { target: { value: 'new content' } } as unknown as Event;

    component.onRawInput(event);
    expect(emitted).toEqual(['new content']);
    expect(component.fallbackContent()).toBe('new content');
  });

  it('should handle empty content gracefully', async () => {
    await setup();
    expect(component.fallbackContent()).toBe('');
  });
});
