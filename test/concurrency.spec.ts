/* eslint-disable no-await-in-loop */

import "reflect-metadata/lite";
import * as promise from "@unwanted/promise";

import type { TaskObserver } from "../src";

import { BaseTask, TaskManager } from "../src";

describe("tasks", () => {
  let manager: TaskManager;



  beforeEach(() => {
    manager = new TaskManager();
  });

  describe("concurrency", () => {
    let counter: number;
    let inc: number;

    class TaskA extends BaseTask {
      override async main(maxVal: number, timeout: number, check: boolean) {
        counter++;
        inc++;
        if (maxVal) {
          expect(inc).toBeLessThanOrEqual(maxVal);
        }
        if (check) {
          expect(counter).toEqual(inc);
        }
        await promise.delay(timeout);
        inc--;
        this.result = inc;
      }
    }

    class SingletonTask extends BaseTask {
      public inc = 0;

      override async main(maxVal: number, timeout: number) {
        this.inc++;
        if (maxVal) {
          expect(this.inc).toBeLessThanOrEqual(maxVal);
        }
        await promise.delay(timeout);
        this.inc--;
        this.result = this.inc;
      }
    }

    beforeEach(() => {
      inc = 0;
      counter = 0;
    });

    it("run 10 task instances without cuncurrency", async () => {
      await manager.addTask({ name: "a", task: TaskA });

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        const observer = await manager.run("a", 0, 30, true);
        promises.push(observer.result);
      }

      await Promise.all(promises);
    });

    it("concurrency should involve tasks but not creation of observers", async () => {
      await manager.addTask({
        name: "a",
        task: TaskA,
        concurrency: 10,
      });

      const observers: TaskObserver[] = [];
      const results: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        const observer = await manager.run("a", 0, 30, true);
        observers.push(observer);
        results.push(observer.result);
      }

      expect(counter).toBeLessThan(10);
      await Promise.all(results);
      expect(counter).toEqual(10);
      expect(inc).toEqual(0);
    });

    it("run maximum 3 task instances at a time", async () => {
      await manager.addTask({
        name: "a",
        task: TaskA,
        concurrency: 3,
        interval: 100,
      });

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const observer = await manager.run("a", 3, 50, false);
        promises.push(observer.result);
      }

      await Promise.all(promises);
    });

    it("run singleton task in parallel", async () => {
      await manager.addTask({
        name: "a",
        task: SingletonTask,
        concurrency: 3,
        interval: 100,
        singleton: true,
      });

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const observer = await manager.run("a", 3, 50);
        promises.push(observer.result);
      }

      await Promise.all(promises);
    });
  });
});
