import { Component, input, output } from '@angular/core';
import type { Task } from '@task-board/shared';
import { PriorityColorMap, NeutralColor } from '@app/constants/priority';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';

@Component({
  selector: 'ui-task-card',
  imports: [HlmBadgeImports, HlmAvatarImports],
  host: {
    class: 'block',
    draggable: 'true',
    '(dragstart)': 'onDragStart($event)',
  },
  templateUrl: './task-card.html',
})
export class TaskCard {
  readonly task = input.required<Task>();
  readonly taskClick = output<Task>();
  readonly dragStart = output<{ task: Task; dragEvent: DragEvent }>();

  protected priorityColor(): string {
    return (PriorityColorMap as Record<string, string>)[this.task().priority] ?? NeutralColor;
  }

  protected onDragStart(event: DragEvent): void {
    this.dragStart.emit({ task: this.task(), dragEvent: event });
  }
}
