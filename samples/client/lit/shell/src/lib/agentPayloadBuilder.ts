/**
 * Relevance AI Agent Request Payload Builder
 * 
 * Supports two endpoint formats:
 * 1. /run endpoint: {agent_id, conversation_id, message: {text}}
 * 2. /trigger endpoint: {agent_id, message: {role, content}} - REQUIRES "message.role" and "message.content"
 * 
 * The framework detects which format is needed and validates accordingly.
 */

// JSON Schema types for recursive validation
export interface JsonSchema {
  type: string;
  required?: string[];
  properties?: Record<string, any>;
  default?: any;
  items?: JsonSchema;
}

export interface AgentRequestContext {
  userId?: string;
  projectId?: string;
  conversationId?: string;
  sessionId?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

// Trigger endpoint payload format (Relevance /latest/agents/trigger)
export interface TriggerEndpointPayload {
  agent_id: string;
  message: {
    role: string;
    content: string;
  };
}

// Run endpoint payload format (without role)
export interface RunEndpointPayload {
  agent_id: string;
  conversation_id: string;
  message: {
    text: string;
  };
}

export type AgentRequestPayload = TriggerEndpointPayload | RunEndpointPayload;

export interface AgentResponsePayload {
  data: {
    output?: {
      transformed?: {
        payload?: any;
      };
      payload?: any;
      answer?: any;
    };
    message?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * RECURSIVE VALIDATION LAYER - Recursively validates and fills missing fields
 * This prevents HTTP 422 errors by ensuring all required properties exist
 * 
 * @param payload - Object to validate
 * @param schema - JSON Schema defining required fields and structure
 * @returns Validated payload with auto-filled defaults
 */
export function recursiveValidatePayload(payload: any, schema: JsonSchema): any {
  if (!schema || !schema.required) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }

  // Validate all required fields at current level
  for (const key of schema.required || []) {
    if (!(key in payload)) {
      // Try to use default from schema
      if (
        schema.properties &&
        schema.properties[key] &&
        schema.properties[key].default !== undefined
      ) {
        payload[key] = schema.properties[key].default;
        console.warn(
          `⚠️ Auto-filled missing required field "${key}" with default: ${schema.properties[key].default}`
        );
      } else {
        throw new Error(
          `Missing required property: "${key}" {missingProperty:"${key}"} /error`
        );
      }
    }

    // Recursively validate nested objects
    if (
      schema.properties &&
      schema.properties[key] &&
      schema.properties[key].type === "object" &&
      typeof payload[key] === "object" &&
      payload[key] !== null
    ) {
      payload[key] = recursiveValidatePayload(payload[key], schema.properties[key]);
    }
  }

  return payload;
}

/**
 * Get JSON Schema for /trigger endpoint (requires message.role + message.content)
 */
export function getTriggerEndpointSchema(): JsonSchema {
  return {
    type: "object",
    required: ["agent_id", "message"],
    properties: {
      agent_id: { type: "string" },
      message: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", default: "user" },
          content: { type: "string" },
        },
      },
    },
  };
}

/**
 * Get JSON Schema for /run endpoint (no "role" property)
 */
export function getRunEndpointSchema(): JsonSchema {
  return {
    type: "object",
    required: ["agent_id", "conversation_id", "message"],
    properties: {
      agent_id: { type: "string" },
      conversation_id: { type: "string" },
      message: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string" },
        },
      },
    },
  };
}

/**
 * Builds a valid agent request payload
 * Automatically detects which format to use and validates recursively
 * 
 * @param agentId - Agent ID (for /run endpoint)
 * @param conversationId - Conversation ID
 * @param input - User input/query
 * @param context - Additional context
 * @param endpoint - Which endpoint to target ('run' or 'trigger')
 * @returns Validated payload
 */
export function buildAgentRequestPayload(
  agentId: string,
  conversationId: string,
  input: string,
  context?: Partial<AgentRequestContext>,
  endpoint: "run" | "trigger" = "run"
): AgentRequestPayload {
  if (!agentId || typeof agentId !== "string") {
    throw new Error("agentId is required and must be a string");
  }

  if (!conversationId || typeof conversationId !== "string") {
    throw new Error("conversationId is required and must be a string");
  }

  if (!input || typeof input !== "string") {
    throw new Error("input must be a non-empty string");
  }

  // Build payload for /trigger endpoint (requires message.role + message.content)
  if (endpoint === "trigger") {
    const payload: TriggerEndpointPayload = {
      agent_id: agentId,
      message: {
        role: (context?.metadata?.role as string) || "user",
        content: input,
      },
    };

    // Recursively validate to ensure required fields are present
    return recursiveValidatePayload(payload, getTriggerEndpointSchema());
  }

  // Build payload for /run endpoint (no "role" property)
  const payload: RunEndpointPayload = {
    agent_id: agentId,
    conversation_id: conversationId,
    message: {
      text: input,
    },
  };

  return payload;
}

