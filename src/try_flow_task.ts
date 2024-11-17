import type { TaskObserver } from "./task_observer";

import { FlowTask } from "./flow_task";

/**
 * This flow runs each task in series but stops whenever any of the task were successful and the result of this task will be returned.
 * If all tasks fail, flow throw AggregateException with all errors.
 */
export class TryFlowTask extends FlowTask {
  override async main() {
    const errors: any[] = [];

    await this._iterate(async (observer: TaskObserver): Promise<boolean> => {
      try {
        this.result = await observer.result;
        return true;
      } catch (err) {
        errors.push(err);
      }

      return false;
    });

    if (this.tasks.length === errors.length) {
      throw new AggregateError(errors);
    }
  }
}
