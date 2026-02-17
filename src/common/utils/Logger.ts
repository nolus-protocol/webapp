class LoggerClass {
  log = window.console.log.bind(window.console, "[LOG]: %s");
  info = window.console.log.bind(window.console, "\x1b[34m[INFO]: %s");
  warning = window.console.log.bind(window.console, "\x1b[33m[WARNING]: %s");
  error = window.console.error.bind(window.console);
}

export const Logger = new LoggerClass();
