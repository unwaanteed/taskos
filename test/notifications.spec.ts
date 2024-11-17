import "reflect-metadata/lite";
import * as promise from "@unwanted/promise";

import { isTask, BaseTask, TaskManager } from "../src";

describe("tasks", () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  describe("notifications", () => {
    class Task1 extends BaseTask {
      override async main() {
        this.manager.notify(this, "progress", {
          value: 0.1,
          message: "step1",
        });

        await promise.delay(1);

        this.manager.notify(this, "progress", {
          value: 0.5,
          message: "step2",
        });

        await promise.delay(1);

        this.manager.notify(this, "progress", {
          value: 1.0,
          message: "step3",
        });
      }
    }

    class Task2 extends BaseTask {
      override async main() {
        this.manager.notify(this, "p", {
          value: 0.2,
          message: "bam1",
        });

        await promise.delay(1);

        this.manager.notify(this, "pro", {
          value: 0.6,
          message: "bam2",
        });

        await promise.delay(1);

        this.manager.notify(this, "progre", {
          value: 0.8,
          message: "bam3",
        });
      }
    }

    it("add same observer second time should have thrown", async () => {
      const observer = () => { };
      manager.onNotification("progress", observer);
      expect(() => manager.onNotification("progress", observer)).toThrow(/Observer already exists/);
    });

    it("add same observer for any notifications second time should have thrown", async () => {
      const observer = () => { };
      manager.onNotification(null, observer);
      expect(() => manager.onNotification(null, observer)).toThrow(/Observer already exists/);
    });

    it("observe all notifications", async () => {
      await manager.addTask({ name: "1", task: Task1 });

      let i = 1;
      const values = [0.1, 0.5, 1.0];

      manager.onNotification("progress", (task: any, name: string, data: any) => {
        expect(isTask(task)).toBeTruthy();
        expect(name).toEqual("progress");
        expect(values[i - 1]).toEqual(data.value);
        expect(`step${i++}`).toEqual(data.message);
      });

      await manager.runAndWait("1");

      expect(i).toEqual(4);
    });

    it("observe notifications from specific task", async () => {
      await manager.addTask({ name: "1", task: Task1 });
      await manager.addTask({ name: "2", task: Task2 });

      let i = 1;
      const values = [0.1, 0.5, 1.0];

      manager.onNotification(
        {
          name: "progress",
          task: "1",
        },
        (task: any, name: string, data: any) => {
          expect(isTask(task)).toBeTruthy();
          expect(name).toEqual("progress");
          expect(values[i - 1]).toEqual(data.value);
          expect(`step${i++}`).toEqual(data.message);
        }
      );

      await Promise.all([manager.runAndWait("1"), manager.runAndWait("2")]);

      // await promise.delay(300);
      expect(i).toEqual(4);
    });

    it("observe all notifications", async () => {
      await manager.addTask({ name: "1", task: Task1 });
      await manager.addTask({ name: "2", task: Task2 });

      let i = 0;
      const values = [0.1, 0.5, 1.0, 0.2, 0.6, 0.8];
      const messages = ["step1", "step2", "step3", "bam1", "bam2", "bam3"];

      manager.onNotification(null, (task: any, name: string, data: any) => {
        expect(isTask(task)).toBeTruthy();
        expect(values.includes(data.value)).toBeTruthy();
        expect(messages.includes(data.message)).toBeTruthy();
        i++;
      });

      await Promise.all([(await manager.run("1")).result, (await manager.run("2")).result]);

      expect(i).toEqual(6);
    });

    it("observe notification accepts by function selector", async () => {
      await manager.addTask({ name: "1", task: Task1 });
      await manager.addTask({ name: "2", task: Task2 });

      let i = 0;
      const values = [0.2, 0.6, 0.8];
      const messages = ["bam1", "bam2", "bam3"];

      manager.onNotification(
        (task: any) => task.observer.taskName === "2",
        (task: any, name: string, data: any) => {
          expect(isTask(task)).toBeTruthy();
          expect(task.observer.taskName === "2").toBeTruthy();
          expect(values.includes(data.value)).toBeTruthy();
          expect(messages.includes(data.message)).toBeTruthy();
          i++;
        }
      );

      await Promise.all([(await manager.run("1")).result, (await manager.run("2")).result]);

      expect(i).toEqual(3);
    });
  });
});
