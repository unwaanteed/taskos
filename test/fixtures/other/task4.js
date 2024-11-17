import { Task, BaseTask } from "../../../dist";

@Task({
  name: "4",
})
export default class Task4 extends BaseTask {
  main() {
    return 4;
  }
}
