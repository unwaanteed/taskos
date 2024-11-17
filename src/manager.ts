/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */

import type { Service, RegisterOptions } from "ts-node";

import * as upath from "upath";
import pThrottle from "p-throttle";
import { isRegExp } from "util/types";
import { omit } from "@unwanted/omit";
import { sync as resolve } from "resolve";
import { customAlphabet } from "nanoid-cjs";
import * as promise from "@unwanted/promise";
import { AsyncEventEmitter } from "@unwanted/async-emitter";
import { stat, unlink, readdir, readFile, writeFile } from "fs/promises";
import {
  noop,
  truly,
  isClass,
  identity,
  isNumber,
  isObject,
  isString,
  isBoolean,
  isPromise,
  isPlainObject,
} from "@unwanted/common";

import type { TaskInfo, TaskOptions } from "./common";

import { isTask, BaseTask } from "./base_task";
import { TaskObserver } from "./task_observer";
import { TaskState, getTaskMeta, MANAGER_SYMBOL, TaskLoadPolicy } from "./common";

export const isTaskManager = (obj: any) => obj instanceof TaskManager;

const SUPPORTED_EXTS = [".js", ".mjs", ".ts"];

interface LoadFromOptions {
  filter?: RegExp | ((fileName: string) => boolean);
  [k: string]: any;
}

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz", 8);

// eslint-disable-next-line symbol-description
const ANY_EVENT = Symbol();

const DUMMY_THROTTLE = (instance: BaseTask, args: any[]) => instance._run(...args);

const getOptionValue = (arg: any, meta: any, predicate: (key: any) => boolean, def: any) =>
  predicate(arg) ? arg : predicate(meta) ? meta : def;

/**
 * Basic implementation of task manager that owns and manages tasks.
 *
 *
 *
 * To implement more advanced manager you should inherit this class.
 */
export class TaskManager extends AsyncEventEmitter {
  static DEFAULT_LOAD_POLICY = TaskLoadPolicy.THROW;

  private tsService?: Service;

  private tasks = new Map<string, TaskInfo>();

  private eventObservers = new Map();

  constructor() {
    super();
    this.eventObservers.set(ANY_EVENT, []);
  }

  /**
   * Adds or replaces task with specified name.
   *
   * @param {string} name task name
   * @param {class|function} task task class inherited from {BaseTask} or function
   * @param {object} options
   */
  addTask(options: TaskOptions) {
    if (isClass(options.task)) {
      // eslint-disable-next-line new-cap
      const taskInstance = new options.task();

      if (!isTask(taskInstance)) {
        throw new Error("Invalid task");
      }
    } else if (typeof options.task !== "function") {
      throw new Error("Invalid task");
    }

    let name;
    if (typeof options.name !== "string") {
      const meta = getTaskMeta(options.task);
      if (typeof meta === "string") {
        name = meta;
      } else if (isObject(meta)) {
        name = meta.name;
      }

      if (!name && isClass(options.task)) {
        name = options.task.name;
      }

      if (!name) {
        throw new Error(`Invalid name of task: ${name}`);
      }
    } else {
      name = options.name;
    }

    const hasTask = this.tasks.has(name);

    if (options.loadPolicy === TaskLoadPolicy.THROW) {
      if (hasTask) {
        throw new Error(`Task already exists: ${name}`);
      }
    } else if (options.loadPolicy === TaskLoadPolicy.IGNORE) {
      if (hasTask) {
        return false;
      }
    } else if (options.loadPolicy === TaskLoadPolicy.REPLACE) {
      // Nothing to do...
      // But, in this case we need check previous task state and if task is busy we should wait for it completion.
    }

    const taskInfo = this._initTaskInfo(name, options.task, options);

    let TaskClass;
    if (isClass(options.task)) {
      TaskClass = options.task;
    } else if (typeof options.task === "function") {
      TaskClass = class extends BaseTask {
        override main(...args: any[]) {
          return options.task.apply(this, args);
        }
      };
    } else {
      throw new Error("Invalid task");
    }

    taskInfo.Class = TaskClass;
    return this._installTask(name, taskInfo);
  }

