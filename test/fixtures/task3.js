import { Task, BaseTask } from "../../dist";

@Task("3")
export default class Task3 extends BaseTask {
  // eslint-disable-next-line class-methods-use-this
  main() {
    return 3;
  }
}
