/* eslint-disable class-methods-use-this */
import { IsomorphicTask } from "./isomorphic_task";

// TODO: tests
export class AdvancedTask extends IsomorphicTask {
  override async _run(...args: any[]) {
    this._validateArgs(args);
    try {
      await this.initialize(...args);
      await this.main(...args);
      await this.uninitialize(...args);
    } catch (err) {
      return this.error(err, ...args);
    }
    return this.result;
  }

  async runAnotherTask(name: string, ...args: any[]) {
    return this.manager.runAndWait(name, ...args);
  }

  /**
   * The method in which you can implement the initializing logic and is called before the main() method.
   */
  initialize(...args: any[]) {}

  /**
   * The method in which you can implement the final logic and is called after the main() method.
   */
  uninitialize(...args: any[]) {}

  /**
   * Calls in case of error.
   *
   * @param {Error} err
   */
  error(err: any, ...args: any[]) {
    throw err;
  }
}
