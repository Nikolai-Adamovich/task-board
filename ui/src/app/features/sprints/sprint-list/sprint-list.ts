import { Component, inject, input, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideCalendar, lucideChevronRight } from '@ng-icons/lucide';
import { SprintClient } from '../../../services/sprint-client';
import { AuthStore } from '../../../stores/auth-store';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon } from '@ng-icons/core';
import type { Sprint, CreateSprint } from '@task-board/shared';
import type { BrnDialogState } from '@spartan-ng/brain/dialog';

const statusColorMap: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
};

@Component({
  selector: 'ui-sprint-list',
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmBadgeImports,
  ],
  providers: [provideIcons({ lucidePlus, lucideCalendar, lucideChevronRight })],
  templateUrl: './sprint-list.html',
})
export class SprintList implements OnInit {
  private readonly sprintService = inject(SprintClient);
  private readonly authStore = inject(AuthStore);
  /** Bound via withComponentInputBinding() */
  readonly projectId = input.required<string>();
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly showCreateModal = signal(false);
  protected startDateStr = '';
  protected endDateStr = '';
  protected newSprint: Omit<CreateSprint, 'startDate' | 'endDate'> & {
    startDate?: string;
    endDate?: string;
  } = { name: '', goal: '' };

  protected canCreate(): boolean {
    return !!this.authStore.currentUser();
  }

  protected getStatusColor(status: string): string {
    return statusColorMap[status] ?? 'bg-gray-100 text-gray-700';
  }

  protected onDialogStateChange(state: BrnDialogState): void {
    if (state === 'closed') {
      this.showCreateModal.set(false);
    }
  }

  ngOnInit(): void {
    this.loadSprints();
  }

  private loadSprints(): void {
    this.loading.set(true);
    this.sprintService.list(this.projectId()).subscribe({
      next: (res) => {
        this.sprints.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected createSprint(): void {
    if (!this.newSprint.name || !this.startDateStr || !this.endDateStr) return;
    this.creating.set(true);

    const data: CreateSprint = {
      name: this.newSprint.name,
      startDate: new Date(this.startDateStr).toISOString(),
      endDate: new Date(this.endDateStr).toISOString(),
      goal: this.newSprint.goal,
    };

    this.sprintService.create(this.projectId(), data).subscribe({
      next: (sprint) => {
        this.sprints.update((list) => [...list, sprint]);
        this.showCreateModal.set(false);
        this.newSprint = { name: '', goal: '' };
        this.startDateStr = '';
        this.endDateStr = '';
        this.creating.set(false);
      },
      error: () => this.creating.set(false),
    });
  }
}
