/**
 * Relevance AI Configuration Module
 * 
 * Handles environment variable loading, validation, and URL normalization
 * for Relevance Stack integration in Vite + Vercel environment.
 * 
 * Supports backward compatibility with both naming schemes:
 *   - New: VITE_RELEVANCE_AGENT_ID, VITE_RELEVANCE_TOOL_ID
 *   - Legacy: VITE_AGENT_ID, VITE_TOOL_ID
 */

export interface RelevanceConfig {
  stackBase: string;
  agentId: string;
  toolId: string;
  projectId: string;
  apiKey: string;
  conversationId: string;
}

/**
 * Normalizes stack base URL to prevent /latest/latest and ensure exactly one /latest
 * 
 * Input variations:
 *   - https://api-xxxx.stack.tryrelevance.com
 *   - https://api-xxxx.stack.tryrelevance.com/
 *   - https://api-xxxx.stack.tryrelevance.com/latest
 *   - https://api-xxxx.stack.tryrelevance.com/latest/
 *   - https://api-xxxx.stack.tryrelevance.com/latest/latest (BROKEN)
 * 
 * Output: https://api-xxxx.stack.tryrelevance.com (WITHOUT /latest - caller will add it)
 */
export function normalizeStackBase(url: string): string {
  let normalized = url.trim();
  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, "");
  // Remove all /latest occurrences (strip it all)
  normalized = normalized.replace(/\/latest(\/?latest)*$/, "");
  return normalized;
}

/**
 * Builds API base URL with exactly one /latest suffix
 * Returns: {stackBase}/latest
 */
export function buildApiBase(stackBase: string): string {
  const normalized = normalizeStackBase(stackBase);
  return `${normalized}/latest`;
}

/**
 * Reads all environment variables for Relevance integration
 * Supports both old and new naming conventions
 * 
 * Returns config object with defaults (empty strings for missing vars)
 */
export function getRelevanceConfig(): RelevanceConfig {
  // Stack base (required)
  const stackBase = import.meta.env.VITE_RELEVANCE_STACK_BASE || "";

  // Agent ID (backward compatible: VITE_RELEVANCE_AGENT_ID -> VITE_AGENT_ID)
  const agentId =
    import.meta.env.VITE_RELEVANCE_AGENT_ID ?? 
    import.meta.env.VITE_AGENT_ID ?? 
    "";

  // Tool ID (backward compatible: VITE_RELEVANCE_TOOL_ID -> VITE_TOOL_ID)
  const toolId =
    import.meta.env.VITE_RELEVANCE_TOOL_ID ?? 
    import.meta.env.VITE_TOOL_ID ?? 
    "";

  // Auth (required)
  const projectId = import.meta.env.VITE_RELEVANCE_PROJECT_ID || "";
  const apiKey = import.meta.env.VITE_RELEVANCE_API_KEY || "";

  // Conversation tracking (optional)
  const conversationId = 
    import.meta.env.VITE_RELEVANCE_CONVERSATION_ID ?? 
    import.meta.env.VITE_CONVERSATION_ID ?? 
    "";

  return {
    stackBase,
    agentId,
    toolId,
    projectId,
    apiKey,
    conversationId,
  };
}

/**
 * Validates required environment variables
 * 
 * Requirements:
 *   - stackBase: REQUIRED
 *   - projectId: REQUIRED
 *   - apiKey: REQUIRED
 *   - agentId OR toolId: AT LEAST ONE REQUIRED
 * 
 * Returns array of missing variable names (empty if all required vars present)
 */
export function validateRelevanceConfig(config: RelevanceConfig): string[] {
  const missing: string[] = [];

  if (!config.stackBase) {
    missing.push("VITE_RELEVANCE_STACK_BASE");
  }
  if (!config.projectId) {
    missing.push("VITE_RELEVANCE_PROJECT_ID");
  }
  if (!config.apiKey) {
    missing.push("VITE_RELEVANCE_API_KEY");
  }
  if (!config.agentId && !config.toolId) {
    missing.push("VITE_RELEVANCE_AGENT_ID/VITE_AGENT_ID OR VITE_RELEVANCE_TOOL_ID/VITE_TOOL_ID");
  }

  return missing;
}

/**
 * Gets and validates config in one call
 * Throws if any required variables are missing
 */
export function getValidatedRelevanceConfig(): RelevanceConfig {
  const config = getRelevanceConfig();
  const missing = validateRelevanceConfig(config);
  
  if (missing.length > 0) {
    const missingList = missing.join(", ");
    throw new Error(
      `Missing required environment variables: ${missingList}. ` +
      `Please ensure all variables are set in your .env file and redeploy.`
    );
  }

  return config;
}

/**
 * Logs config status for debugging (REDACTED to not leak secrets)
 * Shows which variables are present, but not their values
 */
export function logConfigStatus(config: RelevanceConfig): void {
  const checks = [
    ["stackBase", !!config.stackBase],
    ["projectId", !!config.projectId],
    ["apiKey", !!config.apiKey],
    ["agentId", !!config.agentId],
    ["toolId", !!config.toolId],
  ];

  const status = checks
    .map(([name, present]) => `${name}${present ? "✅" : "❌"}`)
    .join(" ");

  console.log(`[RelevanceConfig] Status: ${status}`);
}

/**
 * Create an Authorization header for Relevance API
 * Uses HTTP Basic authentication with base64 encoding
 */
export function createAuthHeader(projectId: string, apiKey: string): string {
  const credentials = `${projectId}:${apiKey}`;
  return `Basic ${btoa(credentials)}`;
}

/**
 * Builds endpoint URLs (with properly normalized base)
 */
export function buildEndpointUrls(config: RelevanceConfig) {
  const apiBase = buildApiBase(config.stackBase);

  return {
    apiBase,
    agentTrigger: `${apiBase}/agents/trigger`,
    toolTrigger: `${apiBase}/studios/${config.toolId}/trigger_async`,
    toolPoll: (jobId: string) => 
      `${apiBase}/studios/${config.toolId}/async_poll/${jobId}?ending_update_only=true`,
  };
}
