import "reflect-metadata/lite";
import * as promise from "@unwanted/promise";

import { SCTask } from "./tasks";
import { TaskManager } from "../src";

describe("tasks", () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  describe("suspend/resume/cancel", () => {
    it("suspend/resume non suspendable task", async () => {
      await manager.addTask({ name: "a", task: SCTask });
      const observer = await manager.run("a");
      await promise.delay(200);
      await observer.suspend();
      expect(observer.suspended).toBeFalsy();
      expect(await observer.result).toEqual(100);
    });

    it("cancel non cancelable task", async () => {
      await manager.addTask({ name: "a", task: SCTask });
      const observer = await manager.run("a");
      await promise.delay(200);
      await expect(async () => observer.cancel()).rejects.toThrow(/Task is not cancelable/);
      expect(await observer.result).toEqual(100);
      expect(observer.completed).toBeTruthy();
      expect(observer.cancelled).toBeFalsy();
    });

    it("suspend/resume suspendable task", async () => {
      await manager.addTask({
        name: "a",
        task: SCTask,
        suspendable: true,
      });
      const observer = await manager.run("a");
      await promise.delay(200);
      await observer.suspend();
      expect((observer.task as SCTask).reallySuspended).toBeTruthy();
      expect(observer.suspended).toBeTruthy();
      await promise.delay(100);
      await observer.resume();
      expect((observer.task as SCTask).reallyResumed).toBeTruthy();
      expect(observer.running).toBeTruthy();
      expect(await observer.result).toEqual(100);
    });

    it("cancel cancelable task", async () => {
      await manager.addTask({
        name: "a",
        task: SCTask,
        cancelable: true,
      });
      const observer = await manager.run("a");
      await promise.delay(200);
      await observer.cancel();
      expect(observer.cancelled).toBeTruthy();
      expect(await observer.result).not.toEqual(100);
      expect(observer.completed).toBeFalsy();
    });
  });
});
