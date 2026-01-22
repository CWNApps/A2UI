# Exact Code Changes for HTTP 422 Fix

This file shows the EXACT changes needed in your existing files.

---

## File 1: agentPayloadBuilder.ts

### Change 1: Add Role Property
**Location:** Add to payload interface

```typescript
// BEFORE
export interface AgentPayload {
  input: string;
  context: {
    conversation_id: string;
    user_id?: string;
    project_id?: string;
  };
  parameters?: Record<string, unknown>;
}

// AFTER
export interface AgentPayload {
  role: string;  // ← ADD THIS LINE
  input: string;
  context: {
    conversation_id: string;
    user_id?: string;
    project_id?: string;
  };
  parameters?: Record<string, unknown>;
}
```

### Change 2: Update buildAgentPayload Function
**Location:** buildAgentPayload function

```typescript
// BEFORE
export function buildAgentPayload(
  input: string,
  context: AgentContext
): AgentPayload {
  return {
    input: input.trim(),
    context: {
      conversation_id: context.conversationId,
      user_id: context.userId,
      project_id: context.projectId,
    },
  };
}

// AFTER
export function buildAgentPayload(
  input: string,
  context: AgentContext
): AgentPayload {
  return {
    role: "data_engine",  // ← ADD THIS LINE
    input: input.trim(),
    context: {
      conversation_id: context.conversationId,
      user_id: context.userId,
      project_id: context.projectId,
    },
  };
}
```

### Change 3: Add Validation Function (New Function)
**Location:** After buildAgentPayload, add new function

```typescript
// ADD THIS NEW FUNCTION
export function validateAgentPayload(payload: unknown): AgentPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }

  const p = payload as Record<string, unknown>;

  // Ensure role exists
  if (!p.role || typeof p.role !== "string") {
    p.role = "data_engine";
  }

  // Check required fields
  if (!p.input || typeof p.input !== "string") {
    throw new Error('Missing required field: "input" (must be string)');
  }

  if (!p.context || typeof p.context !== "object") {
    throw new Error('Missing required field: "context" (must be object)');
  }

  const ctx = p.context as Record<string, unknown>;
  if (!ctx.conversation_id || typeof ctx.conversation_id !== "string") {
    throw new Error(
      'Missing required field: "context.conversation_id" (must be string)'
    );
  }

  // Return validated payload
  return {
    role: String(p.role),
    input: String(p.input),
    context: {
      conversation_id: String(ctx.conversation_id),
      user_id: ctx.user_id ? String(ctx.user_id) : undefined,
      project_id: ctx.project_id ? String(ctx.project_id) : undefined,
    },
    parameters: p.parameters && typeof p.parameters === "object" ? p.parameters : {},
  };
}
```

---

## File 2: agentCommunicationService.ts

### Change 1: Use Trigger Endpoint
**Location:** Endpoint configuration

```typescript
// BEFORE
private apiEndpoint = "https://api-bcbe5a.stack.tryrelevance.com/latest/agents/{id}/run";

// AFTER (use trigger endpoint)
private apiEndpoint = "https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger";
```

### Change 2: Update executeAgent Method
**Location:** executeAgent method

```typescript
// BEFORE
async executeAgent(
  input: string,
  context: AgentContext
): Promise<AgentResponse> {
  const payload = buildAgentPayload(input, context);

  const response = await fetch(this.apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// AFTER
async executeAgent(
  input: string,
  context: AgentContext
): Promise<AgentResponse> {
  const payload = buildAgentPayload(input, context);
  
  // ← ADD THIS: Validate payload has role
  const validatedPayload = validateAgentPayload(payload);

  // ← ADD THIS: Retry logic
  return this.executeWithRetry(validatedPayload);
}

// ← ADD THIS NEW METHOD
private async executeWithRetry(
  payload: AgentPayload,
  attempt = 1
): Promise<AgentResponse> {
  try {
    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "X-API-Key": this.apiKey,  // ← ADD THIS
      },
      body: JSON.stringify(payload),
    });

    // Handle 422 error specifically
    if (response.status === 422) {
      const error = await response.json();
      throw new Error(
        `HTTP 422: Body Validation Error - ${JSON.stringify(error)}`
      );
    }

    // Retry on server errors
    if (!response.ok && response.status >= 500 && attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      return this.executeWithRetry(payload, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // Retry on network errors
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      return this.executeWithRetry(payload, attempt + 1);
    }
    throw error;
  }
}
```

### Change 3: Add Error Handling
**Location:** After executeAgent method

```typescript
// ADD THIS ERROR CLASS
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
}
```

---

## File 3: configManager.ts

### Change 1: Update Interface
**Location:** AgentConfig interface

