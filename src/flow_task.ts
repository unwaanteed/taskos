/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { isObject } from "@unwanted/common";

import type { TaskManager } from "./manager";
import type { TaskObserver } from "./task_observer";

import { IsomorphicTask } from "./isomorphic_task";

export const isFlowTask = (obj: any) => obj instanceof FlowTask;
const normalizeAndCheck = (manager: TaskManager, tasks: any[]) => {
  const result: any[] = [];
  for (const t of tasks) {
    let item;
    if (typeof t === "string" || typeof t === "function") {
      item = {
        task: t,
      };
    } else if (isObject(t)) {
      if (t.task == null) {
        throw new Error("Missing task property");
      }
      item = t;
    } else {
      throw new Error("Invalid type of task.");
    }

    if (typeof item.task === "string") {
      if (!manager.hasTask(item.task)) {
        throw new Error(`Task '${item.task}' not exists`);
      }
    }

    result.push(item);
  }

  return result;
};

/**
 * This task implements common logic for running flows.
 *
 * See other flow tasks for details.
 */
export class FlowTask extends IsomorphicTask {
  public tasks: any[] = [];
  private arg: any;
  public observers: TaskObserver[] = [];

  override async _run(...args: any[]) {
    const taskData = this._validateArgs(args);

    this.tasks = normalizeAndCheck(this.manager, taskData.tasks);
    this.arg = taskData.arg;
    this.observers = [];

    await this.main(this.arg);
    return this.result;
  }

  async _iterate(handler: (o: TaskObserver) => boolean | Promise<boolean>) {
    for (const t of this.tasks) {
      const observer = await this._runTask(t.task, { ...t.args, ...(this.arg || {}) });
      this.observers.push(observer);

      if (await handler(observer)) {
        break;
      }
    }
  }

  _runTask(task: any, arg: any) {
    if (typeof task === "string") {
      return this.manager.run(task, arg);
    }
    if (typeof task === "function") {
      return this.manager.runOnce(task, arg);
    }

    throw new Error("Invalid type of task");
  }
}
