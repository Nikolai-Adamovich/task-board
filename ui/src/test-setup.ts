// Global test setup for Vitest / @angular/build:unit-test

// Polyfill ResizeObserver for jsdom (used by Spartan UI components)
globalThis.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe() {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve() {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect() {}
};
