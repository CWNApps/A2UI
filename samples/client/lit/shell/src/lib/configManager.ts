/**
 * Configuration Management for GenUI Application
 * Handles environment variables, runtime configuration, and validation
 */

export interface Config {
  // API Configuration
  apiBaseUrl: string;
  apiKey: string;
  projectId: string;
  agentId: string;
  studioId: string;
  
  // Agent Configuration
  agentVersion: string;
  conversationId: string;
  userId: string;
  
  // Query Configuration
  maxQueryDepth: number;
  maxQueueSize: number;
  queryTimeoutMs: number;
  
  // Caching Configuration
  enableCaching: boolean;
  cacheTtlMs: number;
  maxCacheSize: number;
  
  // Visualization Configuration
  maxTableRows: number;
  enableCharts: boolean;
  enableMetrics: boolean;
  
  // Error Handling Configuration
  maxRetries: number;
  retryDelayMs: number;
  enableDetailedErrorMessages: boolean;
  
  // Logging Configuration
  logLevel: string;
  enableLogging: boolean;
  exportLogsEndpoint?: string;
}

export const DEFAULT_CONFIG: Config = {
  apiBaseUrl: "https://api.relevance.ai",
  apiKey: "",
  projectId: "",
  agentId: "",
  studioId: "",
  
  agentVersion: "latest",
  conversationId: "",
  userId: "",
  
  maxQueryDepth: 5,
  maxQueueSize: 20,
  queryTimeoutMs: 30000,
  
  enableCaching: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100,
  
  maxTableRows: 100,
  enableCharts: true,
  enableMetrics: true,
  
  maxRetries: 3,
  retryDelayMs: 1000,
  enableDetailedErrorMessages: true,
  
  logLevel: "INFO",
  enableLogging: true,
};

/**
 * Configuration manager
 */
export class ConfigManager {
  private config: Config;
  private listeners: (() => void)[] = [];
  private isDevelopment: boolean;

  constructor(initialConfig: Partial<Config> = {}) {
    this.isDevelopment = process.env.NODE_ENV !== "production";
    this.config = { ...DEFAULT_CONFIG, ...initialConfig };
    this.loadFromEnvironment();
  }

  /**
   * Load configuration from environment variables (Vite: VITE_ prefix)
   */
  private loadFromEnvironment() {
    const env = (typeof process !== "undefined" && process.env) || ({} as Record<string, string>);
    const viteEnv = import.meta?.env || ({} as Record<string, string>);

    // Try Vite first, then fallback to regular env
    const getEnv = (key: string) => viteEnv[`VITE_${key}`] || env[key];

    // API Configuration
    if (getEnv("API_BASE_URL")) this.config.apiBaseUrl = getEnv("API_BASE_URL")!;
    if (getEnv("API_KEY")) this.config.apiKey = getEnv("API_KEY")!;
    if (getEnv("PROJECT_ID")) this.config.projectId = getEnv("PROJECT_ID")!;
    if (getEnv("AGENT_ID")) this.config.agentId = getEnv("AGENT_ID")!;
    if (getEnv("RELEVANCE_STUDIO_ID")) this.config.studioId = getEnv("RELEVANCE_STUDIO_ID")!;
    else if (getEnv("STUDIO_ID")) this.config.studioId = getEnv("STUDIO_ID")!;

    // Agent Configuration
    if (getEnv("AGENT_VERSION")) this.config.agentVersion = getEnv("AGENT_VERSION")!;
    if (getEnv("CONVERSATION_ID")) this.config.conversationId = getEnv("CONVERSATION_ID")!;
    if (getEnv("USER_ID")) this.config.userId = getEnv("USER_ID")!;

    // Query Configuration
    if (getEnv("MAX_QUERY_DEPTH")) this.config.maxQueryDepth = parseInt(getEnv("MAX_QUERY_DEPTH")!, 10);
    if (getEnv("MAX_QUEUE_SIZE")) this.config.maxQueueSize = parseInt(getEnv("MAX_QUEUE_SIZE")!, 10);
    if (getEnv("QUERY_TIMEOUT_MS")) this.config.queryTimeoutMs = parseInt(getEnv("QUERY_TIMEOUT_MS")!, 10);

    // Caching Configuration
    if (getEnv("ENABLE_CACHING")) this.config.enableCaching = getEnv("ENABLE_CACHING") === "true";
    if (getEnv("CACHE_TTL_MS")) this.config.cacheTtlMs = parseInt(getEnv("CACHE_TTL_MS")!, 10);
    if (getEnv("MAX_CACHE_SIZE")) this.config.maxCacheSize = parseInt(getEnv("MAX_CACHE_SIZE")!, 10);

    // Visualization Configuration
    if (getEnv("MAX_TABLE_ROWS")) this.config.maxTableRows = parseInt(getEnv("MAX_TABLE_ROWS")!, 10);
    if (getEnv("ENABLE_CHARTS")) this.config.enableCharts = getEnv("ENABLE_CHARTS") === "true";
    if (getEnv("ENABLE_METRICS")) this.config.enableMetrics = getEnv("ENABLE_METRICS") === "true";

    // Error Handling Configuration
    if (getEnv("MAX_RETRIES")) this.config.maxRetries = parseInt(getEnv("MAX_RETRIES")!, 10);
    if (getEnv("RETRY_DELAY_MS")) this.config.retryDelayMs = parseInt(getEnv("RETRY_DELAY_MS")!, 10);
    if (getEnv("ENABLE_DETAILED_ERRORS")) this.config.enableDetailedErrorMessages = getEnv("ENABLE_DETAILED_ERRORS") === "true";

    // Logging Configuration
    if (getEnv("LOG_LEVEL")) this.config.logLevel = getEnv("LOG_LEVEL")!;
    if (getEnv("ENABLE_LOGGING")) this.config.enableLogging = getEnv("ENABLE_LOGGING") === "true";
    if (getEnv("EXPORT_LOGS_ENDPOINT")) this.config.exportLogsEndpoint = getEnv("EXPORT_LOGS_ENDPOINT");
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Config> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get specific config value
   */
  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  /**
   * Set specific config value
   */
  set<K extends keyof Config>(key: K, value: Config[K]) {
    this.config[key] = value;
    this.notifyListeners();
  }

  /**
   * Update multiple config values
   */
  update(partial: Partial<Config>) {
    this.config = { ...this.config, ...partial };
    this.notifyListeners();
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.apiBaseUrl) errors.push("apiBaseUrl is required");
    if (!this.config.apiKey) errors.push("apiKey is required (set VITE_API_KEY)");
    if (!this.config.projectId) errors.push("projectId is required (set VITE_PROJECT_ID)");
    if (!this.config.agentId) errors.push("agentId is required (set VITE_AGENT_ID)");
    if (!this.config.studioId) errors.push("studioId is required (set VITE_RELEVANCE_STUDIO_ID or VITE_STUDIO_ID)");

    if (this.config.maxQueryDepth < 1) errors.push("maxQueryDepth must be at least 1");
    if (this.config.maxQueueSize < 1) errors.push("maxQueueSize must be at least 1");
    if (this.config.queryTimeoutMs < 100) errors.push("queryTimeoutMs must be at least 100");

    if (this.config.maxTableRows < 1) errors.push("maxTableRows must be at least 1");
    if (this.config.maxRetries < 0) errors.push("maxRetries must be non-negative");

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    return this.validate().valid;
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): string[] {
    return this.validate().errors;
  }