/**
 * Validates an agent request payload
 * For /trigger endpoint: ensures agent_id and message.{role,content} are present (prevents 422)
 * For /run endpoint: ensures agent_id, conversation_id, message are present
 */
export function validateAgentRequestPayload(
  payload: any,
  endpoint: "run" | "trigger" = "run"
): payload is AgentRequestPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }

  if (endpoint === "trigger") {
    // Trigger endpoint validation - MUST have agent_id and message.role/content
    if (!payload.agent_id || typeof payload.agent_id !== "string") {
      throw new Error(
        'Missing required property "agent_id": {missingProperty:"agent_id"} - This is required for /trigger endpoint'
      );
    }

    if (!payload.message || typeof payload.message !== "object") {
      throw new Error(
        'Missing required property "message": {missingProperty:"message"}'
      );
    }

    if (!payload.message.role || typeof payload.message.role !== "string") {
      throw new Error(
        'Missing required property "message.role": {missingProperty:"message.role"}'
      );
    }

    if (!payload.message.content || typeof payload.message.content !== "string") {
      throw new Error(
        'Missing required property "message.content": {missingProperty:"message.content"}'
      );
    }

    return true;
  }

  // Run endpoint validation
  if (!payload.agent_id || typeof payload.agent_id !== "string") {
    throw new Error("agent_id is required and must be a string");
  }

  if (!payload.conversation_id || typeof payload.conversation_id !== "string") {
    throw new Error("conversation_id is required and must be a string");
  }

  if (!payload.message || typeof payload.message !== "object") {
    throw new Error("message is required and must be an object");
  }

  if (!payload.message.text || typeof payload.message.text !== "string") {
    throw new Error("message.text is required and must be a string");
  }

  return true;
}

/**
 * Extracts UI payload from an agent response
 * Handles multiple response shapes
 */
export function extractPayloadFromResponse(response: any): any {
  if (!response || typeof response !== "object") {
    return null;
  }

  // Try multiple extraction paths
  if (response.data?.output?.transformed?.payload) {
    return response.data.output.transformed.payload;
  }
  if (response.data?.output?.payload) {
    return response.data.output.payload;
  }
  if (response.data?.output?.answer) {
    return response.data.output.answer;
  }
  if (response.payload) {
    return response.payload;
  }

  return response;
}

/**
 * Determines if the response is a table visualization
 */
export function isTableResponse(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;

  return (
    payload.component === "table" ||
    payload.visualization_type === "table" ||
    (payload.ui_type === "table" && payload.data?.rows)
  );
}

/**
 * Determines if the response is a chart visualization
 */
export function isChartResponse(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;

  return (
    payload.component === "chart" ||
    payload.visualization_type === "chart" ||
    payload.ui_type === "chart"
  );
}

/**
 * Determines if the response is a metric visualization
 */
export function isMetricResponse(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;

  return (
    payload.component === "metric" ||
    payload.visualization_type === "metric" ||
    payload.ui_type === "metric"
  );
}

/**
 * Determines if the response requires follow-up queries
 */
export function shouldFollowUp(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;

  // Check for explicit follow-up flag
  if (payload.requires_follow_up === true) {
    return true;
  }

  // Check for incomplete data indicators
  if (payload.data?.incomplete === true) {
    return true;
  }

  // Check for "more results available" indicators
  if (payload.has_more_results === true || payload.data?.has_more === true) {
    return true;
  }

  return false;
}

/**
 * Generates a follow-up query based on response
 */
export function generateFollowUpQuery(
  originalQuery: string,
  payload: any,
  depth: number = 0
): string | null {
  if (depth > 3) return null; // Prevent infinite recursion

  if (!payload || typeof payload !== "object") return null;

  // If response suggests more results, ask for them
  if (payload.has_more_results === true || payload.data?.has_more === true) {
    const nextPage = (payload.data?.page || 0) + 1;
    return `${originalQuery} (page ${nextPage})`;
  }

  // If response is incomplete, ask for more details
  if (payload.data?.incomplete === true) {
    return `${originalQuery} (continue with more details)`;
  }

  return null;
}
