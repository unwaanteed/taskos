import { isObject } from "@unwanted/common";

import type { BaseTask } from "./base_task";

export enum TaskState {
  IDLE = 0,
  STARTING = 1,
  RUNNING = 2,
  SUSPENDED = 3,
  CANCELLING = 4,
  CANCELLED = 5,
  FAILED = 6,
  COMPLETED = 7,
}

export enum TaskLoadPolicy {
  THROW = "throw",
  IGNORE = "ignore",
  REPLACE = "replace",
}

export type TaskRunner = (...args: any[]) => any;


export interface TaskOptions {
  name?: string;
  description?: string;
  suspendable?: boolean;
  cancelable?: boolean;
  concurrency?: number;
  interval?: number;
  singleton?: boolean;
  task?: any;
  loadPolicy?: TaskLoadPolicy;
}
export interface TaskInfo {
  name: string;
  description?: string;
  throttled: (instance: BaseTask, args: any[]) => any;
  suspendable: boolean;
  cancelable: boolean;
  singleton: boolean;
  Class?: any;
  zombi?: boolean;
  runner: TaskRunner;
  runners: Set<TaskRunner>;
  [k: string]: any;
}

export const MANAGER_SYMBOL = Symbol.for("rs:manager");
export const OBSERVER_SYMBOL = Symbol.for("rs:observer");

// Decorators
const TASK_ANNOTATION = "rs:task";

// @ts-ignore
const setTaskMeta = (target: any, info: any) => Reflect.defineMetadata(TASK_ANNOTATION, info, target);
// @ts-ignore
export const getTaskMeta = (target: any) => Reflect.getMetadata(TASK_ANNOTATION, target);

export const Task =
  (taskInfo = {}) =>
  (target: any) => {
    const info = getTaskMeta(target);
    if (info === undefined) {
      setTaskMeta(target, taskInfo);
    } else if (isObject(info)) {
      Object.assign(info, taskInfo);
    } else {
      setTaskMeta(target, taskInfo);
    }
  };
