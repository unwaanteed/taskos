import { FlowTask } from "./flow_task";

/**
 * This flow runs the tasks in series, but result of each task passing to the next task in the array.
 * If any task in the series throw, no more tasks are run.
 * If all tasks has finished, result of the last task will be returned.
 */
export class WaterfallFlowTask extends FlowTask {
  override async main(arg: any) {
    this.result = arg;

    // eslint-disable-next-line no-restricted-syntax
    for (const t of this.tasks) {
      // eslint-disable-next-line no-await-in-loop
      const observer = await this._runTask(t.task, this.result);
      // eslint-disable-next-line no-await-in-loop
      this.result = await observer.result;
    }
  }
}
