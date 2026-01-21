/**
 * Relevance AI Tools API client
 * Handles trigger (POST /trigger_async) and polling (GET /async_poll)
 */

import { RelevanceConfig } from "./env";

export interface ToolResponse {
  status: "pending" | "completed" | "done" | "error";
  output?: string;
  error?: string;
  payload?: any;
}

/**
 * Extracts the final tool output from poll response updates
 * Prefers: endRendering, output, result, payload, message
 */
function extractToolOutput(pollResponse: any): any {
  if (!pollResponse.updates || !Array.isArray(pollResponse.updates)) {
    return null;
  }

  // Iterate through updates in reverse to find the last one with relevant data
  for (let i = pollResponse.updates.length - 1; i >= 0; i--) {
    const update = pollResponse.updates[i];
    if (!update || typeof update !== "object") continue;

    // Check for structured outputs
    if (update.endRendering) return update.endRendering;
    if (update.output) return update.output;
    if (update.result) return update.result;
    if (update.payload) return update.payload;
    if (update.message && typeof update.message === "object") return update.message;
  }

  // Fallback: return raw updates as JSON
  return pollResponse.updates;
}

/**
 * Triggers an async tool and polls for completion
 * @param config - Relevance config with stack base, tool ID, project ID, and API key
 * @param params - Parameters to send to the tool (e.g., { message: "hello" } or parsed JSON object)
 * @returns The tool output as a string
 * @throws Error if trigger fails, polling times out, or tool returns error
 */
export async function triggerAndPollTool(
  config: RelevanceConfig,
  params: Record<string, any>
): Promise<string> {
  const { stackBase, toolId, projectId, apiKey } = config;

  try {
    // Step 1: Trigger async tool
    console.log("[Relevance Tool] Triggering async tool...", params);
    const triggerUrl = `${stackBase}/studios/${toolId}/trigger_async`;
    const authHeader = `${projectId}:${apiKey}`;

    const triggerResponse = await fetch(triggerUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ params, project: projectId }),
    });

    const triggerText = await triggerResponse.text();
    if (!triggerResponse.ok) {
      console.error(
        `[Relevance Tool] Trigger failed: ${triggerResponse.status}`,
        triggerText
      );
      throw new Error(
        `Tool trigger failed: ${triggerResponse.status} ${triggerText || triggerResponse.statusText}`
      );
    }

    let triggerData: any;
    try {
      triggerData = triggerText ? JSON.parse(triggerText) : {};
    } catch (e) {
      console.error("[Relevance Tool] Failed to parse trigger response:", triggerText);
      throw new Error(`Invalid trigger response format: ${triggerText}`);
    }

    const jobId = triggerData.job_id;
    if (!jobId) {
      console.error("[Relevance Tool] No job_id in response:", triggerData);
      throw new Error("No job_id returned from tool trigger");
    }

    console.log(`[Relevance Tool] Job started: ${jobId}`);

    // Step 2: Poll for completion with proper stopping logic
    const pollUrl = `${stackBase}/studios/${toolId}/async_poll/${jobId}?ending_update_only=true`;
    const maxWaitMs = 60000; // 60 seconds
    const minPollMs = 1000; // Min 1s between polls
    const maxPollMs = 3000; // Max 3s between polls
    const startTime = Date.now();
    let pollCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      const elapsedSecs = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `[Relevance Tool] Polling... (${elapsedSecs}s, attempt #${pollCount + 1})`
      );

      const pollResponse = await fetch(pollUrl, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
        },
      });

      const pollText = await pollResponse.text();
      if (!pollResponse.ok) {
        console.error(
          `[Relevance Tool] Poll failed: ${pollResponse.status}`,
          pollText
        );
        throw new Error(
          `Poll failed: ${pollResponse.status} ${pollText || pollResponse.statusText}`
        );
      }

      let pollData: any;
      try {
        pollData = pollText ? JSON.parse(pollText) : {};
      } catch (e) {
        console.error("[Relevance Tool] Failed to parse poll response:", pollText);
        throw new Error(`Invalid poll response format: ${pollText}`);
      }

      console.log("[Relevance Tool] Poll response:", pollData);

      // CRITICAL FIX: Check for type === "complete" or "failed" (not status)
      if (pollData.type === "complete") {
        const extracted = extractToolOutput(pollData);
        const output = extracted
          ? typeof extracted === "string"
            ? extracted
            : JSON.stringify(extracted)
          : "Tool completed with no output";
        console.log("[Relevance Tool] ✓ Complete. Extracted output:", output);
        return output;
      }

      if (pollData.type === "failed") {
        const errorMsg = pollData.error || "Tool execution failed";
        console.error("[Relevance Tool] ✗ Failed:", errorMsg);
        throw new Error(errorMsg);
      }

      if (pollData.error) {
        throw new Error(`Tool execution failed: ${pollData.error}`);
      }

      // Wait before next poll
      const randomDelay = Math.random() * (maxPollMs - minPollMs) + minPollMs;
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
      pollCount++;
    }

    throw new Error(`Tool execution timed out after ${maxWaitMs / 1000} seconds`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Relevance Tool] Error:", msg);
    throw new Error(msg);
  }
}

/**
 * Parses user input as either simple message or JSON object
 * If input starts with "{", treats as JSON; otherwise wraps as { message: input }
 */
export function parseToolParams(userInput: string): Record<string, any> {
  const trimmed = userInput.trim();
  if (trimmed.startsWith("{")) {
    // Advanced mode: parse as JSON
    try {
      const parsed = JSON.parse(trimmed);
      console.log("[Tool Params] Advanced mode (JSON):", parsed);
      return parsed;
    } catch (e) {
      console.warn("[Tool Params] Failed to parse JSON, treating as message:", e);
      return { message: userInput };
    }
  } else {
    // Simple mode: wrap as message
    console.log("[Tool Params] Simple mode (message)");
    return { message: userInput };
  }
}
