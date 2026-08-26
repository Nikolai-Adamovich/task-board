/**
 * Tests for the BillingClient mock (DEC-022 billing boundary).
 *
 * Covers:
 * - completeMockCheckout resolves with an active subscription for the given plan
 */
import { vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { BillingClient, CheckoutContext, FREE_PLAN_ID } from './billing-client';

describe('BillingClient', () => {
  let client: BillingClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new BillingClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve an active subscription for the requested plan', async () => {
    const context: CheckoutContext = { workspaceName: 'NewCo', slug: 'newco' };
    const promise = firstValueFrom(client.completeMockCheckout(FREE_PLAN_ID, context));

    vi.advanceTimersByTime(300);

    await expect(promise).resolves.toEqual({ status: 'active', plan: FREE_PLAN_ID });
  });

  it('should not resolve before the simulated round-trip completes', async () => {
    let resolved = false;
    const promise = firstValueFrom(
      client.completeMockCheckout(FREE_PLAN_ID, { workspaceName: 'NewCo', slug: 'newco' }),
    ).then((result) => {
      resolved = true;

      return result;
    });

    vi.advanceTimersByTime(100);
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(200);
    await promise;
    expect(resolved).toBe(true);
  });
});
