type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

interface LoggerOptions {
  minLevel?: LogLevel;
  enableConsole?: boolean;
  enableStorage?: boolean;
  maxStoredLogs?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const STORAGE_KEY = 'fieldsync_logs';
const DEFAULT_MAX_LOGS = 1000;

class Logger {
  private options: Required<LoggerOptions>;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      minLevel: options.minLevel ?? (import.meta.env.DEV ? 'debug' : 'info'),
      enableConsole: options.enableConsole ?? true,
      enableStorage: options.enableStorage ?? true,
      maxStoredLogs: options.maxStoredLogs ?? DEFAULT_MAX_LOGS,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.options.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.error) {
      parts.push(`\n${entry.error.stack || entry.error.message}`);
    }

    return parts.join(' ');
  }

  private storeLog(entry: LogEntry): void {
    if (!this.options.enableStorage) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const logs: LogEntry[] = stored ? JSON.parse(stored) : [];

      logs.push(entry);

      // Trim old logs if exceeding max
      while (logs.length > this.options.maxStoredLogs) {
        logs.shift();
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // Storage might be full or unavailable
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    // Console output
    if (this.options.enableConsole) {
      const formatted = this.formatEntry(entry);
      switch (level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          break;
      }
    }

    // Store in localStorage
    this.storeLog(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  // Get stored logs for debugging
  getLogs(): LogEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Clear stored logs
  clearLogs(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Export logs as text file
  exportLogs(): void {
    const logs = this.getLogs();
    const content = logs.map((entry) => this.formatEntry(entry)).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldsync-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  }
}

// Default logger instance
export const logger = new Logger();

// Specific loggers for different domains
export const syncLogger = {
  operationQueued: (table: string, type: string) =>
    logger.info('Operation queued for sync', { table, type }),

  syncStarted: () =>
    logger.info('Sync started'),

  syncCompleted: (count: number) =>
    logger.info('Sync completed', { operationsProcessed: count }),

  syncFailed: (error: Error) =>
    logger.error('Sync failed', error),

  conflictResolved: (table: string, resolution: string) =>
    logger.warn('Sync conflict resolved', { table, resolution }),
};

export const authLogger = {
  loginAttempt: (email: string) =>
    logger.info('Login attempt', { email }),

  loginSuccess: (userId: string) =>
    logger.info('Login successful', { userId }),

  loginFailed: (email: string, error: Error) =>
    logger.error('Login failed', error, { email }),

  logout: (userId: string) =>
    logger.info('User logged out', { userId }),

  sessionExpired: () =>
    logger.warn('Session expired'),
};

export const photoLogger = {
  captureStarted: (propertyId: string) =>
    logger.debug('Photo capture started', { propertyId }),

  captureCompleted: (photoId: string, size: number) =>
    logger.info('Photo captured', { photoId, sizeKB: Math.round(size / 1024) }),

  uploadStarted: (photoId: string) =>
    logger.debug('Photo upload started', { photoId }),

  uploadCompleted: (photoId: string) =>
    logger.info('Photo uploaded', { photoId }),

  uploadFailed: (photoId: string, error: Error) =>
    logger.error('Photo upload failed', error, { photoId }),
};

// Make logger available globally in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { logger: Logger }).logger = logger;
}
