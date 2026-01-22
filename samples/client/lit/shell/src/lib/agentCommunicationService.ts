/**
 * Agent Communication Service - High-level API for Relevance AI Agent interaction
 * Combines payload building, error handling, caching, and recursive querying
 */

import {
  buildAgentRequestPayload,
  validateAgentRequestPayload,
  extractPayloadFromResponse,
  shouldFollowUp,
  generateFollowUpQuery,
} from "./agentPayloadBuilder";
import { renderA2UIPayload } from "./a2uiRenderer";
import { RecursiveQueryManager } from "./recursiveQueryEngine";
import { ErrorHandler, AgentError, executeWithRetry, DEFAULT_RETRY_POLICY, validateHttpResponse } from "./errorHandler";
import { ConfigManager } from "./configManager";
import { createAuthHeader } from "./relevanceConfig";

export interface AgentResponse {
  status: number;
  data: any;
  timestamp: number;
  requestId?: string;
}

export interface QueryResult {
  query: string;
  response: AgentResponse;
  visualizationHtml?: string;
  followUpQueries?: string[];
  depth: number;
  cached: boolean;
}

export interface AgentServiceConfig {
  configManager: ConfigManager;
  errorHandler: ErrorHandler;
  enableRecursiveQueries?: boolean;
  maxConcurrentRequests?: number;
}

export class AgentCommunicationService {
  private configManager: ConfigManager;
  private errorHandler: ErrorHandler;
  private queryManager: RecursiveQueryManager;
  private enableRecursiveQueries: boolean;
  private maxConcurrentRequests: number;
  private activeRequests: Map<string, Promise<AgentResponse>>;
  private requestCache: Map<string, { data: any; timestamp: number }>;

  constructor(config: AgentServiceConfig) {
    this.configManager = config.configManager;
    this.errorHandler = config.errorHandler;
    this.enableRecursiveQueries = config.enableRecursiveQueries ?? true;
    this.maxConcurrentRequests = config.maxConcurrentRequests ?? 5;
    this.activeRequests = new Map();
    this.requestCache = new Map();

    this.queryManager = new RecursiveQueryManager({
      maxDepth: this.configManager.get("maxQueryDepth"),
      maxQueueSize: this.configManager.get("maxQueueSize"),
      timeout: this.configManager.get("queryTimeoutMs"),
      enableAutoFollow: this.enableRecursiveQueries,
      enableCaching: this.configManager.get("enableCaching"),
    });

    this.errorHandler.info("AgentCommunicationService initialized", {
      apiBase: this.configManager.get("apiBaseUrl"),
      agentId: this.configManager.get("agentId"),
      recursiveQueriesEnabled: this.enableRecursiveQueries,
    });
  }

