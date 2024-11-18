/* eslint-disable class-methods-use-this */
import "reflect-metadata/lite";
import * as promise from "@unwanted/promise";
import { isNumber, isString } from "@unwanted/common";

import { SCTask } from "./tasks";
import { BaseTask, TaskManager, TryFlowTask, RaceFlowTask, SeriesFlowTask, ParallelFlowTask, WaterfallFlowTask } from "../src";

describe("tasks", () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  describe("flows", () => {
    class TaskA extends BaseTask {
      override async main() {
        await promise.delay(10);
        this.result = 1;
      }
    }

    class TaskBadA extends BaseTask {
      override async main() {
        await promise.delay(10);
        throw new Error("some error");
      }
    }

    class TaskB extends BaseTask {
      override async main({ suffix }: { suffix: string }) {
        await promise.delay(10);
        this.result = `suffix-${suffix}`;
      }
    }

    class TaskC extends BaseTask {
      override main({ suffix }: { suffix: string }) {
        this.result = suffix;
      }
    }

    it("should throw if pass more them one argument", async () => {
      await manager.addTask({ name: "a", task: TaskA });
      await manager.addTask({ name: "b", task: TaskB });
      await manager.addTask({ name: "series", task: SeriesFlowTask });

      await expect(async () =>
        manager.runAndWait(
          "series",
          {
            args: {
              suffix: "ateos",
            },
            tasks: ["a", "b"],
          },
          {}
        )
      ).rejects.toThrow(/Invalid argument/);
    });

    it("should throw if pass non object argument", async () => {
      await manager.addTask({ name: "a", task: TaskA });
      await manager.addTask({ name: "b", task: TaskB });
      await manager.addTask({ name: "series", task: SeriesFlowTask });

      await expect(async () => manager.runAndWait("series", ["a", "b"])).rejects.toThrow(/Invalid argument/);
    });

    describe("series", () => {
      it("managed tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          arg: {
            suffix: "ateos",
          },
          tasks: ["a", "b"],
        });
        expect(await observer.result).toEqual([1, "suffix-ateos"]);
      });

      it("managed+unmanaged tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          arg: {
            suffix: "ateos",
          },
          tasks: ["a", "b", TaskC],
        });
        expect(await observer.result).toEqual([1, "suffix-ateos", "ateos"]);
      });

      it("run tasks with separate args", async () => {
        class SomeTask extends BaseTask {
          override main({ val }: { val: any }) {
            this.result = val;
          }
        }

        await manager.addTask({ name: "a", task: SomeTask });
        await manager.addTask({ name: "b", task: SomeTask });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          tasks: [
            {
              task: "a",
              args: {
                val: "ateos",
              },
            },
            {
              task: "b",
              args: {
                val: 888,
              },
            },
          ],
        });
        expect(await observer.result).toEqual(["ateos", 888]);
      });

      it("should stop follow-up tasks is one of the task has thrown", async () => {
        const results: any[] = [];
        class TaskAA extends BaseTask {
          override main() {
            results.push(666);
          }
        }

        class TaskBB extends BaseTask {
          override main() {
            throw new Error("TaskBB error");
          }
        }

        class TaskCC extends BaseTask {
          override main() {
            results.push(777);
          }
        }

        await manager.addTask({ name: "a", task: TaskAA });
        await manager.addTask({ name: "b", task: TaskBB });
        await manager.addTask({ name: "c", task: TaskCC });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          tasks: ["a", "b", "c"],
        });
        await expect(async () => observer.result).rejects.toThrow(/TaskBB error/);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(666);
      });

      it("cancel flow with all cancelable tasks", async () => {
        class SCTaskA extends SCTask { }

        class SCTaskB extends SCTask { }

        await manager.addTask({
          name: "a",
          task: SCTaskA,
          cancelable: true,
        });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true,
        });
        await manager.addTask({
          name: "series",
          task: SeriesFlowTask,
          cancelable: true,
        });

        const observer = await manager.run("series", {
          tasks: ["a", "b"],
        });
        await promise.delay(100);
        expect(observer.cancelable).toBeTruthy();

        await observer.cancel();

        const result = await observer.result;
        expect(result).toHaveLength(2);
        expect(isNumber(result[0])).toBeTruthy();
        expect(isNumber(result[1])).toBeTruthy();

        await observer.result;
      });

      it("cancel flow with first non-cancelable task should cancel flow", async () => {
        class TaskAA extends BaseTask {
          override async main() {
            await promise.delay(1000);
            this.result = 888;
          }
        }

        class SCTaskB extends SCTask { }

        await manager.addTask({
          name: "a",
          task: TaskAA,
        });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true,
        });
        await manager.addTask({
          name: "series",
          task: SeriesFlowTask,
          cancelable: true,
        });

        const observer = await manager.run("series", {
          tasks: ["a", "b"],
        });
        await promise.delay(300);
        expect(observer.cancelable).toBeTruthy();

        await promise.delay(800);

        await observer.cancel();

        const result = await observer.result;
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(888);
        expect(isNumber(result[1])).toBeTruthy();

        await observer.result;
      });
    });

    describe("parallel", () => {
      it("managed tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          arg: {
            suffix: "ateos",
          },
          tasks: ["a", "b"],
        });
        expect((await observer.result).sort()).toEqual([1, "suffix-ateos"].sort());
      });

      it("managed+unmanaged tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          arg: {
            suffix: "ateos",
          },
          tasks: ["a", "b", TaskC],
        });
        expect((await observer.result).sort()).toEqual([1, "suffix-ateos", "ateos"].sort());
      });

      it("run tasks with separate args", async () => {
        class SomeTask extends BaseTask {
          override main({ val }: { val: any }) {
            this.result = val;
          }
        }

        await manager.addTask({ name: "a", task: SomeTask });
        await manager.addTask({ name: "b", task: SomeTask });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          tasks: [
            {
              task: "a",
              args: {
                val: "ateos",
              },
            },
            {
              task: "b",
              args: {
                val: 888,
              },
            },
          ],
        });
        expect((await observer.result).sort()).toEqual(["ateos", 888].sort());
      });

      it("should not stop follow-up tasks is one of the task has thrown", async () => {
        const results: any[] = [];
        class TaskAA extends BaseTask {
          override main() {
            results.push(666);
          }
        }

        class TaskBB extends BaseTask {
          override main() {
            throw new Error("Task error");
          }
        }

        class TaskCC extends BaseTask {
          override main() {
            results.push(777);
          }
        }

        await manager.addTask({ name: "a", task: TaskAA });
        await manager.addTask({ name: "b", task: TaskBB });
        await manager.addTask({ name: "c", task: TaskCC });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          tasks: ["a", "b", "c"],
        });
        await expect(async () => observer.result).rejects.toThrow(/Task error/);

        await promise.delay(300);

        expect(results).toEqual([666, 777]);
      });

      it("cancel flow with all cancelable tasks", async () => {
        class SCTaskA extends SCTask { }

        class SCTaskB extends SCTask { }

        await manager.addTask({
          name: "a",
          task: SCTaskA,
          cancelable: true,
        });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true,
        });
        await manager.addTask({
          name: "parallel",
          task: ParallelFlowTask,
          cancelable: true,
        });

        const observer = await manager.run("parallel", {
          tasks: ["a", "b"],
        });
        await promise.delay(100);
        expect(observer.cancelable).toBeTruthy();

        await observer.cancel();

        const result = await observer.result;
        expect(result[0]).toBeTruthy();
        expect(result[1]).toBeTruthy();

        await observer.result;
      });

      it("cancel flow with one non-cancelable and one cancelable", async () => {
        class TaskAA extends BaseTask {
          override async main() {
            await promise.delay(1000);
            this.result = 888;
          }
        }

        class SCTaskB extends SCTask { }

        await manager.addTask({ name: "a", task: TaskAA });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true,
        });
        await manager.addTask({
          name: "parallel",
          task: ParallelFlowTask,
          cancelable: true,
        });

        const observer = await manager.run("parallel", {
          tasks: ["a", "b"],
        });

        await promise.delay(300);
        expect(observer.cancelable).toBeTruthy();

        await promise.delay(1000);

        await observer.cancel();

        const result = await observer.result;
        expect(result.sort()).toHaveLength(2);

        await observer.result;
      });

      // it.todo("correct process of case when one of non-cancelable task throws", async () => {

      // });
    });

    describe("try", () => {
      it("managed tasks", async () => {
        await manager.addTask({ name: "badA", task: TaskBadA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "try", task: TryFlowTask });

        const observer = await manager.run("try", {
          arg: {
            suffix: "ateos",
          },
          tasks: ["badA", "b"],
        });
        expect(await observer.result).toEqual("suffix-ateos");
      });

      it("managed+unmanaged tasks", async () => {
        await manager.addTask({ name: "badA", task: TaskBadA });
        await manager.addTask({ name: "try", task: TryFlowTask });

        const observer = await manager.run("try", {
          arg: {
            suffix: "ateos",
          },
          tasks: ["badA", TaskC],
        });
        expect(await observer.result).toEqual("ateos");
      });

      it("should throw if all tasks have failed", async () => {
        await manager.addTask({ name: "a", task: TaskBadA });
        await manager.addTask({ name: "b", task: TaskBadA });
        await manager.addTask({ name: "c", task: TaskBadA });
        await manager.addTask({ name: "try", task: TryFlowTask });

        const observer = await manager.run("try", {
          args: "ateos",
          tasks: ["a", "b", "c"],
        });
        await expect(async () => observer.result).rejects.toThrow(AggregateError);
      });

      // TODO: add more tests for canceling and other cases
    });

    describe("waterfall", () => {
      class TaskD extends BaseTask {
        override async main({ num }: { num: number }) {
          this.result = {
            num1: num,
            num2: 7,
          };
        }
      }

      class TaskE extends BaseTask {
        override async main({ num1, num2 }: { num1: number; num2: number }) {
          await promise.delay(10);
          this.result = num1 * num2;
        }
      }

      it("managed tasks", async () => {
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "waterfall", task: WaterfallFlowTask });

        const observer = await manager.run("waterfall", {
          arg: {
            num: 3,
          },
          tasks: ["d", "e"],
        });
        expect(await observer.result).toEqual(21);
      });

      it("managed+unmanaged tasks", async () => {
        class TaskF extends BaseTask {
          override async main(sum: number) {
            await promise.delay(10);
            this.result = `sum = ${sum}`;
          }
        }
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "waterfall", task: WaterfallFlowTask });

        const observer = await manager.run("waterfall", {
          arg: {
            num: 3,
          },
          tasks: ["d", "e", TaskF],
        });
        const result = await observer.result;
        expect(isString(result)).toBeTruthy();
        expect(result).toEqual("sum = 21");
      });
    });

    describe("race", () => {
      class TaskD extends BaseTask {
        override async main() {
          await promise.delay(500);
          this.result = 3;
        }
      }

      class TaskE extends BaseTask {
        override async main() {
          await promise.delay(300);
          this.result = 5;
        }
      }

      it("managed tasks", async () => {
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "race", task: RaceFlowTask });

        const observer = await manager.run("race", {
          tasks: ["d", "e"],
        });
        expect(await observer.result).toEqual(5);
      });

      it("managed+unmanaged tasks", async () => {
        class TaskF extends BaseTask {
          override async main() {
            await promise.delay(100);
            this.result = 7;
          }
        }
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "race", task: RaceFlowTask });

        const observer = await manager.run("race", {
          args: 3,
          tasks: ["d", "e", TaskF],
        });
        expect(await observer.result).toEqual(7);
      });
    });
  });
});
