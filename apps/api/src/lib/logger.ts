type LogLevel = "info" | "warn" | "error";

const write = (level: LogLevel, event: string, details: Record<string, unknown> = {}) => {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details
  });
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(record + "\n");
};

export const logger = {
  info: (event: string, details?: Record<string, unknown>) => write("info", event, details),
  warn: (event: string, details?: Record<string, unknown>) => write("warn", event, details),
  error: (event: string, details?: Record<string, unknown>) => write("error", event, details)
};
