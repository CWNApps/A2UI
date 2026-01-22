/**
 * Response Payload Extraction
 * 
 * Handles all the different response shapes from Relevance API:
 *   - Agent responses: { data: { output: { transformed: { payload } } } }
 *   - Tool poll responses: { type, updates: [...], last_message_id }
 *   - Direct payloads: { component, data, ... }
 * 
 * Extracts the deepest UI-renderable payload safely.
 */

export interface ExtractedPayload {
  kind: "success" | "empty" | "error";
  payload: any;
  message?: string;
  traces?: any[];
}

/**
 * Safely extract UI payload from various Relevance response shapes
 * 
 * Priority order:
 *   1. Check transformed.payload (agent output)
 *   2. Check output.payload (agent alternate)
 *   3. Check output.answer (agent alternate)
 *   4. Check updates array (tool poll)
 *   5. Return raw response if it looks like a payload
 * 
 * Always returns a safe object (never null/undefined)
 */
export function extractUiPayload(response: any): ExtractedPayload {
  // Guard: response must be an object
  if (!response || typeof response !== "object") {
    return {
      kind: "error",
      payload: null,
      message: "Response is not an object",
    };
  }

  let payload = null;
  let message = "";

  // === TRY: Agent response with nested transformed.payload
  if (response.data?.output?.transformed?.payload) {
    payload = response.data.output.transformed.payload;
    console.log("[ExtractUiPayload] Found: data.output.transformed.payload");
  }
  // === TRY: Agent response with output.payload
  else if (response.data?.output?.payload) {
    payload = response.data.output.payload;
    console.log("[ExtractUiPayload] Found: data.output.payload");
  }
  // === TRY: Agent response with output.answer
  else if (response.data?.output?.answer) {
    payload = response.data.output.answer;
    console.log("[ExtractUiPayload] Found: data.output.answer");
  }
  // === TRY: Tool poll response with updates array
  else if (response.updates && Array.isArray(response.updates)) {
    // Scan updates in reverse (latest first) for first payload object
    for (let i = response.updates.length - 1; i >= 0; i--) {
      const update = response.updates[i];
      if (update && typeof update === "object") {
        if (update.payload) {
          payload = update.payload;
          console.log("[ExtractUiPayload] Found: updates[i].payload");
          break;
        } else if (update.output) {
          payload = update.output;
          console.log("[ExtractUiPayload] Found: updates[i].output");
          break;
        }
      }
    }
  }
  // === TRY: Direct payload (already looks like UI data)
  else if (
    response.component ||
    response.visualization_type ||
    (response.data?.rows && Array.isArray(response.data.rows))
  ) {
    payload = response;
    console.log("[ExtractUiPayload] Found: Direct payload (component/visualization_type/data.rows)");
  }
  // === TRY: Fallback to the response itself
  else {
    payload = response;
    console.log("[ExtractUiPayload] Fallback: Using entire response as payload");
  }

  // Extract optional message if present
  if (response.message && typeof response.message === "string") {
    message = response.message;
  } else if (response.data?.message && typeof response.data.message === "string") {
    message = response.data.message;
  }

  // Extract optional traces if present
  let traces: any[] = [];
  if (response.traces && Array.isArray(response.traces)) {
    traces = response.traces;
  } else if (response.data?.traces && Array.isArray(response.data.traces)) {
    traces = response.data.traces;
  }

  // Determine kind
  let kind: "success" | "empty" | "error" = "success";
  if (!payload) {
    kind = "empty";
  } else if (payload.error || payload.type === "error") {
    kind = "error";
  }

  return {
    kind,
    payload: payload || {},
    message: message || undefined,
    traces: traces.length > 0 ? traces : undefined,
  };
}

/**
 * Check if a payload has rows (is renderable as table)
 */
export function hasRows(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  const rows = payload.data?.rows || payload.rows;
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Get row count from payload
 */
export function getRowCount(payload: any): number {
  if (!payload || typeof payload !== "object") return 0;
  const rows = payload.data?.rows || payload.rows;
  return Array.isArray(rows) ? rows.length : 0;
}

/**
 * Get component type string for logging
 */
export function getComponentType(payload: any): string {
  if (!payload || typeof payload !== "object") {
    if (typeof payload === "string") return "text";
    return "unknown";
  }

  if (payload.component === "table" || payload.visualization_type === "table" || 
      (payload.data?.rows && Array.isArray(payload.data.rows))) {
    return "table";
  }
  if (payload.component === "metric" || payload.visualization_type === "metric") {
    return "metric";
  }
  if (payload.component === "chart" || payload.visualization_type === "chart") {
    return "chart";
  }
  if (payload.component === "graph" || payload.visualization_type === "graph") {
    return "graph";
  }
  if (typeof payload === "string") {
    return "text";
  }
  if (typeof payload === "object") {
    return "json";
  }
  return "unknown";
}
