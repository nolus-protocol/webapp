import { Mode } from "@/config/global";

class Logger {
  log: Function = () => {};
  info: Function = () => {};
  warning: Function = () => {};
  error: Function = () => {};

  constructor() {
    if (import.meta.env.VITE_MODE != Mode.prod) {
      this.log = window.console.log.bind(window.console, "[LOG]: %s");
      this.info = window.console.log.bind(window.console, "\x1b[34m[INFO]: %s");
      this.warning = window.console.log.bind(window.console, "\x1b[33m[WARNING]: %s");
    }
    this.error = window.console.error.bind(window.console);
  }
}

const l = new Logger();

export { l as Logger };
