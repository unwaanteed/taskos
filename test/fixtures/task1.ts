import { Task, BaseTask } from "../../src";

@Task({
  name: "1",
})
export default class Task1 extends BaseTask {
  // eslint-disable-next-line class-methods-use-this
  override main() {
    return 1;
  }
}
