/**
 * Environment configuration helper for Relevance AI integration
 * Supports backward compatibility with both VITE_AGENT_ID and VITE_RELEVANCE_AGENT_ID naming
 */

export interface RelevanceConfig {
  stackBase: string;
  agentId: string;
  toolId: string;
  projectId: string;
  apiKey: string;
}

/**
 * Normalizes stack base URL to ensure exactly ONE "/latest" suffix
 * - Trims whitespace
 * - Removes trailing slashes
 * - Removes all /latest occurrences (including /latest/latest)
 * - Adds exactly one /latest
 */
export function normalizeStackBase(url: string): string {
  // Trim whitespace
  let normalized = url.trim();
  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, "");
  // Remove all /latest occurrences (including /latest/latest)
  normalized = normalized.replace(/\/latest(\/?latest)*$/, "");
  // Ensure exactly one /latest suffix
  normalized = normalized + "/latest";
  return normalized;
}

/**
 * Reads environment variables for Relevance AI with backward compatibility
 * Supports both naming schemes:
 *   - VITE_RELEVANCE_AGENT_ID (preferred)
 *   - VITE_AGENT_ID (fallback)
 * Similarly for tool ID
 */
export function getRelevanceConfig(): RelevanceConfig {
  const stackBase = import.meta.env.VITE_RELEVANCE_STACK_BASE || "";
  const agentId =
    import.meta.env.VITE_RELEVANCE_AGENT_ID ?? import.meta.env.VITE_AGENT_ID ?? "";
  const toolId =
    import.meta.env.VITE_RELEVANCE_TOOL_ID ?? import.meta.env.VITE_TOOL_ID ?? "";
  const projectId = import.meta.env.VITE_RELEVANCE_PROJECT_ID || "";
  const apiKey = import.meta.env.VITE_RELEVANCE_API_KEY || "";

  return { stackBase, agentId, toolId, projectId, apiKey };
}

/**
 * Validates that required environment variables are present
 * Returns array of missing variable names (empty if valid)
 * Accepts either naming scheme for agent/tool IDs
 */
export function validateRelevanceConfig(config: RelevanceConfig): string[] {
  const missing: string[] = [];
  if (!config.stackBase) missing.push("VITE_RELEVANCE_STACK_BASE");
  // Agent ID: need at least one naming scheme present
  if (!config.agentId) {
    const agentIdEnvName = import.meta.env.VITE_RELEVANCE_AGENT_ID
      ? "VITE_RELEVANCE_AGENT_ID"
      : "VITE_AGENT_ID";
    missing.push(agentIdEnvName);
  }
  // Tool ID: need at least one naming scheme present (optional if agentId present)
  if (!config.toolId && !config.agentId) {
    const toolIdEnvName = import.meta.env.VITE_RELEVANCE_TOOL_ID
      ? "VITE_RELEVANCE_TOOL_ID"
      : "VITE_TOOL_ID";
    missing.push(toolIdEnvName);
  }
  if (!config.projectId) missing.push("VITE_RELEVANCE_PROJECT_ID");
  if (!config.apiKey) missing.push("VITE_RELEVANCE_API_KEY");
  return missing;
}

/**
 * Gets config and validates it
 * Requires: stackBase, projectId, apiKey, and either agentId OR toolId
 */
export function getValidatedRelevanceConfig(): RelevanceConfig {
  const config = getRelevanceConfig();
  const missing = validateRelevanceConfig(config);
  if (missing.length > 0) {
    const missingList = missing.join(", ");
    const message = `Missing env vars: ${missingList}. Set these in your environment and redeploy.`;
    throw new Error(message);
  }
  return config;
}
