import "reflect-metadata/lite";
import { omit } from "@unwanted/omit";

import { Task, BaseTask, TaskManager } from "../src";


describe("tasks", () => {
  describe("tasks decorators", () => {
    let manager: TaskManager;

    beforeEach(() => {
      manager = new TaskManager();
    });

    @Task({
      name: "1",
    })
    class Task1 extends BaseTask {
      override main() {
        this.result = 8;
      }
    }

    @Task("2")
    class Task2 extends BaseTask {
      override main() {
        this.result = 8;
      }
    }

    @Task({
      suspendable: true,
      cancelable: true,
      concurrency: 12,
      interval: 10,
      singleton: true,
      description: "regular",
      tag: "common",
    })
    class Task3 extends BaseTask {
      override main() {
        this.result = 8;
      }
    }

    it("use name from task meta (object)", async () => {
      await manager.addTask({ task: Task1 });

      expect(manager.hasTask("1")).toBeTruthy();
      expect(await manager.runAndWait("1")).toEqual(8);
    });

    it("use name from task meta (string)", async () => {
      await manager.addTask({ task: Task2 });

      expect(manager.hasTask("2")).toBeTruthy();
      expect(await manager.runAndWait("2")).toEqual(8);
    });

    it("should get task parameters from meta", async () => {
      await manager.addTask({ name: "3", task: Task3 });

      expect(manager.hasTask("3")).toBeTruthy();
      const actual = omit(manager.getTask("3"), "throttled");
      expect(omit(actual, ["runner", "runners"])).toEqual({
        name: "3",
        Class: Task3,
        suspendable: true,
        cancelable: true,
        singleton: true,
        description: "regular",
      });
    });

    it("argument options take precedence over meta options", async () => {
      await manager.addTask({
        suspendable: false,
        name: "3",
        description: "non-regular",
        task: Task3,
      });
      const ti = manager.getTask("3");
      expect(ti.suspendable).toEqual(false);
      expect(ti.description).toEqual("non-regular");
    });
  });
});
