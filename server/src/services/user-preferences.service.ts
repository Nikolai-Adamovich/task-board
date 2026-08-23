import type { UserProjectBoardPreference, UpdateUserProjectBoardPreference } from '@task-board/shared';
import { NotFoundError } from '../errors/app-error.js';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';

export interface UserPreferencesServiceBoardRepo {
  findById(id: string): Promise<{ id: string; projectId: string } | null>;
}

export class UserPreferencesService {
  constructor(
    private readonly prefsRepo: UserPreferencesRepository,
    private readonly boardRepo: UserPreferencesServiceBoardRepo,
  ) {}

  async getPreferences(userId: string, projectId: string): Promise<UserProjectBoardPreference | null> {
    return this.prefsRepo.findByUserAndProject(userId, projectId);
  }

  async updatePreferences(
    userId: string,
    projectId: string,
    input: UpdateUserProjectBoardPreference,
  ): Promise<UserProjectBoardPreference> {
    // Validate defaultBoardId belongs to the same project
    if (input.defaultBoardId) {
      const board = await this.boardRepo.findById(input.defaultBoardId);

      if (!board || board.projectId !== projectId) {
        throw new NotFoundError(`Board ${input.defaultBoardId} not found in project ${projectId}`);
      }
    }

    return this.prefsRepo.upsert(userId, projectId, input);
  }
}
