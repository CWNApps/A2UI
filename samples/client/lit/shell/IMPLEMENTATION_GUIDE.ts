/**
 * Implementation Guide: Fixing HTTP 422 "role" Property Error
 * 
 * This file shows the recommended changes to make in the GenUI client
 * to fix the HTTP 422 error from the agent trigger endpoint.
 */

// ============================================================================
// FILE 1: Update agentPayloadBuilder.ts
// ============================================================================

// BEFORE (Missing role)
export interface AgentPayload {
  input: string;
  context: {
    conversation_id: string;
    user_id?: string;
    project_id?: string;
  };
  parameters?: Record<string, unknown>;
}

// AFTER (With role and recursive validation)
export interface AgentPayload {
  role: string; // ✅ ADD THIS
  input: string;
  context: {
    conversation_id: string;
    user_id?: string;
    project_id?: string;
  };
  parameters?: Record<string, unknown>;
}

// Add recursive validation function
export function validateAgentPayload(payload: unknown): AgentPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }

  const p = payload as Record<string, unknown>;

  // Check required fields recursively
  if (!p.role || typeof p.role !== "string") {
    p.role = "data_engine"; // Auto-inject default role
  }

  if (!p.input || typeof p.input !== "string") {
    throw new Error('Missing required field: "input" (string)');
  }

  if (!p.context || typeof p.context !== "object") {
    throw new Error('Missing required field: "context" (object)');
  }

  const ctx = p.context as Record<string, unknown>;
  if (!ctx.conversation_id || typeof ctx.conversation_id !== "string") {
    throw new Error('Missing required field: "context.conversation_id" (string)');
  }

  // Build valid payload
  return {
    role: String(p.role),
    input: String(p.input),
    context: {
      conversation_id: String(ctx.conversation_id),
      user_id: ctx.user_id ? String(ctx.user_id) : undefined,
      project_id: ctx.project_id ? String(ctx.project_id) : undefined,
    },
    parameters: p.parameters && typeof p.parameters === "object" ? (p.parameters as Record<string, unknown>) : {},
  };
}

export function buildAgentPayload(
  input: string,
  context: {
    conversationId: string;
    userId?: string;
    projectId?: string;
  }
): AgentPayload {
  // Build with role included
  const payload: AgentPayload = {
    role: "data_engine", // ✅ Required for /trigger endpoint
    input: input.trim(),
    context: {
      conversation_id: context.conversationId,
      user_id: context.userId,
      project_id: context.projectId,
    },
  };

  // Validate recursively
  return validateAgentPayload(payload) as AgentPayload;
}

// ============================================================================
// FILE 2: Update agentCommunicationService.ts
// ============================================================================

export class AgentCommunicationService {
  private apiEndpoint: string;
  private apiKey: string;
  private maxRetries = 3;
  private retryDelayMs = 1000;

