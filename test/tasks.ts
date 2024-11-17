/* eslint-disable no-await-in-loop */

import type { Deferred } from "@unwanted/promise";

import * as promise from "@unwanted/promise";

import { BaseTask } from "../src";

export class SCTask extends BaseTask {
  public _runDefer: any = null;
  public _suspendDefer: any = null;
  public _cancelDefer: any = null;
  public reallySuspended = false;
  public reallyResumed = false;
  public _maxTicks: number = 0;
  public data: any;

  override async _run(maxTimeout = 1000) {
    this._maxTicks = maxTimeout / 10;
    this.data = 0;
    this._runDefer = promise.defer();
    this.main();
    return this._runDefer.promise;
  }

  override async main() {
    this.reallySuspended = false;
    for (;;) {
      await promise.delay(10);
      this.data++;
      if (this.data >= this._maxTicks) {
        this._runDefer.resolve(this.data);
        break;
      }

      if (this._suspendDefer !== null) {
        this._suspendDefer.resolve();
        this.reallyResumed = false;
        this.reallySuspended = true;
        break;
      }
      if (this._cancelDefer !== null) {
        this._runDefer.resolve(this.data);
        await promise.delay(300);
        this._cancelDefer.resolve();
        break;
      }
    }
  }

  override suspend(defer: Deferred) {
    this._suspendDefer = defer;
  }

  override async resume(defer: Deferred) {
    promise.delay(200).then(() => {
      this._suspendDefer = null;
      this.main();
      this.reallyResumed = true;
      defer.resolve?.();
    });
  }

  override cancel(defer: Deferred) {
    this._cancelDefer = defer;
  }
}

export class SimpleTask extends BaseTask {
  public value = 0;

  override async main(value: number, timeout: number) {
    this.value++;
    if (typeof timeout === "number") {
      await promise.delay(timeout);
    }
    this.result = value;
  }
}
