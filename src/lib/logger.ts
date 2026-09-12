export function createLogger(verbose = false): Logger {
  function write(level: LogLevel, message: string): void {
    process.stderr.write(`[${level}] ${message}\n`);
  }

  return {
    debug(message) {
      if (verbose) {
        write("debug", message);
      }
    },
    info: (message) => write("info", message),
    warn: (message) => write("warn", message),
    error: (message) => write("error", message),
  };
}

export type Logger = {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

type LogLevel = "debug" | "info" | "warn" | "error";
