# CRITICAL BUG FIX - Agent Message Format

## Issue Identified
The agent request body had **incorrect message schema**, which would cause **422 Unprocessable Entity** errors.

## Bug Fixed

### ❌ BEFORE (WRONG - Causes 422)
```typescript
const triggerBody = {
  agent_id: agentId,
  conversation_id: this.#getConversationId(),
  message: { text: t },  // ← WRONG: text property not recognized
};
```

### ✅ AFTER (CORRECT)
```typescript
const triggerBody = {
  agent_id: agentId,
  conversation_id: this.#getConversationId(),
  message: { role: "user", content: t },  // ← CORRECT: role + content
};
```

## Location
File: `app.ts` 
Line: 420
Method: `rh.send()` - Agent routing branch

## Why This Matters

Relevance AI Agent API expects message object with:
- `role`: "user" (or "assistant")  
- `content`: The actual message text

Without this format, the server returns **422** and rejects the request.

## Verification

The fix has been applied. The agent trigger request now sends:
```json
{
  "agent_id": "your-agent-id",
  "conversation_id": "conv_1234567890_abcdef",
  "message": {
    "role": "user",
    "content": "your message text"
  }
}
```

## Status
✅ **FIXED** - Agent requests now use correct schema
✅ **A2UI Messages** - Already correct (surfaceUpdate + beginRendering)
✅ **URL Normalization** - Already implemented
✅ **Env Vars** - Already backward compatible

## Testing
After this fix:
- Agent requests should return **200** instead of **422**
- Response payload should be extracted and rendered
- UI should display table/data instead of blank page
