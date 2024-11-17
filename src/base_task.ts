/* eslint-disable class-methods-use-this */

import { isPropertyDefined } from "@unwanted/common";

import type { TaskManager } from "./manager";
import type { TaskObserver } from "./task_observer";

import { MANAGER_SYMBOL, OBSERVER_SYMBOL } from "./common";

export const isTask = (obj: any) => isPropertyDefined(obj, "main") && isPropertyDefined(obj, "_run");

export class BaseTask {
  [MANAGER_SYMBOL]: TaskManager | null;
  [OBSERVER_SYMBOL]: TaskObserver | null;

  // The result of the task execution should be stored in this variable.
  public result: any;

  constructor() {
    this[MANAGER_SYMBOL] = null;
    this[OBSERVER_SYMBOL] = null;
  }

  get observer(): TaskObserver {
    if (this[OBSERVER_SYMBOL] === null) {
      throw new Error("Undefined observer");
    }
    return this[OBSERVER_SYMBOL] as TaskObserver;
  }

  get manager(): TaskManager {
    if (this[MANAGER_SYMBOL] === null) {
      throw new Error("Undefined task manager");
    }
    return this[MANAGER_SYMBOL] as TaskManager;
  }

  /**
   * Actual task implementation.
   *
   * @return {any}
   */
  main(...args: any[]): any {
    throw new Error("Not implemented");
  }

  /**
   * This method that the manager actually calls when performing the task.
   *
   * If you need some custom steps before the actual task's code run, you should override this method.
   *
   * @param  {...any} args
   */
  async _run(...args: any[]): Promise<any> {
    await this.main(...args);
    return this.result;
  }

  /**
   * Suspends task.
   */
  suspend(...args: any[]): void | Promise<void> {}

  /**
   * Resumes task.
   */
  resume(...args: any[]): void | Promise<void> {}

  /**
   * Cancels task.
   */
  cancel(...args: any[]): void | Promise<void> {}

  /**
   * Undo task.
   */
  undo(err?: any): void | Promise<void> {}
}
