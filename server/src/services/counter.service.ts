import { CounterRepository } from '../repositories/counter.repository.js';

// ─── Counter Service ─────────────────────────────────────────────────────────

/**
 * Wraps CounterRepository with business logic for sequential number generation.
 * Used for task numbers within a project.
 */
export class CounterService {
  constructor(private readonly counterRepo: CounterRepository) {}

  /**
   * Get the next sequential task number for a project.
   * Uses atomic MongoDB $inc with upsert for concurrency safety.
   */
  async getNextTaskNumber(projectId: string): Promise<number> {
    return this.counterRepo.getNextValue(`taskNumber:${projectId}`);
  }
}
