import { Component, inject, input, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { ProjectClient } from '../../../services/project-client';
import { BoardClient } from '../../../services/board-client';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { NgIcon } from '@ng-icons/core';
import type { Project, Board, ProjectMember, CreateBoard } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

@Component({
  selector: 'app-project-detail',
  imports: [
    RouterLink,
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
    HlmAvatarImports,
  ],
  providers: [provideIcons({ lucidePlus })],
  templateUrl: './project-detail.html',
})
export class ProjectDetail implements OnInit {
  private readonly projectService = inject(ProjectClient);
  private readonly boardService = inject(BoardClient);

  /** Bound via withComponentInputBinding() */
  readonly projectId = input.required<string>();

  protected readonly project = signal<Project | null>(null);
  protected readonly boards = signal<Board[]>([]);
  protected readonly members = signal<ProjectMember[]>([]);
  protected readonly loading = signal(true);
  protected readonly showCreateBoard = signal(false);
  protected readonly creatingBoard = signal(false);
  protected newBoard: CreateBoard = { name: '', description: '' };

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateBoard.set(false);
    }
  }

  ngOnInit(): void {
    this.loadProject();
  }

  private loadProject(): void {
    this.loading.set(true);
    this.projectService.getById(this.projectId()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loadBoards();
        this.loadMembers();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadBoards(): void {
    this.boardService.list(this.projectId()).subscribe({
      next: (res) => this.boards.set(res.data),
    });
  }

  private loadMembers(): void {
    this.projectService.listMembers(this.projectId()).subscribe({
      next: (res) => this.members.set(res.data),
    });
  }

  protected createBoard(): void {
    if (!this.newBoard.name) return;
    this.creatingBoard.set(true);
    this.boardService.create(this.projectId(), this.newBoard).subscribe({
      next: (board) => {
        this.boards.update((list) => [...list, board]);
        this.showCreateBoard.set(false);
        this.newBoard = { name: '', description: '' };
        this.creatingBoard.set(false);
      },
      error: () => this.creatingBoard.set(false),
    });
  }
}
