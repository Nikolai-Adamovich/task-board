import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CounterService } from './counter.service.js';

function createMockCounterRepo() {
  return {
    getNextValue: vi.fn(),
    getCurrentValue: vi.fn(),
  };
}

describe('CounterService', () => {
  let counterRepo: ReturnType<typeof createMockCounterRepo>;
  let service: CounterService;

  beforeEach(() => {
    counterRepo = createMockCounterRepo();
    service = new CounterService(counterRepo as never);
  });

  describe('getNextTaskNumber', () => {
    it('returns 1 for the first call', async () => {
      counterRepo.getNextValue.mockResolvedValue(1);

      const result = await service.getNextTaskNumber('proj-1');

      expect(counterRepo.getNextValue).toHaveBeenCalledWith('taskNumber:proj-1');
      expect(result).toBe(1);
    });

    it('returns sequential numbers on subsequent calls', async () => {
      counterRepo.getNextValue.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);

      expect(await service.getNextTaskNumber('proj-1')).toBe(1);
      expect(await service.getNextTaskNumber('proj-1')).toBe(2);
      expect(await service.getNextTaskNumber('proj-1')).toBe(3);
    });

    it('uses different keys for different projects', async () => {
      counterRepo.getNextValue.mockResolvedValue(1);

      await service.getNextTaskNumber('proj-1');
      await service.getNextTaskNumber('proj-2');

      expect(counterRepo.getNextValue).toHaveBeenNthCalledWith(1, 'taskNumber:proj-1');
      expect(counterRepo.getNextValue).toHaveBeenNthCalledWith(2, 'taskNumber:proj-2');
    });
  });
});
