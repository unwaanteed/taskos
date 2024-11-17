import type { Deferred } from "@unwanted/promise";

import type { TaskObserver } from "./task_observer";

import { FlowTask } from "./flow_task";

/**
 * This flow run the tasks in series, each one running once the previous task has completed.
 * If any task in the series throw, no more tasks are run.
 * If all tasks has finished, the result will be an array of all tasks results.
 */
export default class SeriesFlowTask extends FlowTask {
  private _cancelDefer?: Deferred;

  override async main() {
    this.result = [];

    await this._iterate(async (observer: TaskObserver): Promise<boolean> => {
      let complete = false;

      const shouldCancel = () => {
        if (observer.cancelable) {
          if (this._cancelDefer) {
            observer.cancel();
          }
          if (!complete) {
            setTimeout(shouldCancel, 100);
          }
        }
      };

      shouldCancel();

      this.result.push(await observer.result);

      complete = true;

      return false;
    });

    if (this._cancelDefer) {
      this._cancelDefer.resolve?.();
    }
  }

  override async cancel(defer: Deferred) {
    this._cancelDefer = defer;
  }
}
