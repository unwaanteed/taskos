import typeOf from "type-detect";

import { BaseTask } from "./base_task";

const ALLOWED_TYPES = ["Object", "undefined", "null"];

/**
 * Isomorphic task taskes only one argument as Object instead of many arguments.
 *
 * In this case, you don’t need to know the task execution signature, which facilitates the interaction between tasks,
 * allows you to load parameters from configuration files or other sources.
 */
export class IsomorphicTask extends BaseTask {
  override async _run(...args: any[]) {
    await this.main(this._validateArgs(args));
    return this.result;
  }

  // eslint-disable-next-line class-methods-use-this
  protected _validateArgs(args: any[]) {
    if (args.length > 1 || !ALLOWED_TYPES.includes(typeOf(args[0]))) {
      throw new Error("Invalid argument");
    }

    return args[0];
  }
}
