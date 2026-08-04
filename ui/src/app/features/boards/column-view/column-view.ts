import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import type { Column, Task } from '@task-board/shared';
import { TaskCard } from '../task-card/task-card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'ui-column-view',
  imports: [TaskCard, TranslocoPipe, NgIcon, HlmButtonImports, HlmBadgeImports],
  providers: [provideIcons({ lucidePlus })],
  host: {
    class: 'flex h-full min-w-[280px] max-w-[320px] flex-col rounded-lg border border-border bg-muted/30',
  },
  templateUrl: './column-view.html',
})
export class ColumnView {
  readonly column = input.required<Column>();
  readonly tasks = input.required<Task[]>();
  readonly showAddButton = input(true);
  readonly addTask = output<Column>();
  readonly taskClick = output<Task>();
  readonly taskDrop = output<{ task: Task; targetColumnId: string }>();

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const target = event.currentTarget as HTMLElement;

    target.classList.add('bg-primary/5');
  }

  protected onDragLeave(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;

    target.classList.remove('bg-primary/5');
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;

    target.classList.remove('bg-primary/5');

    const taskData = event.dataTransfer?.getData('application/json');

    if (taskData) {
      const task = JSON.parse(taskData) as Task;

      this.taskDrop.emit({ task, targetColumnId: this.column().id });
    }
  }

  protected onTaskDragStart(event: { task: Task; dragEvent: DragEvent }): void {
    if (event.dragEvent.dataTransfer) {
      event.dragEvent.dataTransfer.setData('application/json', JSON.stringify(event.task));
      event.dragEvent.dataTransfer.effectAllowed = 'move';
    }
  }
}
