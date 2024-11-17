import type { TaskManager } from "./manager";

import SeriesFlowTask from "./series_flow_task";
import ParallelFlowTask from "./parallel_flow_task";

export * from "./common";
export * from "./manager";
export * from "./base_task";
export * from "./flow_task";
export * from "./task_observer";
export * from "./try_flow_task";
export * from "./advanced_task";
export * from "./race_flow_task";
export * from "./isomorphic_task";
export * from "./waterfall_flow_task";
export { SeriesFlowTask, ParallelFlowTask };

/**
 * Runs task in series.
 *
 * @param {TaskManager} manager
 * @param {array} tasks array of task names
 */
export const runSeries = (manager: TaskManager, tasks: any[], arg?: any) =>
  manager.runOnce(SeriesFlowTask, { arg, tasks });

/**
 * Runs tasks in parallel.
 *
 * @param {TaskManager} manager
 * @param {array} tasks array of tasks
 */
export const runParallel = (manager: TaskManager, tasks: any[], arg?: any) =>
  manager.runOnce(ParallelFlowTask, { arg, tasks });
