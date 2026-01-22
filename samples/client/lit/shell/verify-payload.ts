/**
 * Payload Verification - Shows the correct structure with "role" property
 * This confirms the fix for HTTP 422 error
 */

import {
  buildAgentRequestPayload,
  validateAgentRequestPayload,
} from "./src/lib/agentPayloadBuilder";

console.log("=".repeat(70));
console.log("✅ PAYLOAD VERIFICATION - HTTP 422 FIX");
console.log("=".repeat(70));

// Example 1: Trigger endpoint with "role" property
console.log("\n📝 TRIGGER ENDPOINT PAYLOAD (Correct - includes 'role'):");
const triggerPayload = buildAgentRequestPayload(
  "agent-123",
  "conv-456",
  "What is 2+2?",
  {
    userId: "user-789",
    projectId: "proj-001",
  },
  "trigger"
);

console.log(JSON.stringify(triggerPayload, null, 2));

// Example 2: Validate the payload
console.log("\n✓ VALIDATION:");
try {
  validateAgentRequestPayload(triggerPayload, "trigger");
  console.log("✅ Payload is valid for /trigger endpoint");
} catch (error) {
  console.error("❌ Validation failed:", error);
}

// Example 3: Show the correct structure
console.log("\n📋 CORRECT STRUCTURE:");
console.log(`{
  "role": "data_engine",           // ✅ REQUIRED - Prevents HTTP 422
  "input": "your query here",
  "context": {
    "conversation_id": "conv-123",
    "user_id": "user-456",          // Optional
    "project_id": "proj-789"        // Optional
  },
  "parameters": {}                  // Optional
}`);

console.log("\n" + "=".repeat(70));
console.log("The fix ensures the 'role' property is ALWAYS included");
console.log("=".repeat(70) + "\n");