  /**
   * Loads tasks from specified location(s).
   *
   * @param {string|array} path  list of locations from which tasks be loaded
   * @param {string} options.policy load policy:
   * - throw (default): throw an exception if a task with the same name is already loaded
   * - ignore: ignore tasks of the same name
   * - replace: replace loaded task by newtask with same name
   */
  async loadTasksFrom(path: string | string[], options?: LoadFromOptions) {
    let paths;
    if (typeof path === "string") {
      paths = [path];
    } else if (Array.isArray(path)) {
      paths = path;
    } else {
      throw new Error("Invalid 'path' argument");
    }

    for (const p of paths as string[]) {
      let st;
      try {
        // Check for existing
        st = await stat(p);
      } catch (err) {
        continue;
      }

      let files;
      if (await st.isDirectory()) {
        files = await readdir(p);
      } else {
        files = [p];
      }

      for (const f of files as string[]) {
        if (!SUPPORTED_EXTS.includes(upath.extname(f))) {
          continue;
        }
        if (options && options.filter) {
          let success = true;
          if (isRegExp(options.filter)) {
            success = options.filter.test(f);
          } else if (typeof options.filter === "function") {
            success = options.filter(f);
          }
          if (!success) {
            continue;
          }
        }

        let fullPath;
        try {
          fullPath = resolve(upath.join(p, f));
        } catch (err) {
          console.log(err);
          continue;
        }

        try {
          // Check for existing
          st = await stat(fullPath);
          if (await st.isDirectory()) {
            continue;
          }
        } catch (err) {
          console.log(err);
          continue;
        }

        let modExports;

        let tempJsPath: string | null = null;
        let tempTsPath: string | null = null;
        try {
          const moduleExt = upath.extname(fullPath);
          if (!this.tsService) {
            const tsConfig: RegisterOptions = JSON.parse(await readFile(upath.join(__dirname, "..", "tsconfig.json"), { encoding: 'utf-8' }));
            // eslint-disable-next-line global-require
            this.tsService = require('ts-node').register(tsConfig);
          }

          if (moduleExt === '.ts') {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            modExports = require(fullPath);
          } else if (moduleExt === '.mjs') {
            tempTsPath = upath.join(upath.dirname(fullPath), `${upath.basename(fullPath, moduleExt)}-${nanoid()}.ts`);
            const mjsCode = await readFile(fullPath, { encoding: 'utf-8'});
            await writeFile(tempTsPath, `// @ts-nocheck\n\n${mjsCode}`, { encoding: 'utf-8'});
            // eslint-disable-next-line import/no-dynamic-require, global-require
            modExports = require(tempTsPath);
          } else {
            const jsCode = this.tsService!.compile(await readFile(fullPath, { encoding: "utf-8" }), fullPath);
            tempJsPath = upath.join(upath.dirname(fullPath), `${upath.basename(fullPath, moduleExt)}-${nanoid()}.js`);
            await writeFile(tempJsPath, jsCode, { encoding: 'utf-8' });
            // eslint-disable-next-line import/no-dynamic-require, global-require
            modExports = require(tempJsPath);
          }
        } catch (err) {
          console.error(err);
          // ignore non javascript files
          continue;
        } finally {
          if (typeof tempJsPath === 'string') {
            await unlink(tempJsPath);
          }
          if (typeof tempTsPath === 'string') {
            await unlink(tempTsPath);
          }
        }
        if (modExports.default) {
          modExports = modExports.default;
        }

        let tasks: any[];
        if (isClass(modExports)) {
          tasks = [modExports];
        } else if (isPlainObject(modExports)) {
          tasks = [...Object.values(modExports)];
        } else {
          continue;
        }

        for (const task of tasks) {
          const taskOptions: TaskOptions = {
            ...(options ? omit(options, ["filter"]) : {}),
            task,
          };
          await this.addTask(taskOptions);
        }
      }
    }
  }

  /**
   * Returns task info.
   *
   * @param {object} name task name
   */
  getTask(name: string) {
    return this._getTaskInfo(name);
  }

  /**
   * Returns task class.
   *
   * @param {string} name task name
   */
  getTaskClass(name: string) {
    const taskInfo = this._getTaskInfo(name);
    return taskInfo.Class;
  }

  /**
   * Returns task instance.
   *
   * @param {string} name task name
   */
  getTaskInstance(name: string) {
    return this._createTaskInstance(this._getTaskInfo(name));
  }

  /**
   * Returns true if task with such name owned by the manager.
   * @param {string} name
   */
  hasTask(name: string) {
    return this.tasks.has(name);
  }

