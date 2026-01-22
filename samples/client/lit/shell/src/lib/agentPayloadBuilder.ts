/**
 * Relevance AI Agent Request Payload Builder
 * 
 * NOTE: The "role" property mentioned in some documentation is NOT part of the
 * Relevance AI agent request body. The actual required format is:
 * 
 * {
 *   agent_id: string,
 *   conversation_id: string,
 *   message: { text: string }
 * }
 * 
 * Any additional context should be passed through the message or as separate metadata.
 */

export interface AgentRequestContext {
  userId: string;
  conversationId: string;
  sessionId?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface AgentRequestPayload {
  agent_id: string;
  conversation_id: string;
  message: {
    text: string;
  };
}

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
 * Builds a valid Relevance AI agent request payload
 * 
 * IMPORTANT: Do NOT include "role" in the request body - it will cause 422 errors.
 * The agent's behavior is determined by its ID and the message content.
 */
export function buildAgentRequestPayload(
  agentId: string,
  conversationId: string,
  userInput: string,
  context?: Partial<AgentRequestContext>
): AgentRequestPayload {
  if (!agentId) {
    throw new Error("agentId is required");
  }
  if (!conversationId) {
    throw new Error("conversationId is required");
  }
  if (!userInput || typeof userInput !== "string") {
    throw new Error("userInput must be a non-empty string");
  }

  // Build the message - keep it clean and simple
  let messageText = userInput;

  // Optionally append context metadata to the message if needed
  if (context?.metadata && Object.keys(context.metadata).length > 0) {
    const metadataStr = JSON.stringify(context.metadata);
    messageText = `${userInput}\n\n[Context: ${metadataStr}]`;
  }

  const payload: AgentRequestPayload = {
    agent_id: agentId,
    conversation_id: conversationId,
    message: {
      text: messageText,
    },
  };

  return payload;
}

/**
 * Validates an agent request payload
 * Throws if validation fails
 */
export function validateAgentRequestPayload(payload: any): payload is AgentRequestPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }

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

  // IMPORTANT: Reject payloads with "role" property - this causes 422 errors
  if ("role" in payload) {
    throw new Error(
      'Invalid payload: "role" property should NOT be included in agent requests. ' +
      "This causes HTTP 422 errors. Remove it and try again."
    );
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
