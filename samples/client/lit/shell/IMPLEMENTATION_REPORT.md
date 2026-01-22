# VITE CLIENT FIXES - COMPLETE IMPLEMENTATION

## Problem Summary

The Vite web client had 3 critical issues:
1. **Env Var Mismatch**: App expected `VITE_RELEVANCE_AGENT_ID` but Vercel had `VITE_AGENT_ID`
2. **Double `/latest`**: URLs were hitting `/latest/latest/studios/tools/trigger_async` → 404
3. **Wrong Endpoint**: App was only calling TOOL directly instead of preferring AGENT endpoint

## Solution Implemented

### File 1: `src/lib/env.ts`
**Purpose**: Environment configuration with backward compatibility

**Key Changes**:
1. Added `normalizeStackBase(url)` helper function
   - Removes trailing slashes
   - Removes `/latest` suffix to prevent double-latest
   
2. Updated `RelevanceConfig` interface
   - Added `agentId` field
   
3. Modified `getRelevanceConfig()`
   - Accepts both `VITE_RELEVANCE_AGENT_ID` and `VITE_AGENT_ID`
   - Accepts both `VITE_RELEVANCE_TOOL_ID` and `VITE_TOOL_ID`
   - Returns config with all fields
   
4. Updated `validateRelevanceConfig()`
   - Accepts either agent_id OR tool_id (not requiring both)
   - Returns clear list of missing variables
   - Supports both naming schemes

```typescript
export function normalizeStackBase(url: string): string {
  let normalized = url.replace(/\/+$/, "");
  normalized = normalized.replace(/\/latest$/, "");
  return normalized;
}
```

### File 2: `app.ts` - Class `rh` method `send()`
**Purpose**: Route messages to correct endpoint with proper formatting

**Key Changes**:

#### Step 1: Read env vars with backward compatibility
```typescript
const agentId =
  import.meta.env.VITE_RELEVANCE_AGENT_ID ?? 
  import.meta.env.VITE_AGENT_ID ?? "";
const toolId =
  import.meta.env.VITE_RELEVANCE_TOOL_ID ?? 
  import.meta.env.VITE_TOOL_ID ?? "";
```

#### Step 2: Normalize base URL
```typescript
const stackBase = normalizeStackBase(rawStackBase);
```

#### Step 3: Build correct endpoint URLs using URL()
```typescript
const triggerToolUrl = new URL("/latest/studios/tools/trigger_async", stackBase).toString();
const pollToolUrl = new URL("/latest/studios/tools/poll_async", stackBase).toString();
const triggerAgentUrl = new URL("/latest/agents/trigger", stackBase).toString();
```

#### Step 4: Smart routing (AGENT preferred, TOOL fallback)
```typescript
if (agentId) {
  // POST to AGENT endpoint
  const triggerBody = {
    agent_id: agentId,
    conversation_id: this.#getConversationId(),
    message: { text: t }  // ← IMPORTANT: message is OBJECT not string
  };
} else if (toolId) {
  // POST to TOOL endpoint + polling
  const triggerBody = {
    tool_id: toolId,
    params: { message: t }
  };
  // Poll until type === "complete"
}
```

#### Step 5: Render using toA2uiMessagesFromRelevance()
- Handles tables, metrics, charts, mixed components
- Shows "No rows returned" instead of blank page
- Never renders blank - always shows at least a title

#### Step 6: Console logging
```
[RelevanceRouter] Normalized base URL: {url}
[RelevanceRouter] Agent endpoint: {url}
[RelevanceRouter] Tool endpoint: {url}
[RelevanceRouter] Using AGENT endpoint
[RelevanceRouter] Agent response: 200
[RelevanceRouter] Route: AGENT, Messages: 2
```

#### Helper: Stable conversation ID
```typescript
#getConversationId(): string {
  const storageKey = "relevance_conversation_id";
  let id = localStorage.getItem(storageKey);
  if (!id) {
    id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, id);
  }
  return id;
}
```

## Results

### Before
- ❌ App crashes with "Missing VITE_RELEVANCE_AGENT_ID" even if VITE_AGENT_ID is set
- ❌ Network tab shows `/latest/latest/studios/tools/trigger_async` → 404
- ❌ Wrong endpoint called (TOOL instead of AGENT)
- ❌ UI goes blank on empty response
- ❌ No debugging info in console

### After
- ✅ Works with either `VITE_AGENT_ID` or `VITE_RELEVANCE_AGENT_ID`
- ✅ URLs are correct: `/latest/agents/trigger` or `/latest/studios/tools/trigger_async`
- ✅ Uses AGENT endpoint by default, falls back to TOOL
- ✅ Tables render with headers and data rows
- ✅ Empty responses show friendly message
- ✅ Full debugging info in console

## Testing Verification

### Network Tab (no /latest/latest)
```
POST https://api-xxxxx.stack.tryrelevance.com/latest/agents/trigger
GET  https://api-xxxxx.stack.tryrelevance.com/latest/studios/tools/poll_async/...
```

### Console Output
```
[RelevanceRouter] Normalized base URL: https://api-xxxxx.stack.tryrelevance.com
[RelevanceRouter] Agent endpoint: https://api-xxxxx.stack.tryrelevance.com/latest/agents/trigger
[RelevanceRouter] Using AGENT endpoint
[RelevanceRouter] Agent response: 200
[RelevanceRouter] Route: AGENT, Messages: 2
```

### UI Rendering
- Agent query: "Top 3 from CAST TECH HS & skills summary"
- Result: Table showing rows with headers (name, skill, score, etc.)
- Not blank, always has content

## Environment Variables

### For Agent endpoint (recommended)
```bash
VITE_RELEVANCE_STACK_BASE=https://api-xxxxx.stack.tryrelevance.com
VITE_RELEVANCE_AGENT_ID=your_agent_id
VITE_RELEVANCE_PROJECT_ID=your_project_id
VITE_RELEVANCE_API_KEY=your_api_key
```

### For Tool endpoint (fallback)
```bash
VITE_RELEVANCE_STACK_BASE=https://api-xxxxx.stack.tryrelevance.com
VITE_RELEVANCE_TOOL_ID=your_tool_id
VITE_RELEVANCE_PROJECT_ID=your_project_id
VITE_RELEVANCE_API_KEY=your_api_key
```

### Backward compatible (old names still work)
```bash
VITE_RELEVANCE_STACK_BASE=https://api-xxxxx.stack.tryrelevance.com
VITE_AGENT_ID=your_agent_id
VITE_RELEVANCE_PROJECT_ID=your_project_id
VITE_RELEVANCE_API_KEY=your_api_key
```

## Code Quality

- ✅ No TypeScript errors
- ✅ Proper error handling and user-facing messages
- ✅ Console logging for debugging
- ✅ Backward compatible with existing env var names
- ✅ Handles edge cases (empty responses, timeouts, malformed JSON)
- ✅ Uses URL() constructor instead of string concatenation for reliability