  /**
   * Execute a single query against the agent
   */
  async executeQuery(query: string, conversationId?: string): Promise<QueryResult> {
    const cId = conversationId || this.configManager.get("conversationId");

    // Check cache first
    const cacheKey = `${query}|${cId}`;
    if (this.configManager.get("enableCaching")) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.errorHandler.debug("Cache hit", { query, cacheKey });
        return {
          query,
          response: cached,
          depth: 0,
          cached: true,
        };
      }
    }

    try {
      // Wait if too many concurrent requests
      while (this.activeRequests.size >= this.maxConcurrentRequests) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Execute with retry logic
      const response = await executeWithRetry(
        () => this.executeAgentRequest(query, cId),
        {
          maxAttempts: this.configManager.get("maxRetries"),
          initialDelayMs: this.configManager.get("retryDelayMs"),
          maxDelayMs: this.configManager.get("queryTimeoutMs"),
          backoffMultiplier: 2,
          retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        },
        this.errorHandler
      );

      // Cache the response
      if (this.configManager.get("enableCaching")) {
        this.setInCache(cacheKey, response);
      }

      // Extract visualization payload
      const payload = extractPayloadFromResponse(response.data);
      let visualizationHtml: string | undefined;
      if (payload) {
        visualizationHtml = renderA2UIPayload(payload);
      }

      // Determine if follow-up queries are needed
      let followUpQueries: string[] = [];
      if (this.enableRecursiveQueries && shouldFollowUp(response.data)) {
        const followUp = generateFollowUpQuery(query, response.data);
        if (followUp) {
          followUpQueries = [followUp];
        }
      }

      const result: QueryResult = {
        query,
        response,
        visualizationHtml,
        followUpQueries,
        depth: 0,
        cached: false,
      };

      this.errorHandler.info("Query executed successfully", {
        query: query.substring(0, 100),
        hasVisualization: !!visualizationHtml,
        hasFollowUp: followUpQueries.length > 0,
      });

      return result;
    } catch (error) {
      this.errorHandler.error("Query execution failed", error, { query });
      throw error;
    }
  }

  /**
   * Execute a recursive query chain
   */
  async executeRecursiveQueries(
    initialQuery: string,
    conversationId?: string
  ): Promise<QueryResult[]> {
    const cId = conversationId || this.configManager.get("conversationId");
    const results: QueryResult[] = [];

    if (!this.enableRecursiveQueries) {
      // Just execute single query
      return [await this.executeQuery(initialQuery, cId)];
    }

    try {
      const queryResults = await this.queryManager.executeRecursiveQueries(
        initialQuery,
        async (query: string, depth: number): Promise<any> => {
          const result = await this.executeQuery(query, cId);
          results.push({ ...result, depth });
          return result.response.data;
        }
      );

      this.errorHandler.info("Recursive queries completed", {
        initialQuery: initialQuery.substring(0, 100),
        totalQueries: results.length,
        depth: results.length > 0 ? Math.max(...results.map((r) => r.depth)) : 0,
      });

      return results;
    } catch (error) {
      this.errorHandler.error("Recursive query execution failed", error, {
        initialQuery: initialQuery.substring(0, 100),
        resultsCollected: results.length,
      });
      throw error;
    }
  }

  /**
   * Execute raw agent request
   */
  private async executeAgentRequest(query: string, conversationId: string): Promise<AgentResponse> {
    const agentId = this.configManager.get("agentId");
    const apiKey = this.configManager.get("apiKey");
    const apiBaseUrl = this.configManager.get("apiBaseUrl");
    const projectId = this.configManager.get("projectId");

    if (!agentId || !apiKey || !projectId) {
      throw new AgentError("Missing required credentials (agentId, projectId or apiKey)");
    }

    // Build agent request payload for /trigger endpoint (requires message.role + message.content)
    const payload = buildAgentRequestPayload(
      agentId,
      conversationId,
      query,
      {
        userId: this.configManager.get("userId"),
      },
      "trigger"
    );

    // Validate payload (throws if invalid)
    try {
      validateAgentRequestPayload(payload, "trigger");
    } catch (error) {
      throw new AgentError(
        `Invalid agent request payload: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Build endpoint URL for /trigger endpoint
    const endpoint = `${apiBaseUrl}/agents/trigger`;

    this.errorHandler.debug("Executing agent request", {
      endpoint,
      agentId,
      query: query.substring(0, 100),
      payload: JSON.stringify(payload).substring(0, 200),
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: createAuthHeader(projectId, apiKey),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.configManager.get("queryTimeoutMs")),
      });

      const data = await response.json();
      const requestId = response.headers.get("x-request-id") || undefined;

      // Validate response
      const validation = validateHttpResponse(response.status, data, endpoint);
      if (!validation.valid) {
        const agentError = new AgentError(validation.error, response.status, {
          requestId,
          endpoint,
          retryable: response.status >= 500 || [408, 429].includes(response.status),
        });
        throw agentError;
      }

      if (!response.ok) {
        throw new AgentError(`HTTP ${response.status}: ${data?.message || "Unknown error"}`, response.status, {
          requestId,
          endpoint,
          retryable: response.status >= 500,
        });
      }

      return {
        status: response.status,
        data,
        timestamp: Date.now(),
        requestId,
      };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new AgentError(`Network error: ${error.message}`, undefined, {
          endpoint,
          retryable: true,
        });
      }
      if (error instanceof AgentError) {
        throw error;
      }
      throw new AgentError(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): AgentResponse | null {
    if (!this.configManager.get("enableCaching")) {
      return null;
    }

    const cached = this.requestCache.get(key);
    if (!cached) {
      return null;
    }

    // Check TTL
    const ttl = this.configManager.get("cacheTtlMs");
    if (Date.now() - cached.timestamp > ttl) {
      this.requestCache.delete(key);
      return null;
    }

    return {
      status: 200,
      data: cached.data,
      timestamp: cached.timestamp,
    };
  }

  /**
   * Set in cache
   */
  private setInCache(key: string, response: AgentResponse) {
    if (!this.configManager.get("enableCaching")) {
      return;
    }

    // Implement simple LRU: if cache is full, remove oldest
    const maxSize = this.configManager.get("maxCacheSize");
    if (this.requestCache.size >= maxSize) {
      const firstKey = this.requestCache.keys().next().value;
      this.requestCache.delete(firstKey);
    }

    this.requestCache.set(key, {
      data: response.data,
      timestamp: response.timestamp,
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.requestCache.clear();
    this.errorHandler.info("Cache cleared");
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.requestCache.size,
      maxSize: this.configManager.get("maxCacheSize"),
      enabled: this.configManager.get("enableCaching"),
      ttl: this.configManager.get("cacheTtlMs"),
    };
  }

  /**
   * Get query manager stats
   */
  getQueryStats() {
    return this.queryManager.getStats();
  }

  /**
   * Get service health
   */
  getHealth() {
    const configValidation = this.configManager.validate();
    return {
      healthy: configValidation.valid && this.activeRequests.size < this.maxConcurrentRequests,
      config: {
        valid: configValidation.valid,
        errors: configValidation.errors,
      },
      requests: {
        active: this.activeRequests.size,
        maxConcurrent: this.maxConcurrentRequests,
      },
      cache: this.getCacheStats(),
      queries: this.getQueryStats(),
    };
  }

  /**
   * Get service summary
   */
  getSummary() {
    return {
      agent: {
        id: this.configManager.get("agentId"),
        version: this.configManager.get("agentVersion"),
      },
      recursiveQueriesEnabled: this.enableRecursiveQueries,
      maxConcurrentRequests: this.maxConcurrentRequests,
      cache: this.getCacheStats(),
      queries: this.getQueryStats(),
    };
  }
}

/**
 * Factory function to create a service instance
 */
export function createAgentCommunicationService(
  configManager: ConfigManager,
  errorHandler: ErrorHandler,
  options?: { enableRecursiveQueries?: boolean; maxConcurrentRequests?: number }
): AgentCommunicationService {
  return new AgentCommunicationService({
    configManager,
    errorHandler,
    enableRecursiveQueries: options?.enableRecursiveQueries,
    maxConcurrentRequests: options?.maxConcurrentRequests,
  });
}
