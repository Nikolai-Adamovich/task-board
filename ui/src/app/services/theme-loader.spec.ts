import { TestBed } from '@angular/core/testing';
import { ThemeLoader } from './theme-loader';

describe('ThemeLoader', () => {
  let loader: ThemeLoader;
  const lastLink = (): HTMLLinkElement => {
    const links = document.head.querySelectorAll<HTMLLinkElement>('link[data-theme]');

    return links[links.length - 1];
  };

  beforeEach(() => {
    document.head.querySelectorAll<HTMLLinkElement>('link[data-theme]').forEach((l) => l.remove());
    TestBed.configureTestingModule({});
    loader = TestBed.inject(ThemeLoader);
  });

  it('loads the theme stylesheet from /themes/<id>.css (no -theme suffix)', async () => {
    const promise = loader.loadTheme('claude');
    const link = lastLink();

    expect(link.href).toContain('/themes/claude.css');
    expect(link.href).not.toContain('-theme.css');
    expect(link.dataset['theme']).toBe('claude');

    link.onload?.(new Event('load'));
    await promise;
  });

  it('removes the previous theme link when switching themes', async () => {
    const first = loader.loadTheme('light');

    lastLink().onload?.(new Event('load'));
    await first;

    const second = loader.loadTheme('nord');
    const nordLink = lastLink();

    expect(nordLink.href).toContain('/themes/nord.css');

    nordLink.onload?.(new Event('load'));
    await second;

    const remaining = document.head.querySelectorAll<HTMLLinkElement>('link[data-theme]');

    expect(remaining.length).toBe(1);
    expect(remaining[0].dataset['theme']).toBe('nord');
  });

  it('rejects when the stylesheet fails to load', async () => {
    const promise = loader.loadTheme('missing-theme');
    const link = lastLink();

    link.onerror?.(new Event('error'));
    await expect(promise).rejects.toThrow('Failed to load theme "missing-theme"');
  });
});
