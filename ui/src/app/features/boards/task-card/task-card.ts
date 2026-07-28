import { Component, input, output } from '@angular/core';
import type { Task } from '@task-board/shared';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';

const priorityColorMap: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

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
  readonly click = output<Task>();
  readonly dragStart = output<{ task: Task; dragEvent: DragEvent }>();

  protected priorityColor(): string {
    return priorityColorMap[this.task().priority] ?? 'bg-gray-100 text-gray-700';
  }

  protected onDragStart(event: DragEvent): void {
    this.dragStart.emit({ task: this.task(), dragEvent: event });
  }
}
