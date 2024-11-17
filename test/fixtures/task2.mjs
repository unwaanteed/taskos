import { Task, BaseTask } from "../../dist";

@Task({
  name: "2",
})
export default class Task2 extends BaseTask {
  // eslint-disable-next-line class-methods-use-this
  main() {
    return 2;
  }
}
