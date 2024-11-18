/* eslint-disable class-methods-use-this */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-return-assign */

import "reflect-metadata/lite";
import npath from "node:path";
import * as promise from "@unwanted/promise";
import {
  isPromise,
} from "@unwanted/common";

import { SimpleTask } from "./tasks";
import {
  isTask,
  BaseTask,
  runSeries,
  TaskManager,
  runParallel,
  isTaskManager,
  isTaskObserver
} from "../src";


describe("tasks", () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  it("task prototype", () => {
    const t = new BaseTask();

    expect(isTask(t)).toBeTruthy();
    expect(() => t.manager).toThrow(/Undefined task manager/);
    expect(() => t.observer).toThrow(/Undefined observer/);
    // @ts-ignore
    expect(() => (t.manager = undefined)).toThrow(/Cannot set property /);
    // @ts-ignore
    expect(() => (t.observer = undefined)).toThrow(/Cannot set property /);

    expect(t._run).toBeInstanceOf(Function);
    expect(t.main).toBeInstanceOf(Function);
    expect(() => t.main()).toThrow(/Not implemented/);

    expect(t.suspend).toBeInstanceOf(Function);
    expect(t.resume).toBeInstanceOf(Function);
    expect(t.cancel).toBeInstanceOf(Function);
  });

  it("construct manager", () => {
    expect(isTaskManager(manager)).toBeTruthy();
    expect(manager.getTaskNames()).toHaveLength(0);
  });

  it("isTask() should be defined", () => {
    class MyTask extends BaseTask { }

    expect(isTask(new MyTask())).toBeTruthy();
  });

  it("should add only valid task", async () => {
    const InvalidTask1 = null;
    const InvalidTask2 = {};
    class InvalidTask3 {
      constructor(public result: string) { }

      main() {
        this.result = "invalid";
      }
    }

    class ValidTask extends BaseTask {
      override main() {
        this.result = "ok";
      }
    }

    const invalidTasks = [InvalidTask1, InvalidTask2, InvalidTask3];

    for (const InvalidTask of invalidTasks) {
      // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-loop-func
      await expect(async () =>
        manager.addTask({
          name: "task",
          task: InvalidTask,
        })
      ).rejects.toThrow(/Invalid task/);
    }

    await manager.addTask({
      name: "task",
      task: ValidTask,
    });
    expect(manager.getTaskNames()).toEqual(["task"]);
  });

  it("task's immutable properties", async () => {
    const props = [
      {
        name: "manager",
        expected: manager,
        createNew: () => new TaskManager(),
      },
      {
        name: "observer",
        expected: null,
        createNew: () => ({}),
      },
    ];

    class TaskA extends BaseTask {
      override main() { }
    }

    await manager.addTask({
      name: "task",
      task: TaskA,
    });
    const taskA = await manager.getTaskInstance("task");

    for (const prop of props) {
      if (prop.name === "manager") {
        expect(taskA[prop.name]).toStrictEqual(prop.expected);
      } else {
        // @ts-ignore
        expect(() => taskA[prop.name]).toThrow(/Undefined /);
      }

      // @ts-ignore
      expect(() => (taskA[prop.name] = prop.createNew())).toThrow(/Cannot set property /);
    }
  });

  it("run task", async () => {
    await manager.addTask({
      name: "a",
      task: SimpleTask,
    });
    const observer = await manager.run("a", "ABC");
    expect(isTaskObserver(observer)).toBeTruthy();
    expect(observer.completed).toBeFalsy();
    expect(await observer.result).toEqual("ABC");
    expect(observer.completed).toBeTruthy();
  });

  it("regular task is stateless", async () => {
    await manager.addTask({
      name: "a",
      task: SimpleTask,
    });
    const observer1 = await manager.run("a", "ABC");
    const observer2 = await manager.run("a", "ABC");
    await Promise.all([observer1.result, observer2.result]);
    expect((observer1.task as SimpleTask).value).toEqual(1);
    expect((observer1.task as SimpleTask).value).toEqual((observer2.task as SimpleTask).value);
  });

  it("observer should contain common task information", async () => {
    class TaskA extends BaseTask {
      override main() {
        return promise.delay(10);
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA,
    });
    const observer = await manager.run("a", "ABC");
    expect(observer.suspendable).toBeFalsy();
    expect(observer.cancelable).toBeFalsy();
    expect(observer.running).toBeTruthy();
    expect(observer.cancelled).toBeFalsy();
    expect(observer.completed).toBeFalsy();
    expect(observer.failed).toBeFalsy();
    expect(observer.finished).toBeFalsy();
    expect(observer.suspended).toBeFalsy();
    expect(isPromise(observer.result)).toBeTruthy();

    await observer.result;
    expect(observer.running).toBeFalsy();
    expect(observer.completed).toBeTruthy();
    expect(observer.finished).toBeTruthy();
  });

  it("observer should contain correct error info for sync task", async () => {
    class TaskA extends BaseTask {
      override main() {
        throw new Error("sad");
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA,
    });
    const observer = await manager.run("a", "ABC");
    await expect(async () => observer.result).rejects.toThrow(/sad/);
    expect(observer.failed).toBeTruthy();
    expect(observer.error.message).toMatch(/sad/);
  });

  it("observer should contain correct error info for async task", async () => {
    class TaskA extends BaseTask {
      override async main() {
        await promise.delay(10);
        throw new Error("sad");
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA,
    });
    const observer = await manager.run("a", "ABC");
    await expect(async () => observer.result).rejects.toThrow(/sad/);
    expect(observer.failed).toBeTruthy();
    expect(observer.error.message).toMatch(/sad/);
  });

  it("run async task", async () => {
    class TaskA extends BaseTask {
      override async main(version: string) {
        await promise.delay(10);
        this.result = `RS ${version}`;
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA,
    });
    const observer = await manager.run("a", "ABC");
    expect(observer.running).toBeTruthy();
    expect(await observer.result).toEqual("RS ABC");
    expect(observer.completed).toBeTruthy();
  });

  it("delete nonexisting task", async () => {
    await expect(async () => manager.deleteTask("unknown")).rejects.toThrow(/Unknown task/);
  });

  it("delete existing task", async () => {
    class TaskA extends BaseTask {
      override main() {
        this.result = 0;
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA,
    });
    expect(manager.getTaskNames()).toEqual(["a"]);
    await manager.deleteTask("a");
    expect(manager.getTaskNames()).toHaveLength(0);
  });

  it("delete all tasks", async () => {
    class TasksA extends BaseTask {
      override main() { }
    }

    class TasksB extends BaseTask {
      override main() { }
    }

    class TasksC extends BaseTask {
      override main() { }
    }

    class TasksD extends BaseTask {
      override main() { }
    }

    await manager.addTask({ name: "a", task: TasksA });
    await manager.addTask({ name: "b", task: TasksB });
    await manager.addTask({ name: "c", task: TasksC });
    await manager.addTask({ name: "d", task: TasksD });

    expect(manager.getTaskNames()).toEqual(["a", "b", "c", "d"]);

    await manager.deleteTask("b");

    expect(manager.getTaskNames()).toEqual(["a", "c", "d"]);

    await manager.deleteAllTasks();

    expect(manager.getTaskNames()).toHaveLength(0);
  });

  it("run task once", async () => {
    const observer = await manager.runOnce(SimpleTask, "abc");
    expect(manager.getTaskNames()).toHaveLength(0);
    expect(observer.completed).toBeTruthy();
    expect(await observer.result).toEqual("abc");
    expect(observer.completed).toBeTruthy();
  });

  it("run async task once", async () => {
    class TaskA extends BaseTask {
      override async main(version: string) {
        await promise.delay(10);
        this.result = `rs ${version}`;
      }
    }

    const observer = await manager.runOnce(TaskA, "abc");
    expect(manager.getTaskNames()).toHaveLength(0);
    expect(observer.running).toBeTruthy();
    expect(await observer.result).toEqual("rs abc");
    expect(observer.completed).toBeTruthy();
  });

  it("run deleted but still running task should have thrown", async () => {
    class TaskA extends BaseTask {
      override async main(version: string) {
        await promise.delay(100);
        this.result = `123 ${version}`;
      }
    }

    await manager.addTask({ name: "a", task: TaskA });
    const observer = await manager.run("a", "abc");
    await manager.deleteTask("a");
    await expect(async () => manager.run("a", "abc")).rejects.toThrow(/Unknown task/);

    expect(manager.getTaskNames()).toHaveLength(0);
    expect(observer.running).toBeTruthy();
    expect(await observer.result).toEqual("123 abc");
    expect(observer.completed).toBeTruthy();
  });

  it("runSeries() with functions", async () => {
    const task1 = async function __() {
      await promise.delay(100);
      // @ts-ignore
      this.result = 777;
    };

    const task2 = function _() {
      // @ts-ignore
      this.result = 888;
    };

    const observer = await runSeries(manager, [task1, task2]);

    expect(await observer.result).toStrictEqual([777, 888]);
  });

  it("runParallel() with functions", async () => {
    const task1 = async function __() {
      await promise.delay(100);
      // @ts-ignore
      this.result = 777;
    };

    const task2 = function _() {
      // @ts-ignore
      this.result = 888;
    };

    const observer = await runParallel(manager, [task1, task2]);

    const result = await observer.result;
    expect(Object.keys(result)).toHaveLength(2);
    expect(Object.values(result).sort()).toEqual([777, 888].sort());
  });

  describe("TaskObserver#finally", () => {
    it("finally function should be executed atomically (async)", async () => {
      let val;
      class TaskA extends BaseTask {
        override async main() {
          await promise.delay(100);
          val = 1;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      const observer = await manager.run("a");

      observer.finally(async () => {
        await promise.delay(100);
        val = 2;
      });
      await observer.result;
      expect(val).toEqual(2);
    });

    it("finally function should be executed atomically (async)", async () => {
      let val = 0;
      class TaskA extends BaseTask {
        override main() {
          val = 1;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      const observer = await manager.run("a");
      observer.finally(() => {
        val = 2;
      });
      await observer.result;
      expect(val).toEqual(2);
    });
  });

  describe("undo", () => {
    it("task's undo method should be executed atomically (async)", async () => {
      const data: any[] = [];

      class TaskA extends BaseTask {
        override async main() {
          data.push(1);
          await promise.delay(100);
          data.push(2);
          throw new Error("task error");
        }

        override async undo() {
          await promise.delay(1000);
          data.length = 0;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      try {
        const observer = await manager.run("a");
        await observer.result;
      } catch (err) {
        expect(data).toHaveLength(0);
      }
    });

    it("task's undo method should be executed atomically (sync)", async () => {
      const data: any[] = [];

      class TaskA extends BaseTask {
        override main() {
          data.push(1);
          data.push(2);
          throw new Error("task error");
        }

        override async undo() {
          await promise.delay(1000);
          data.length = 0;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      try {
        const observer = await manager.run("a");
        await observer.result;
      } catch (err) {
        expect(data).toHaveLength(0);
      }
    });
  });

  describe("loadTasksFrom()", () => {
    it("single location", async () => {
      await manager.loadTasksFrom(npath.join(__dirname, "fixtures"));

      expect(manager.hasTask("1")).toBeTruthy();
      expect(manager.hasTask("2")).toBeTruthy();
      expect(manager.hasTask("3")).toBeTruthy();
    });

    it("multiple location", async () => {
      const basePath = npath.join(__dirname, "fixtures");
      await manager.loadTasksFrom([basePath, npath.join(basePath, "other"), npath.join(basePath, "multi")]);

      expect(manager.hasTask("1")).toBeTruthy();
      expect(manager.hasTask("2")).toBeTruthy();
      expect(manager.hasTask("3")).toBeTruthy();
      expect(manager.hasTask("4")).toBeTruthy();
      expect(manager.hasTask("5")).toBeTruthy();
      expect(manager.hasTask("6")).toBeTruthy();
    });
  });

  // // // describe.only("contexts", () => {
  // // //     const {
  // // //         task: { Manager }
  // // //     } = ateos;

  // // //     it("manager api", () => {
  // // //         const manager = new Manager();

  // // //         assert.isFunction(manager.getIsolate);
  // // //         assert.isFunction(manager.getContextBook);
  // // //     });

  // // //     it("create std context with defaults", async () => {
  // // //         const manager = new Manager();
  // // //         const stdContext = await manager.getContextBook().createContext("main");
  // // //         assert.isObject(stdContext);

  // // //         class MyTask extends Task {
  // // //             run(a, b) {
  // // //                 global.a = a;
  // // //                 global.b = b;
  // // //                 global.c = a + b;
  // // //                 return global.c;
  // // //             }
  // // //         }

  // // //         manager.addTask("my", MyTask);
  // // //         const observer = await manager.runInContext(stdContext, "my", 1, 2);
  // // //         const result = await observer.result;
  // // //         console.log(result);
  // // //     });

  // // // });
});
