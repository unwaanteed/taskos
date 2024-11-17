import { isPromise } from "@unwanted/common";

import type { TaskObserver } from "./task_observer";

import { FlowTask } from "./flow_task";

/**
 * This flow run the tasks in parallel, without waiting until the previous task has completed.
 * If any of the task throw, the remaining tasks will continue to be performed, but in this case results of these tasks will be unavailable.
 * Once the tasks have completed, the results are passed as object where keys are names of the tasks and values are results.
 */
export default class ParallelFlowTask extends FlowTask {
  override async main(): Promise<void> {
    this.result = [];
    const promises: Promise<any>[] = [];
    await this._iterate((observer: TaskObserver): boolean => {
      let { result } = observer;
      if (!isPromise(result)) {
        result = Promise.resolve(result);
      }

      result
        .then((r: any) => {
          this.result.push(r);
        })
        .catch(() => {});
      promises.push(result);

      return false;
    });

    await Promise.all(promises);
  }

  /**
   * Cancel only cancelable tasks and await result of non-cancelable.
   */
  override cancel(defer: any) {
    const promises: Promise<any>[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const observer of this.observers) {
      if (observer.cancelable) {
        promises.push(observer.cancel());
      } else {
        promises.push(observer.result);
      }
    }

    return Promise.all(promises).then(() => defer.resolve());
  }
}