  /**
   * Add configuration change listener
   */
  onChange(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of config change
   */
  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Get configuration for agent requests
   */
  getAgentRequestConfig() {
    return {
      apiBaseUrl: this.config.apiBaseUrl,
      apiKey: this.config.apiKey,
      projectId: this.config.projectId,
      agentId: this.config.agentId,
      studioId: this.config.studioId,
      agentVersion: this.config.agentVersion,
      timeout: this.config.queryTimeoutMs,
    };
  }

  /**
   * Get configuration for query management
   */
  getQueryConfig() {
    return {
      maxDepth: this.config.maxQueryDepth,
      maxQueueSize: this.config.maxQueueSize,
      timeout: this.config.queryTimeoutMs,
      enableCaching: this.config.enableCaching,
      cacheTtl: this.config.cacheTtlMs,
      maxCacheSize: this.config.maxCacheSize,
    };
  }

  /**
   * Get configuration for error handling
   */
  getErrorConfig() {
    return {
      maxRetries: this.config.maxRetries,
      retryDelayMs: this.config.retryDelayMs,
      enableDetailedErrorMessages: this.config.enableDetailedErrorMessages,
    };
  }

  /**
   * Export configuration as JSON
   */
  exportJSON(): string {
    const safe = { ...this.config };
    // Don't export sensitive data
    safe.apiKey = "***REDACTED***";
    return JSON.stringify(safe, null, 2);
  }

  /**
   * Get summary of configuration
   */
  getSummary(): Record<string, any> {
    return {
      environment: this.isDevelopment ? "development" : "production",
      agent: {
        id: this.config.agentId,
        version: this.config.agentVersion,
        apiUrl: this.config.apiBaseUrl,
      },
      query: {
        maxDepth: this.config.maxQueryDepth,
        timeout: `${this.config.queryTimeoutMs}ms`,
      },
      caching: {
        enabled: this.config.enableCaching,
        ttl: `${this.config.cacheTtlMs / 1000}s`,
      },
      visualization: {
        maxTableRows: this.config.maxTableRows,
        chartsEnabled: this.config.enableCharts,
        metricsEnabled: this.config.enableMetrics,
      },
      errorHandling: {
        maxRetries: this.config.maxRetries,
        retryDelay: `${this.config.retryDelayMs}ms`,
      },
    };
  }
}

/**
 * Global configuration instance
 */
export const globalConfig = new ConfigManager();
