import type { TaskObserver } from "./task_observer";

import { FlowTask } from "./flow_task";

/**
 * This flow run the tasks in parallel, and returns the result of first completed task or throw if task is rejected.
 */
export class RaceFlowTask extends FlowTask {
  override async main() {
    const promises: Promise<any>[] = [];

    await this._iterate((observer: TaskObserver): boolean => {
      promises.push(observer.result);

      return false;
    });

    this.result = Promise.race(promises);
  }
}