  /**
   * Deletes task with specified name.
   *
   * @param {string} name
   */
  deleteTask(name: string) {
    const taskInfo = this._getTaskInfo(name);
    if (taskInfo.runners.size > 0) {
      taskInfo.zombi = true;
    } else {
      this._uninstallTask(name);
    }
  }

  /**
   * Deletes all tasks.
   */
  async deleteAllTasks() {
    const names = this.getTaskNames();
    for (const name of names) {
      await this.deleteTask(name);
    }
  }

  /**
   * Returns list of names all of tasks.
   */
  getTaskNames() {
    return [...this.tasks.entries()].filter((entry) => !entry[1].zombi).map((entry) => entry[0]);
  }

  /**
   * Register notification observer.
   */
  onNotification(selector: any, observer: any) {
    let name;
    let filter: (t: any) => boolean = truly;

    if (typeof selector === "string") {
      name = selector;
    } else if (typeof selector === "function") {
      filter = selector;
    } else if (isObject(selector)) {
      if (typeof selector.name === "string") {
        name = selector.name;
      }

      if (typeof selector.task === "string") {
        filter = (task) => task.observer.taskName === selector.task;
      } else if (Array.isArray(selector.tasks)) {
        filter = (task) => selector.task.includes(task.observer.taskName);
      }
    }

    if (typeof name === "string") {
      let observers = this.eventObservers.get(name);
      if (observers === undefined) {
        observers = [
          {
            filter,
            observer,
          },
        ];
        this.eventObservers.set(name, observers);
      } else {
        if (observers.findIndex((info: any) => info.observer === observer) >= 0) {
          throw new Error("Observer already exists");
        }

        observers.push({
          filter,
          observer,
        });
      }
    } else {
      const anyNotif = this.eventObservers.get(ANY_EVENT);
      if (anyNotif.findIndex((info: any) => info.observer === observer) >= 0) {
        throw new Error("Observer already exists");
      }
      anyNotif.push({
        filter,
        observer,
      });
    }
  }

  /**
   * Emit notification from task
   *
   * @param {*} sender - notification sender
   * @param {string} eventName - event name
   * @param {array} args - notification arguments
   */
  notify(sender: BaseTask, eventName: string, ...args: any[]) {
    const observers = this.eventObservers.get(eventName);
    if (Array.isArray(observers)) {
      for (const info of observers) {
        if (info.filter(sender, eventName)) {
          info.observer(sender, eventName, ...args);
        }
      }
    }

    const any = this.eventObservers.get(ANY_EVENT);
    for (const info of any) {
      if (info.filter(sender, eventName)) {
        info.observer(sender, eventName, ...args);
      }
    }
  }

  /**
   * Runs task.
   *
   * @param {*} name task name
   * @param {*} args task arguments
   */
  run(name: string, ...args: any[]): Promise<TaskObserver> {
    return this.runNormal(name, ...args);
  }

  // /**
  //  * Runs task in secure vm.
  //  *
  //  * @param {*} name
  //  * @param  {...any} args
  //  */
  // runInVm() {
  //   // TODO
  // }

  // /**
  //  * Runs task in worker thread.
  //  *
  //  * @param {*} name
  //  * @param  {...any} args
  //  */
  // runInThread() {
  //   // TODO
  // }

  // /**
  //  * Runs task in new process.
  //  *
  //  * @param {*} name
  //  * @param  {...any} args
  //  */
  // runInProcess() {
  //   // TODO
  // }

  /**
   * Runs tasks and wait for result.
   *
   * @param {*} name task name
   * @param {*} args task arguments
   * @returns {any}
   */
  async runAndWait(name: string, ...args: any[]): Promise<any> {
    const observer = await this.run(name, ...args);
    return observer.result;
  }

  /**
   * Runs task once.
   *
   * @param {class} task
   * @param {*} args
   */
  async runOnce(task: any, ...args: any[]): Promise<TaskObserver> {
    let name;
    if (isClass(task) && !this.hasTask(task.name)) {
      name = task.name;
    } else {
      name = nanoid();
    }
    await this.addTask({ name, task });
    const observer = await this.runNormal(name, ...args);
    this.deleteTask(name);

    return observer;
  }