```typescript
// BEFORE
export interface AgentConfig {
  endpoint: string;
  apiKey: string;
}

// AFTER
export interface AgentConfig {
  endpoint: string;  // Should be /trigger endpoint
  apiKey: string;
  projectId?: string;  // ← ADD THIS
  timeout?: number;    // ← ADD THIS
  retryConfig?: {      // ← ADD THIS
    maxRetries: number;
    delayMs: number;
  };
}
```

### Change 2: Add Validation Method
**Location:** ConfigManager class

```typescript
// ADD THIS NEW METHOD in ConfigManager class
isValidEndpoint(): boolean {
  // Ensure endpoint uses /trigger (not /run)
  return this.endpoint.includes("/trigger");
}

validateConfig(): string[] {
  const errors: string[] = [];

  if (!this.endpoint) {
    errors.push('Missing "endpoint" configuration');
  }

  if (!this.isValidEndpoint()) {
    errors.push('Endpoint should use "/trigger" not "/run"');
  }

  if (!this.apiKey) {
    errors.push('Missing "apiKey" configuration');
  }

  return errors;
}
```

---

## File 4: Environment Setup

### Create/Update .env

```bash
# Trigger endpoint (NOT /run)
AGENT_API_ENDPOINT=https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger

# Your API key
AGENT_API_KEY=your_actual_api_key_here

# Server port
SERVER_PORT=3000

# Retry configuration
MAX_RETRIES=3
RETRY_DELAY_MS=1000
```

---

## Summary of Changes

| File | Change | Lines | Purpose |
|------|--------|-------|---------|
| `agentPayloadBuilder.ts` | Add `role` to interface | +1 | Include required property |
| `agentPayloadBuilder.ts` | Add `role: "data_engine"` to return | +1 | Inject role into payload |
| `agentPayloadBuilder.ts` | Add `validateAgentPayload()` function | +25 | Recursive validation |
| `agentCommunicationService.ts` | Change endpoint to `/trigger` | +1 | Use correct endpoint |
| `agentCommunicationService.ts` | Add validation call | +1 | Validate payload |
| `agentCommunicationService.ts` | Add `executeWithRetry()` method | +30 | Implement retry logic |
| `agentCommunicationService.ts` | Add 422 error handling | +5 | Handle validation errors |
| `configManager.ts` | Update `AgentConfig` interface | +4 | Support new config |
| `configManager.ts` | Add validation methods | +20 | Validate endpoint |
| `.env` | Add trigger endpoint | +1 | Configure API |
| `.env` | Add API key | +1 | Set credentials |
| **Total** | **New code added** | **~90 lines** | **Fix 422 error** |

---

## Minimal Implementation (Quickest Fix)

If you want the QUICKEST fix, just do these 4 changes:

**Change 1: Add role to payload**
```typescript
// In buildAgentPayload()
return {
  role: "data_engine",  // ← ADD THIS ONE LINE
  input: input.trim(),
  context: { ... }
};
```

**Change 2: Import and call validation**
```typescript
// In executeAgent()
const validatedPayload = validateAgentPayload(payload);
```

**Change 3: Use trigger endpoint**
```typescript
// In configuration
endpoint: "https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger"
```

**Change 4: Use backend proxy**
```typescript
// In fetch call
const response = await fetch("http://localhost:3000/api/agent/trigger", {
  // This proxy now handles everything else
});
```

**That's it!** 🎯

---

## Testing Your Changes

### Quick Test
```bash
curl -X POST http://localhost:3000/api/agent/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Test",
    "context": { "conversation_id": "test-123" }
  }'
```

### Expected Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Before (Without Changes)
```json
{
  "success": false,
  "error": "Body Validation Error - Missing required property: 'role'"
}
```

---

## Deployment Checklist

- [ ] All 4 code changes made
- [ ] Tests pass: `npm test`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Server starts: `node server.js`
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] Sample request works: `curl http://localhost:3000/api/agent/trigger ...`
- [ ] Client updated to use proxy URL
- [ ] Deployed to production
- [ ] Monitoring set up for errors

---

## If You Get Stuck

1. **Check role is included:**
   ```bash
   curl -s http://localhost:3000/api/agent/trigger ... | jq '.data.request_payload.role'
   ```

2. **Check endpoint is correct:**
   ```bash
   echo $AGENT_API_ENDPOINT  # Should have /trigger
   ```

3. **Check validation works:**
   ```bash
   npm test TESTS.spec.ts -- --reporter=verbose
   ```

4. **Check server is running:**
   ```bash
   curl http://localhost:3000/health
   ```

5. **Enable debug logging:**
   ```bash
   DEBUG=* node server.js
   ```

---

That's everything! Make these changes and you'll eliminate the HTTP 422 error. ✅
