import { Component, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { inject } from '@angular/core';
import type { Task } from '@task-board/shared';
import { priorityBadgeVariant, priorityLabelKey, type BadgeVariant } from '@app/constants/priority';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';

@Component({
  selector: 'ui-task-card',
  imports: [TranslocoPipe, HlmBadgeImports, HlmAvatarImports],
  host: {
    class: 'block',
    draggable: 'true',
    '(dragstart)': 'onDragStart($event)',
  },
  templateUrl: './task-card.html',
})
export class TaskCard {
  readonly task = input.required<Task>();
  readonly projectKey = input<string>('');
  readonly taskClick = output<Task>();
  readonly dragStart = output<{ task: Task; dragEvent: DragEvent }>();
  private readonly i18n = inject(TranslocoService);

  /** Translated priority label (P11); unknown values render verbatim. */
  protected priorityLabel(priority: string): string {
    const key = priorityLabelKey(priority);

    return key ? this.i18n.translate(key) : priority;
  }

  protected priorityVariant(): BadgeVariant {
    return priorityBadgeVariant(this.task().priority);
  }

  protected taskLabel(): string {
    const key = this.projectKey();
    const num = this.task().number;

    return key ? `${key}-${num}` : `#${num}`;
  }

  protected assigneeInitials(): string {
    const snap = this.task().assigneeSnapshot;

    if (!snap?.displayName) return '?';

    return snap.displayName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  protected onDragStart(event: DragEvent): void {
    this.dragStart.emit({ task: this.task(), dragEvent: event });
  }
}