  private async runNormal(name: string, ...args: any[]): Promise<TaskObserver> {
    const taskInfo = this._getTaskInfo(name);
    let taskObserver;

    if (taskInfo.singleton) {
      if (taskInfo.runner === noop) {
        taskInfo.runner = await this._createTaskRunner(taskInfo);
      }
      taskObserver = await taskInfo.runner(args);
    } else {
      const runTask = await this._createTaskRunner(taskInfo);
      taskInfo.runners.add(runTask);
      taskObserver = await runTask(args);

      const releaseRunner = () => {
        taskInfo.runners.delete(runTask);
        if (taskInfo.zombi === true && taskInfo.runners.size === 0) {
          this._uninstallTask(name);
        }
      };

      if (isPromise(taskObserver.result)) {
        promise.finally(taskObserver.result, releaseRunner).catch(noop);
      } else {
        releaseRunner();
      }
    }

    return taskObserver;
  }

  private async _createTaskRunner(taskInfo: TaskInfo) {
    return async (args: any[]) => {
      const instance = await this._createTaskInstance(taskInfo);

      const taskObserver = new TaskObserver(instance, taskInfo);
      taskObserver.state = TaskState.RUNNING;
      try {
        taskObserver.result = taskInfo.throttled(instance, args);
      } catch (err) {
        await taskObserver.task.undo(err);
        taskObserver.result = Promise.reject(err);
      }

      if (isPromise(taskObserver.result)) {
        // Wrap promise if task has undo method.
        taskObserver.result = taskObserver.result.then(identity, async (err: any) => {
          await taskObserver.task.undo(err);
          throw err;
        });

        taskObserver.result
          .then(() => {
            taskObserver.state =
              taskObserver.state === TaskState.CANCELLING ? TaskState.CANCELLED : TaskState.COMPLETED;
          })
          .catch((err: any) => {
            taskObserver.state = TaskState.FAILED;
            taskObserver.error = err;
          });
      } else {
        taskObserver.state = TaskState.COMPLETED;
      }
      return taskObserver;
    };
  }

  private _createTaskInstance(taskInfo: TaskInfo): BaseTask {
    let instance;
    if (taskInfo.singleton) {
      if (taskInfo["instance"] === undefined) {
        // eslint-disable-next-line no-multi-assign
        instance = taskInfo["instance"] = new taskInfo.Class();
      } else {
        return taskInfo["instance"];
      }
    } else {
      instance = new taskInfo.Class();
    }

    instance[MANAGER_SYMBOL] = this;

    return instance;
  }

  // eslint-disable-next-line class-methods-use-this
  private _initTaskInfo(name: string, task: any, taskOptions: TaskOptions): TaskInfo {
    if (taskOptions.suspendable && taskOptions.singleton) {
      throw new Error("Singleton task cannot be suspendable");
    }

    if (taskOptions.cancelable && taskOptions.singleton) {
      throw new Error("Singleton task cannot be cancelable");
    }

    let meta = getTaskMeta(task);
    if (typeof meta === "string" || meta === undefined) {
      meta = {};
    }

    const taskInfo: TaskInfo = {
      name,
      suspendable: getOptionValue(taskOptions.suspendable, meta.suspendable, isBoolean, false),
      cancelable: getOptionValue(taskOptions.cancelable, meta.cancelable, isBoolean, false),
      singleton: getOptionValue(taskOptions.singleton, meta.singleton, isBoolean, false),
      description: getOptionValue(taskOptions.description, meta.description, isString, undefined),
      throttled: DUMMY_THROTTLE,
      runner: noop,
      runners: new Set(),
    };

    const concurrency = getOptionValue(taskOptions.concurrency, meta.concurrency, isNumber, undefined);
    const interval = getOptionValue(taskOptions.interval, meta.interval, isNumber, undefined);

    if (typeof concurrency === "number" && concurrency > 0) {
      const throttle = pThrottle({
        limit: concurrency,
        interval: interval ?? 1000,
        strict: true,
      });
      taskInfo.throttled = throttle((instance: BaseTask, args: any[]) => instance._run(...args));
    }

    return taskInfo;
  }

  private _installTask(name: string, taskInfo: TaskInfo) {
    this.tasks.set(name, taskInfo);
  }

  private _uninstallTask(name: string) {
    this.tasks.delete(name);
  }

  private _getTaskInfo(name: string): TaskInfo {
    const taskInfo = this.tasks.get(name);
    if (!taskInfo || taskInfo.zombi === true) {
      throw new Error("Unknown task");
    }

    return taskInfo;
  }
}
