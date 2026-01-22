/**
 * Comprehensive Error Handling & Logging for GenUI Agent Integration
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

export interface ErrorContext {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  userId?: string;
  queryDepth?: number;
  retryCount?: number;
}

export class ErrorHandler {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private listeners: ((entry: LogEntry) => void)[] = [];

  /**
   * Log a message
   */
  log(level: LogLevel, message: string, context?: Record<string, any>, stack?: string) {
    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      message,
      context,
      stack,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(entry));

    // Also log to console
    this.consoleLog(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | string, context?: Record<string, any>) {
    const stack = error instanceof Error ? error.stack : undefined;
    const msg = error instanceof Error ? `${message}: ${error.message}` : `${message}: ${error}`;
    this.log(LogLevel.ERROR, msg, context, stack);
  }

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error | string, context?: Record<string, any>) {
    const stack = error instanceof Error ? error.stack : undefined;
    const msg = error instanceof Error ? `${message}: ${error.message}` : `${message}: ${error}`;
    this.log(LogLevel.FATAL, msg, context, stack);
  }

  /**
   * Add log listener
   */
  addListener(listener: (entry: LogEntry) => void) {
    this.listeners.push(listener);
  }

  /**
   * Remove log listener
   */
  removeListener(listener: (entry: LogEntry) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Get logs
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.logs];
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear logs
   */
  clear() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Export logs as CSV
   */
  exportCSV(): string {
    const headers = ["Timestamp", "Level", "Message", "Context"];
    const rows = this.logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.level,
      log.message,
      JSON.stringify(log.context || {}),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    return csv;
  }

  /**
   * Console logging with colors (for development)
   */
  private consoleLog(entry: LogEntry) {
    const colors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: "\x1b[36m", // Cyan
      [LogLevel.INFO]: "\x1b[32m", // Green
      [LogLevel.WARN]: "\x1b[33m", // Yellow
      [LogLevel.ERROR]: "\x1b[31m", // Red
      [LogLevel.FATAL]: "\x1b[35m", // Magenta
    };

    const reset = "\x1b[0m";
    const color = colors[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();

    const message = `${color}[${entry.level}] ${timestamp}${reset} ${entry.message}`;

    if (entry.level === LogLevel.DEBUG) {
      console.debug(message, entry.context);
    } else if (entry.level === LogLevel.INFO) {
      console.info(message, entry.context);
    } else if (entry.level === LogLevel.WARN) {
      console.warn(message, entry.context);
    } else if (entry.level === LogLevel.ERROR) {
      console.error(message, entry.context, entry.stack);
    } else if (entry.level === LogLevel.FATAL) {
      console.error(message, entry.context, entry.stack);
    }
  }
}

/**
 * Specific error types for agent communication
 */
export class AgentError extends Error {
  statusCode?: number;
  requestId?: string;
  endpoint?: string;
  retryable: boolean;

  constructor(
    message: string,
    statusCode?: number,
    options?: { requestId?: string; endpoint?: string; retryable?: boolean }
  ) {
    super(message);
    this.name = "AgentError";
    this.statusCode = statusCode;
    this.requestId = options?.requestId;
    this.endpoint = options?.endpoint;
    this.retryable = options?.retryable ?? false;
  }
}

export class ValidationError extends Error {
  field?: string;
  value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
  }
}

export class TimeoutError extends Error {
  duration: number;

  constructor(message: string, duration: number) {
    super(message);
    this.name = "TimeoutError";
    this.duration = duration;
  }
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Exponential backoff calculator
 */
export function calculateBackoff(attempt: number, policy: RetryPolicy): number {
  const delayMs = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(delayMs, policy.maxDelayMs);
}

/**
 * Retry executor
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  logger?: ErrorHandler
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      logger?.debug(`Attempt ${attempt}/${policy.maxAttempts}`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRetryable =
        error instanceof AgentError && error.retryable
          ? true
          : error instanceof AgentError && error.statusCode
            ? policy.retryableStatusCodes.includes(error.statusCode)
            : true;

      if (attempt === policy.maxAttempts || !isRetryable) {
        logger?.error(`Failed after ${attempt} attempts`, lastError, {
          isRetryable,
        });
        throw lastError;
      }

      const delayMs = calculateBackoff(attempt, policy);
      logger?.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error("Unknown error");
}

/**
 * Validate HTTP response
 */
export function validateHttpResponse(
  status: number,
  data: any,
  endpoint: string
): { valid: boolean; error?: string } {
  if (status === 422) {
    // Unprocessable Entity
    const fieldErrors = data?.errors || [];
    const errorMsg = fieldErrors.length > 0 ? fieldErrors[0]?.message : data?.message || "Validation error";
    return {
      valid: false,
      error: `[422] Validation Error: ${errorMsg}. Check request payload for missing or invalid fields.`,
    };
  }

  if (status === 400) {
    return {
      valid: false,
      error: `[400] Bad Request: ${data?.message || "Invalid request"}`,
    };
  }

  if (status === 401 || status === 403) {
    return {
      valid: false,
      error: `[${status}] Authentication Error: Check API credentials`,
    };
  }

  if (status === 404) {
    return {
      valid: false,
      error: `[404] Not Found: Endpoint ${endpoint} does not exist`,
    };
  }

  if (status >= 500) {
    return {
      valid: false,
      error: `[${status}] Server Error: ${data?.message || "Internal server error"}. Please retry.`,
    };
  }

  if (status >= 400) {
    return {
      valid: false,
      error: `[${status}] Request Error: ${data?.message || "Unknown error"}`,
    };
  }

  if (!data || typeof data !== "object") {
    return {
      valid: false,
      error: "Invalid response format: expected JSON object",
    };
  }

  return { valid: true };
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();
