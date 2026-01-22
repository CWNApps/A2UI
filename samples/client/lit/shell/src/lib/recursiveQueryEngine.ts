/**
 * Recursive Query Engine
 * 
 * Handles intelligent recursive querying, follow-up analysis,
 * and query queueing/stacking for GenUI applications.
 */

export interface QueryResult {
  query: string;
  response: any;
  timestamp: number;
  depth: number;
  requestId: string;
}

export interface RecursiveQueryConfig {
  maxDepth: number;
  maxQueueSize: number;
  timeout: number;
  enableAutoFollow: boolean;
  enableCaching: boolean;
}

export interface QueryCache {
  [key: string]: {
    result: QueryResult;
    timestamp: number;
    ttl: number;
  };
}

/**
 * Recursive Query Manager
 */
export class RecursiveQueryManager {
  private queryQueue: string[] = [];
  private queryStack: string[] = [];
  private queryHistory: QueryResult[] = [];
  private queryCache: QueryCache = {};
  private config: RecursiveQueryConfig;

  constructor(config: Partial<RecursiveQueryConfig> = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 5,
      maxQueueSize: config.maxQueueSize ?? 20,
      timeout: config.timeout ?? 30000,
      enableAutoFollow: config.enableAutoFollow ?? true,
      enableCaching: config.enableCaching ?? true,
    };
  }

  /**
   * Add a query to the queue
   */
  enqueueQuery(query: string): boolean {
    if (this.queryQueue.length >= this.config.maxQueueSize) {
      console.warn(`Query queue full (max ${this.config.maxQueueSize})`);
      return false;
    }

    this.queryQueue.push(query);
    return true;
  }

  /**
   * Add a query to the stack (LIFO)
   */
  pushQuery(query: string): boolean {
    if (this.queryStack.length >= this.config.maxQueueSize) {
      console.warn(`Query stack full (max ${this.config.maxQueueSize})`);
      return false;
    }

    this.queryStack.push(query);
    return true;
  }

  /**
   * Dequeue next query (FIFO)
   */
  dequeueQuery(): string | null {
    return this.queryQueue.shift() || null;
  }

  /**
   * Pop next query from stack (LIFO)
   */
  popQuery(): string | null {
    return this.queryStack.pop() || null;
  }

  /**
   * Get next query by priority: stack first (recursive), then queue (batch)
   */
  getNextQuery(): string | null {
    // Recursion takes priority - work through stack first
    const stackQuery = this.popQuery();
    if (stackQuery) {
      console.log("[RecursiveQueryManager] Using stack query (recursive):", stackQuery);
      return stackQuery;
    }

    const queueQuery = this.dequeueQuery();
    if (queueQuery) {
      console.log("[RecursiveQueryManager] Using queue query (batch):", queueQuery);
      return queueQuery;
    }

    return null;
  }

  /**
   * Record a query result
   */
  recordResult(
    query: string,
    response: any,
    depth: number = 0,
    requestId: string = this.generateRequestId()
  ): QueryResult {
    const result: QueryResult = {
      query,
      response,
      timestamp: Date.now(),
      depth,
      requestId,
    };

    this.queryHistory.push(result);

    // Cache the result
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(query);
      this.queryCache[cacheKey] = {
        result,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000, // 5 minutes
      };
    }

    return result;
  }

  /**
   * Get cached result if available and not expired
   */
  getCachedResult(query: string): QueryResult | null {
    if (!this.config.enableCaching) return null;

    const cacheKey = this.getCacheKey(query);
    const cached = this.queryCache[cacheKey];

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      delete this.queryCache[cacheKey];
      return null;
    }

    return cached.result;
  }

  /**
   * Determine if a response warrants follow-up queries
   */
  shouldFollowUp(response: any, currentDepth: number): boolean {
    // Check max depth
    if (currentDepth >= this.config.maxDepth) {
      console.log("[RecursiveQueryManager] Max depth reached");
      return false;
    }

    // Check explicit follow-up flag
    if (response?.requires_follow_up === true) {
      console.log("[RecursiveQueryManager] Response indicates follow-up required");
      return true;
    }

    // Check for incomplete data
    if (response?.data?.incomplete === true) {
      console.log("[RecursiveQueryManager] Response data is incomplete");
      return true;
    }

    // Check for paginated data
    if (response?.data?.has_more === true || response?.has_more_results === true) {
      console.log("[RecursiveQueryManager] More results available");
      return true;
    }

    // Check for error indicating retry
    if (response?.status === "retry" || response?.error?.retryable === true) {
      console.log("[RecursiveQueryManager] Response indicates retryable error");
      return true;
    }

    return false;
  }

  /**
   * Generate follow-up query based on response
   */
  generateFollowUpQuery(
    originalQuery: string,
    response: any,
    depth: number = 0
  ): string | null {
    if (depth >= this.config.maxDepth) {
      return null;
    }

    // If there are more results, ask for next page
    if (response?.data?.has_more || response?.has_more_results) {
      const nextPage = (response?.data?.page || 0) + 1;
      const followUp = `${originalQuery} (page ${nextPage})`;
      console.log("[RecursiveQueryManager] Generated pagination follow-up:", followUp);
      return followUp;
    }

    // If data is incomplete, ask for more details
    if (response?.data?.incomplete === true) {
      const followUp = `${originalQuery} - provide more details`;
      console.log("[RecursiveQueryManager] Generated detail follow-up:", followUp);
      return followUp;
    }

    // If there's a suggestion for next query
    if (response?.next_query_suggestion) {
      console.log("[RecursiveQueryManager] Using suggested query:", response.next_query_suggestion);
      return response.next_query_suggestion;
    }

    // If response contains related topics, ask about them
    if (Array.isArray(response?.related_topics) && response.related_topics.length > 0) {
      const nextTopic = response.related_topics[0];
      const followUp = `Tell me more about ${nextTopic}`;
      console.log("[RecursiveQueryManager] Generated topic follow-up:", followUp);
      return followUp;
    }

    return null;
  }

  /**
   * Execute recursive query chain
   */
  async executeRecursiveQueries(
    initialQuery: string,
    queryExecutor: (query: string, depth: number) => Promise<any>,
    onProgress?: (result: QueryResult) => void
  ): Promise<QueryResult[]> {
    const results: QueryResult[] = [];

    // Start with initial query
    this.enqueueQuery(initialQuery);

    let queryCount = 0;
    const maxQueries = this.config.maxQueueSize * 2; // Prevent infinite loops

    while (this.queryQueue.length > 0 || this.queryStack.length > 0) {
      if (queryCount >= maxQueries) {
        console.warn("[RecursiveQueryManager] Maximum query count reached");
        break;
      }

      const query = this.getNextQuery();
      if (!query) break;

      const depth = this.queryStack.length; // Current recursion depth

      try {
        // Check cache first
        const cached = this.getCachedResult(query);
        if (cached) {
          console.log("[RecursiveQueryManager] Using cached result for:", query);
          results.push(cached);
          if (onProgress) onProgress(cached);
          queryCount++;
          continue;
        }

        // Execute query
        console.log(`[RecursiveQueryManager] Executing query at depth ${depth}:`, query);
        const response = await this.executeWithTimeout(
          queryExecutor(query, depth),
          this.config.timeout
        );

        const result = this.recordResult(query, response, depth);
        results.push(result);

        if (onProgress) onProgress(result);

        // Check if follow-up is needed
        if (this.config.enableAutoFollow && this.shouldFollowUp(response, depth)) {
          const followUp = this.generateFollowUpQuery(query, response, depth);
          if (followUp) {
            if (depth < this.config.maxDepth / 2) {
              this.pushQuery(followUp); // Recursive - use stack
            } else {
              this.enqueueQuery(followUp); // Batch - use queue
            }
          }
        }

        queryCount++;
      } catch (error) {
        console.error(`[RecursiveQueryManager] Error executing query: ${query}`, error);
        // Continue with next query instead of crashing
      }
    }

    console.log(`[RecursiveQueryManager] Completed ${results.length} queries`);
    return results;
  }

  /**
   * Execute query with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get query history
   */
  getHistory(): QueryResult[] {
    return [...this.queryHistory];
  }

  /**
   * Clear history and cache
   */
  clear(): void {
    this.queryQueue = [];
    this.queryStack = [];
    this.queryHistory = [];
    this.queryCache = {};
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      historyCount: this.queryHistory.length,
      queueSize: this.queryQueue.length,
      stackSize: this.queryStack.length,
      cacheSize: Object.keys(this.queryCache).length,
      averageDepth:
        this.queryHistory.length > 0
          ? this.queryHistory.reduce((sum, r) => sum + r.depth, 0) / this.queryHistory.length
          : 0,
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string): string {
    return `query:${query.toLowerCase().trim()}`;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Helper function to determine visualization type from response
 */
export function getVisualizationType(response: any): string {
  if (!response || typeof response !== "object") return "text";

  const component = response.component || response.visualization_type || response.ui_type;

  if (component === "table" || (response.data?.rows && Array.isArray(response.data.rows))) {
    return "table";
  }
  if (component === "chart") {
    return "chart";
  }
  if (component === "metric") {
    return "metric";
  }
  if (component === "list") {
    return "list";
  }
  if (Array.isArray(response.components) || component === "mixed") {
    return "mixed";
  }

  return "text";
}

/**
 * Helper to format query results for display
 */
export function formatQueryResult(result: QueryResult): string {
  return `
[Query] ${result.query}
[Depth] ${result.depth}
[Time] ${new Date(result.timestamp).toISOString()}
[RequestID] ${result.requestId}
[Type] ${getVisualizationType(result.response)}
  `.trim();
}
