/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable no-restricted-syntax */
/* eslint-disable class-methods-use-this */
import "reflect-metadata/lite";
import typeOf from "type-detect";

import { BaseTask, TaskManager, IsomorphicTask } from "../src";


describe("tasks", () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  describe("isomorphic tasks", () => {
    class BadTask extends IsomorphicTask { }

    class IsomorphicA extends IsomorphicTask {
      override main(data: any) {
        this.result = typeOf(data);
      }
    }

    it("should throw if #main() is not implemented", async () => {
      await manager.addTask({ name: "bad", task: BadTask });

      await expect(async () => manager.runAndWait("bad", {})).rejects.toThrow(/Not implemented/);
    });

    it("throw in #main()", async () => {
      class A extends IsomorphicTask {
        override main() {
          throw new Error("bad bad bad");
        }
      }

      await manager.addTask({ name: "a", task: A });
      await expect(async () => manager.runAndWait("a")).rejects.toThrow(new Error("bad bad bad"));
    });

    it("should throw if pass more then one argument", async () => {
      await manager.addTask({ name: "a", task: IsomorphicA });

      await expect(async () => manager.runAndWait("a", { a: 1 }, { b: 2 })).rejects.toThrow(/Invalid argument/);
    });

    describe("should throw if non-object argument is passed", () => {
      const vars = [
        12,
        "abc",
        String("abc"),
        new Date(),
        /^word/,
        ["a", "b"],
        BaseTask,
        new Map(),
        new Set(),
        new Int16Array(),
        new Error(),
      ];

      for (const v of vars) {
        // eslint-disable-next-line no-loop-func
        it(typeOf(v), async () => {
          await manager.addTask({ name: "a", task: IsomorphicA });

          await expect(async () => manager.runAndWait("a", v)).rejects.toThrow(/Invalid argument/);
        });
      }
    });

    describe("allowed arguments", () => {
      const allowed = {
        "Object.create(null)": [Object.create(null)],
        "{}": [{}],
        "new BaseTask()": [new BaseTask()],
        null: [null],
        undefined: [undefined],
      };

      for (const [key, val] of Object.entries(allowed)) {
        it(key, async () => {
          await manager.addTask({ name: "a", task: IsomorphicA });

          expect(await manager.runAndWait("a", ...val)).toEqual(typeOf(val[0]));
        });
      }
    });
  });
});