  constructor(apiEndpoint: string, apiKey: string) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }

  async executeAgent(
    input: string,
    context: {
      conversationId: string;
      userId?: string;
      projectId?: string;
    }
  ): Promise<AgentResponse> {
    // Build payload with role ✅
    const payload = buildAgentPayload(input, context);

    // Ensure payload is valid recursively
    const validatedPayload = validateAgentPayload(payload);

    console.log("[Agent] Sending request with role:", {
      role: validatedPayload.role,
      endpoint: this.apiEndpoint,
      conversationId: validatedPayload.context.conversation_id,
    });

    // Execute with retry logic
    return this.executeWithRetry(validatedPayload);
  }

  private async executeWithRetry(
    payload: AgentPayload,
    attempt = 1
  ): Promise<AgentResponse> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      // Handle 422 specifically
      if (response.status === 422) {
        const error = await response.json();
        console.error("[Agent] HTTP 422 - Body Validation Error", error);
        throw new AgentError(
          "Body Validation Error - Check that 'role' property is included",
          422,
          {
            expected: { role: "data_engine", input: "...", context: "..." },
            received: payload,
            error,
          }
        );
      }

      if (!response.ok) {
        // Retry on server errors
        if (response.status >= 500 && attempt < this.maxRetries) {
          console.warn(
            `[Agent] Server error (${response.status}), retrying attempt ${attempt}...`
          );
          await this.delay(this.retryDelayMs * attempt);
          return this.executeWithRetry(payload, attempt + 1);
        }

        const error = await response.json();
        throw new AgentError(error.message || response.statusText, response.status, error);
      }

      return response.json();
    } catch (error) {
      if (error instanceof AgentError) throw error;

      // Network error, retry if applicable
      if (attempt < this.maxRetries) {
        console.warn(`[Agent] Network error, retrying attempt ${attempt}...`);
        await this.delay(this.retryDelayMs * attempt);
        return this.executeWithRetry(payload, attempt + 1);
      }

      throw new AgentError(
        error instanceof Error ? error.message : String(error),
        0
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FILE 3: Update configManager.ts
// ============================================================================

export interface AgentConfig {
  endpoint: string; // Change from /run to /trigger
  apiKey: string;
  projectId?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    delayMs: number;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AgentConfig;

  private constructor(config: AgentConfig) {
    this.config = this.normalizeConfig(config);
  }

  private normalizeConfig(config: AgentConfig): AgentConfig {
    return {
      endpoint: config.endpoint || process.env.AGENT_API_ENDPOINT,
      apiKey: config.apiKey || process.env.AGENT_API_KEY,
      projectId: config.projectId || process.env.AGENT_PROJECT_ID,
      timeout: config.timeout || 30000,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries || 3,
        delayMs: config.retryConfig?.delayMs || 1000,
      },
    };
  }

  static initialize(config: AgentConfig): void {
    ConfigManager.instance = new ConfigManager(config);
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      throw new Error("ConfigManager not initialized");
    }
    return ConfigManager.instance;
  }

  static reset(): void {
    ConfigManager.instance = null as any;
  }

  getAgentConfig(): AgentConfig {
    return this.config;
  }

  // Validate that endpoint is /trigger (not /run)
  isValidEndpoint(): boolean {
    return this.config?.endpoint?.includes("/trigger") || false;
  }

  validateConfig(): string[] {
    const errors: string[] = [];

    if (!this.config?.endpoint) {
      errors.push('Missing "endpoint" configuration');
    } else if (!this.isValidEndpoint()) {
      errors.push('Endpoint should use "/trigger" not "/run" for this fix');
    }

    if (!this.config?.apiKey) {
      errors.push('Missing "apiKey" configuration');
    }

    return errors;
  }
}

// ============================================================================
// FILE 4: Error Handling Class
// ============================================================================

export class AgentError extends Error {
  constructor(
    message: string,
    public code: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "AgentError";
  }

  is422(): boolean {
    return this.code === 422;
  }

  isMissingRole(): boolean {
    if (this.is422()) {
      const detailStr = JSON.stringify(this.details);
      return detailStr.includes("role");
    }
    return false;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      type: this.name,
    };
  }
}

// ============================================================================
// FILE 5: Type Definitions
// ============================================================================

export interface AgentContext {
  conversationId: string;
  userId?: string;
  projectId?: string;
}

export interface AgentResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
  error?: string | Record<string, unknown>;
  metadata?: {
    timestamp: string;
    duration?: number;
    endpoint?: string;
  };
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
// 1. Initialize configuration
ConfigManager.initialize({
  endpoint: "https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger",
  apiKey: "your_api_key",
  projectId: "your_project_id",
});

// 2. Validate configuration
const config = ConfigManager.getInstance();
const errors = config.validateConfig();
if (errors.length > 0) {
  console.error("Configuration errors:", errors);
}

// 3. Create service
const service = new AgentCommunicationService(
  config.getAgentConfig().endpoint,
  config.getAgentConfig().apiKey
);

// 4. Execute agent (payload automatically includes role!)
try {
  const response = await service.executeAgent("What is 2+2?", {
    conversationId: "conv-123",
    userId: "user-456",
  });
  console.log("Success:", response);
} catch (error) {
  if (error instanceof AgentError) {
    if (error.is422()) {
      console.error("HTTP 422 - Body Validation Error");
      console.error("Ensure 'role' property is included in payload");
    } else {
      console.error(`Error ${error.code}:`, error.message);
    }
  }
}
*/

// ============================================================================
// TESTING
// ============================================================================

/*
// Test with backend proxy:
const response = await fetch("http://localhost:3000/api/agent/trigger", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: "What is 2+2?",
    context: {
      conversation_id: "test-conv-123",
      user_id: "user-123",
    },
  }),
});

const data = await response.json();
console.log(data);
// Expected: { success: true, data: {...} }
*/
