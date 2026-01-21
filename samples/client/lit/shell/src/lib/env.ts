/**
 * Environment configuration helper for Relevance AI integration
 * Reads and validates environment variables needed for Tool API
 */

export interface RelevanceConfig {
  stackBase: string;
  toolId: string;
  projectId: string;
  apiKey: string;
}

/**
 * Reads environment variables for Relevance AI Tools API
 * @returns RelevanceConfig with all values, or throws error if validation fails
 */
export function getRelevanceConfig(): RelevanceConfig {
  const stackBase = import.meta.env.VITE_RELEVANCE_STACK_BASE || "";
  const toolId = import.meta.env.VITE_RELEVANCE_TOOL_ID || "";
  const projectId = import.meta.env.VITE_RELEVANCE_PROJECT_ID || "";
  const apiKey = import.meta.env.VITE_RELEVANCE_API_KEY || "";

  return { stackBase, toolId, projectId, apiKey };
}

/**
 * Validates that all required environment variables are present
 * @returns Array of missing variable names, empty if all present
 */
export function validateRelevanceConfig(config: RelevanceConfig): string[] {
  const missing: string[] = [];
  if (!config.stackBase) missing.push("VITE_RELEVANCE_STACK_BASE");
  if (!config.toolId) missing.push("VITE_RELEVANCE_TOOL_ID");
  if (!config.projectId) missing.push("VITE_RELEVANCE_PROJECT_ID");
  if (!config.apiKey) missing.push("VITE_RELEVANCE_API_KEY");
  return missing;
}

/**
 * Gets config and validates it
 * @returns RelevanceConfig if valid
 * @throws Error if any required vars are missing
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
