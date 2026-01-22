/**
 * Backend Proxy Middleware for Relevance AI Agent Integration
 * 
 * This middleware:
 * 1. Receives requests from frontend
 * 2. Recursively validates and normalizes payloads
 * 3. Adds required fields (especially "role" for /trigger endpoint)
 * 4. Forwards to Relevance AI with proper error handling
 * 5. Returns normalized responses with detailed error feedback
 */

import { recursiveValidatePayload, getTriggerEndpointSchema, TriggerEndpointPayload } from "./agentPayloadBuilder";

export interface ProxyRequest {
  endpoint: "run" | "trigger";
  agentId?: string;
  conversationId: string;
  input: string;
  userId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
  retryCount?: number;
}

export interface ProxyResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code: number;
    details?: any;
    suggestion?: string;
  };
  metadata?: {
    endpoint: string;
    timestamp: number;
    retries: number;
  };
}

/**
 * Validates and normalizes incoming request payload
 * Recursively checks all required fields and auto-fills where possible
 */
export function validateAndNormalizeRequest(req: ProxyRequest): TriggerEndpointPayload {
  if (!req.conversationId) {
    throw new Error("conversationId is required");
  }

  if (!req.input) {
    throw new Error("input is required");
  }

  // Build payload for /trigger endpoint (requires "role")
  const payload: any = {
    role: req.metadata?.role || "data_engine", // ✅ This prevents 422 errors
    input: req.input,
    context: {
      conversation_id: req.conversationId,
      user_id: req.userId || "unknown_user",
      project_id: req.projectId,
    },
    parameters: req.metadata || {},
  };

  // Recursively validate to ensure all required fields are present
  // If any field is missing, this will auto-fill with defaults or throw an error
  const validated = recursiveValidatePayload(payload, getTriggerEndpointSchema());

  return validated as TriggerEndpointPayload;
}

/**
 * Executes agent request with retry logic and exponential backoff
 */
export async function executeAgentRequest(
  apiEndpoint: string,
  apiKey: string,
  payload: TriggerEndpointPayload,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    timeoutMs?: number;
  }
): Promise<any> {
  const maxRetries = options?.maxRetries || 3;
  const initialDelayMs = options?.initialDelayMs || 1000;
  const timeoutMs = options?.timeoutMs || 30000;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Agent Request] Attempt ${attempt}/${maxRetries} to ${apiEndpoint}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 422 specifically - suggests missing fields
      if (response.status === 422) {
        const errorData = await response.json();
        const errorMsg =
          errorData.message || "Body Validation Error - missing required property";

        // Check if it's the "role" property
        if (errorMsg.includes("role")) {
          throw new Error(
            `422 Validation Error: Missing "role" property in payload. ` +
            `This is required for the /trigger endpoint. ` +
            `Ensure buildAgentRequestPayload() is called with endpoint="trigger". ` +
            `Full error: ${errorMsg}`
          );
        }

        throw new Error(`422 Validation Error: ${errorMsg}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `HTTP ${response.status}: ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`[Agent Request] ✅ Success on attempt ${attempt}`);
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Agent Request] ❌ Attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`[Agent Request] Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Unknown error during agent request");
}

/**
 * Main proxy handler - validates, executes, and returns normalized response
 */
export async function handleAgentProxyRequest(
  req: ProxyRequest,
  apiEndpoint: string,
  apiKey: string
): Promise<ProxyResponse> {
  const startTime = Date.now();
  const retryCount = req.retryCount || 0;

  try {
    // Step 1: Validate and normalize request
    console.log("[Proxy] Validating request...");
    const validatedPayload = validateAndNormalizeRequest(req);
    console.log("[Proxy] ✅ Payload validated and normalized");
    console.log(
      "[Proxy] Payload includes:",
      Object.keys(validatedPayload).join(", ")
    );

    // Step 2: Execute request with retries
    console.log(`[Proxy] Sending to ${apiEndpoint}...`);
    const agentResponse = await executeAgentRequest(apiEndpoint, apiKey, validatedPayload, {
      maxRetries: 3,
      initialDelayMs: 1000,
      timeoutMs: 30000,
    });

    // Step 3: Return success response
    return {
      success: true,
      data: agentResponse,
      metadata: {
        endpoint: req.endpoint,
        timestamp: Date.now(),
        retries: retryCount,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Proxy] ❌ Error:", errorMessage);

    // Provide helpful error messages
    let suggestion = "";

    if (errorMessage.includes("role")) {
      suggestion =
        'Ensure the payload includes "role" property. Use buildAgentRequestPayload(..., endpoint="trigger").';
    } else if (errorMessage.includes("422")) {
      suggestion =
        "A required field is missing. Check the payload schema. The error details should indicate which field.";
    } else if (errorMessage.includes("401") || errorMessage.includes("403")) {
      suggestion =
        "Authentication failed. Check API key and ensure it has permissions for this endpoint.";
    } else if (errorMessage.includes("Timeout")) {
      suggestion =
        "Request timed out. The agent might be processing a complex query. Try again or increase timeout.";
    }

    return {
      success: false,
      error: {
        message: errorMessage,
        code: 500,
        details: {
          endpoint: req.endpoint,
          conversationId: req.conversationId,
        },
        suggestion,
      },
      metadata: {
        endpoint: req.endpoint,
        timestamp: Date.now(),
        retries: retryCount,
      },
    };
  }
}

/**
 * Express middleware factory for agent proxy
 * Usage:
 *   app.post('/api/agent', createAgentProxyMiddleware({
 *     apiEndpoint: process.env.AGENT_API_ENDPOINT,
 *     apiKey: process.env.AGENT_API_KEY
 *   }))
 */
export function createAgentProxyMiddleware(config: {
  apiEndpoint: string;
  apiKey: string;
}) {
  return async (req: any, res: any) => {
    try {
      const proxyRequest: ProxyRequest = {
        endpoint: req.body.endpoint || "trigger",
        agentId: req.body.agentId,
        conversationId: req.body.conversationId,
        input: req.body.input || req.body.userInput || req.body.message,
        userId: req.body.userId || req.user?.id,
        projectId: req.body.projectId,
        metadata: req.body.metadata,
        retryCount: req.body.retryCount || 0,
      };

      const proxyResponse = await handleAgentProxyRequest(
        proxyRequest,
        config.apiEndpoint,
        config.apiKey
      );

      res.status(proxyResponse.success ? 200 : 400).json(proxyResponse);
    } catch (error) {
      console.error("[Proxy Middleware] Unexpected error:", error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          code: 500,
        },
      });
    }
  };
}
