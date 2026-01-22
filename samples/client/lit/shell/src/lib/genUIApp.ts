/**
 * GenUI Application Integration Module
 * Integrates all services for the complete GenUI application
 */

import { ConfigManager, globalConfig } from "./configManager";
import { ErrorHandler, globalErrorHandler } from "./errorHandler";
import { AgentCommunicationService, createAgentCommunicationService } from "./agentCommunicationService";

/**
 * GenUI App Singleton
 * Provides centralized access to all services
 */
export class GenUIApp {
  private static instance: GenUIApp | null = null;

  private configManager: ConfigManager;
  private errorHandler: ErrorHandler;
  private agentService: AgentCommunicationService | null = null;
  private initialized = false;

  private constructor() {
    this.configManager = globalConfig;
    this.errorHandler = globalErrorHandler;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GenUIApp {
    if (!GenUIApp.instance) {
      GenUIApp.instance = new GenUIApp();
    }
    return GenUIApp.instance;
  }

  /**
   * Initialize the application
   */
  async initialize(config?: any): Promise<boolean> {
    if (this.initialized) {
      this.errorHandler.warn("GenUIApp already initialized");
      return true;
    }

    try {
      // Update configuration if provided
      if (config) {
        this.configManager.update(config);
      }

      // Validate configuration
      const validation = this.configManager.validate();
      if (!validation.valid) {
        this.errorHandler.error("Configuration validation failed", undefined, {
          errors: validation.errors,
        });
        console.warn("Missing configuration:", validation.errors.join(", "));
      }

      // Initialize agent service
      this.agentService = createAgentCommunicationService(
        this.configManager,
        this.errorHandler,
        {
          enableRecursiveQueries: true,
          maxConcurrentRequests: 5,
        }
      );

      // Log initialization summary
      this.errorHandler.info("GenUIApp initialized successfully", this.configManager.getSummary());

      this.initialized = true;
      return true;
    } catch (error) {
      this.errorHandler.error("Failed to initialize GenUIApp", error);
      return false;
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get error handler
   */
  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * Get agent communication service
   */
  getAgentService(): AgentCommunicationService {
    if (!this.agentService) {
      throw new Error("AgentCommunicationService not initialized. Call initialize() first.");
    }
    return this.agentService;
  }

  /**
   * Execute a query
   */
  async query(text: string, conversationId?: string) {
    const service = this.getAgentService();
    return service.executeQuery(text, conversationId);
  }

  /**
   * Execute recursive queries
   */
  async recursiveQuery(text: string, conversationId?: string) {
    const service = this.getAgentService();
    return service.executeRecursiveQueries(text, conversationId);
  }

  /**
   * Get application health
   */
  getHealth() {
    if (!this.agentService) {
      return {
        initialized: false,
        healthy: false,
        errors: ["AgentCommunicationService not initialized"],
      };
    }

    return {
      initialized: true,
      ...this.agentService.getHealth(),
    };
  }

  /**
   * Get application summary
   */
  getSummary() {
    return {
      initialized: this.initialized,
      config: this.configManager.getSummary(),
      service: this.agentService?.getSummary(),
    };
  }

  /**
   * Get logs
   */
  getLogs(count?: number) {
    return this.errorHandler.getRecentLogs(count);
  }

  /**
   * Export logs
   */
  exportLogs(format: "json" | "csv" = "json") {
    if (format === "json") {
      return this.errorHandler.exportJSON();
    }
    return this.errorHandler.exportCSV();
  }

  /**
   * Clear cache
   */
  clearCache() {
    if (this.agentService) {
      this.agentService.clearCache();
    }
  }

  /**
   * Reset application
   */
  reset() {
    this.agentService = null;
    this.initialized = false;
    this.errorHandler.clear();
    this.configManager = new ConfigManager();
  }
}

/**
 * Global instance
 */
export const genUI = GenUIApp.getInstance();

/**
 * Initialize and export for use in components
 */
export async function initializeGenUI(config?: any) {
  return genUI.initialize(config);
}

/**
 * Export convenience functions
 */
export async function queryAgent(text: string, conversationId?: string) {
  if (!genUI.isInitialized()) {
    await genUI.initialize();
  }
  return genUI.query(text, conversationId);
}

export async function queryAgentRecursive(text: string, conversationId?: string) {
  if (!genUI.isInitialized()) {
    await genUI.initialize();
  }
  return genUI.recursiveQuery(text, conversationId);
}

export function getGenUIHealth() {
  return genUI.getHealth();
}

export function getGenUISummary() {
  return genUI.getSummary();
}
