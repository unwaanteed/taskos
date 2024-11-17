import "reflect-metadata/lite";

import { SimpleTask } from "./tasks";
import { TaskManager } from "../src";

describe("tasks", () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  describe("singleton tasks", () => {
    it("correct value of 'manager' property in task", async () => {
      await manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true,
      });

      const observer = await manager.run("a");
      await observer.result;
      expect(observer.task.manager).not.toBeNull();
    });

    it("singleton task is stateful", async () => {
      await manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true,
      });
      const observer1 = await manager.run("a", "abc");
      const observer2 = await manager.run("a", "abc");
      await Promise.all([observer1.result, observer2.result]);
      expect((observer1.task as SimpleTask).value).toEqual(2);
      expect(observer1.task).toEqual(observer1.task);
    });

    it("deletion of singleton task should be performed immediately", async () => {
      await manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true,
      });
      const observer = await manager.run("a", "abc", 100);
      expect(manager.getTaskNames()).toHaveLength(1);
      manager.deleteTask("a");
      expect(manager.getTaskNames()).toHaveLength(0);
      await observer.result;
    });

    it("singleton task cannot be suspendable", async () => {
      await expect(async () =>
        manager.addTask({
          name: "a",
          task: SimpleTask,
          singleton: true,
          suspendable: true,
        })
      ).rejects.toThrow(/Singleton task cannot be suspendable/);
    });

    it("singleton task cannot be cancelable", async () => {
      await expect(async () =>
        manager.addTask({
          name: "a",
          task: SimpleTask,
          singleton: true,
          cancelable: true,
        })
      ).rejects.toThrow(/Singleton task cannot be cancelable/);
    });
  });
});
