# HTTP 422 "role" Property Error - Fix Guide

## Problem Summary
The GenUI client receives an HTTP 422 error from the Relevance AI agent trigger endpoint because the `role` property is missing from the request body.

**Error Response:**
```json
{
  "success": false,
  "error": "Body Validation Error - Missing required property: 'role'"
}
```

**Endpoint:** `https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger`

## Root Cause
The current `agentPayloadBuilder.ts` builds payloads for the `/agents/{id}/run` endpoint, which doesn't require a `role` property. However, the `/agents/trigger` endpoint requires it.

```typescript
// ❌ Current (Missing role)
{
  "input": "What is 2+2?",
  "context": { "conversation_id": "..." }
}

// ✅ Required (With role)
{
  "role": "data_engine",  // ← This is required!
  "input": "What is 2+2?",
  "context": { "conversation_id": "..." }
}
```

---

## Solution Layers

### Layer 1: Backend Proxy (Recommended)
Use an Express server as a middle layer to:
- ✅ Validate payloads recursively
- ✅ Auto-inject `role` property if missing
- ✅ Retry with exponential backoff
- ✅ Prevent 422 errors at source

**Setup:**

1. **Create `.env` file:**
```bash
cp samples/client/lit/shell/.env.example samples/client/lit/shell/.env
```

2. **Edit the .env file:**
```env
AGENT_API_ENDPOINT=https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger
AGENT_API_KEY=your_api_key_here
PORT=3000
```

3. **Install dependencies:**
```bash
cd samples/client/lit/shell
npm install dotenv cors
```

4. **Start the server:**
```bash
node server.js
```

5. **Update client to use proxy:**
```typescript
// In agentCommunicationService.ts
const response = await fetch("http://localhost:3000/api/agent/trigger", {
  // Now the server handles role injection!
});
```

---

### Layer 2: Frontend Fix (Direct)
Update `agentPayloadBuilder.ts` to include `role`:

```typescript
export function buildAgentPayload(input: string, context: AgentContext) {
  return {
    role: "data_engine",  // ✅ Add this
    input,
    context: {
      conversation_id: context.conversationId,
      user_id: context.userId,
      project_id: context.projectId,
    },
  };
}
```

---

### Layer 3: Communication Service Update
Update `agentCommunicationService.ts`:

```typescript
async executeAgent(
  input: string,
  context: AgentContext
): Promise<AgentResponse> {
  const payload = buildAgentPayload(input, context);
  
  // Ensure role is present
  if (!payload.role) {
    payload.role = "data_engine";  // Fallback
  }

  try {
    const response = await fetch(
      "https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 422) {
      console.error("422 Error - Check that 'role' property is included");
      throw new AgentError("Body Validation Error", response.status);
    }

    return response.json();
  } catch (error) {
    this.handleError(error);
    throw error;
  }
}
```

---

## Validation Checklist

- [ ] **Role property present:** Ensure `role: "data_engine"` is in payload
- [ ] **Correct endpoint:** Using `/latest/agents/trigger` (not `/run`)
- [ ] **Headers correct:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <API_KEY>`
  - `X-API-Key: <API_KEY>`
- [ ] **Context complete:**
  - `conversation_id` ✅
  - `user_id` ✅
  - `project_id` ✅
- [ ] **Input not empty:** `input` must have value

---

## Testing

### Test with cURL:
```bash
curl -X POST http://localhost:3000/api/agent/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What is 2+2?",
    "context": {
      "conversation_id": "test-conv-123",
      "user_id": "user-123"
    }
  }'
```

### Expected Response (Success):
```json
{
  "success": true,
  "data": {
    "message": "2 + 2 = 4",
    "metadata": { ... }
  }
}
```

### Expected Response (Error):
```json
{
  "success": false,
  "error": {
    "message": "Body Validation Error",
    "code": 422,
    "suggestion": "Ensure 'role' property is included..."
  }
}
```

---

## File Changes Summary

| File | Change | Purpose |
|------|--------|---------|
| `agentPayloadBuilder.ts` | Add `role: "data_engine"` | Include required field |
| `agentCommunicationService.ts` | Use `/trigger` endpoint | Use correct API |
| `configManager.ts` | Support trigger format | Configure new endpoint |
| `server.js` | Create/Update | Backend proxy with validation |
| `.env` | Create | API credentials |

---

## Debugging

### If still getting 422 errors:

1. **Check payload in browser DevTools:**
   ```javascript
   // In console
   console.log(JSON.stringify(payload, null, 2));
   ```

2. **Enable server logs:**
   ```bash
   DEBUG=* node server.js
   ```

3. **Check API endpoint:**
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger
   ```

4. **Verify role values:**
   - `data_engine` (most common)
   - `code_interpreter` (if code execution needed)
   - Check Relevance AI docs for other valid roles

---

## Next Steps

1. **Immediate:** Update `agentPayloadBuilder.ts` to include `role`
2. **Short-term:** Set up backend proxy for validation layer
3. **Long-term:** Add comprehensive error handling and retry logic

---

## References

- Endpoint: `/latest/agents/trigger`
- Required fields: `role`, `input`, `context`
- Backend proxy: `server.js`
- Payload builder: `agentPayloadBuilder.ts`
