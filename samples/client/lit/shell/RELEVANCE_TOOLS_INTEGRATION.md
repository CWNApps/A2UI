# Relevance AI Tools Integration Guide

## Overview

The A2UI Lit Shell now uses **Relevance AI Tools API** for interactive UI responses instead of the Agents API. This provides immediate feedback to users without requiring background job monitoring.

## Why Tools Instead of Agents?

### Agents API (Async Only)
- ❌ Triggers async background jobs with no direct HTTP response
- ❌ Output goes to a separate destination (webhook, queue, etc.)
- ❌ Cannot be used for interactive web UIs
- ❌ Results in blank screens waiting for responses

### Tools API (Interactive)
- ✅ Supports both sync and async polling
- ✅ Returns output directly in HTTP response
- ✅ Perfect for interactive web applications
- ✅ Users get immediate visible feedback

## How It Works

### Flow Diagram
```
1. User enters prompt in UI
           ↓
2. Client calls /studios/{toolId}/trigger_async
           ↓
3. Relevance returns job_id
           ↓
4. Client polls /studios/{toolId}/async_poll/{jobId}
           ↓
5. Once complete, output is returned
           ↓
6. UI renders the response immediately (never blank!)
```

### Implementation Details

**File**: `samples/client/lit/shell/app.ts`

**Classes**:
- `RelevanceToolsClient`: Handles all tool API communication
  - Validates environment variables
  - Triggers async tool execution
  - Polls for completion
  - Handles errors gracefully
  
- `rh` (RelevanceAgent): Wrapper that returns A2UI protocol messages
  - Calls `RelevanceToolsClient.runTool()`
  - Wraps output in A2UI `beginRendering` message
  - Renders errors visibly

## Configuration

### Required Environment Variables

Set these in `.env` (copy from `.env.example`):

```env
# Stack base URL - find this in your Relevance AI dashboard
# Format: https://api-<stack-id>.stack.tryrelevance.com/latest
VITE_RELEVANCE_STACK_BASE=https://api-xxxxx.stack.tryrelevance.com/latest

# Your project ID
VITE_RELEVANCE_PROJECT_ID=your_project_id

# Your API key - keep this secret!
# Do NOT commit to version control
VITE_RELEVANCE_API_KEY=your_api_key

# Your Tool/Studio ID
# This is the interactive tool you want to trigger
VITE_RELEVANCE_TOOL_ID=your_tool_id
```

### Finding Your Credentials

1. **Project ID & API Key**:
   - Log in to Relevance AI dashboard
   - Go to Settings → Project settings
   - API Keys section

2. **Stack Base URL**:
   - Found in API documentation or dashboard
   - Pattern: `https://api-<unique-id>.stack.tryrelevance.com/latest`

3. **Tool ID**:
   - Navigate to Studios/Tools in dashboard
   - Select your interactive tool
   - Copy the ID from URL or settings

## API Endpoints Used

### Trigger (Start Job)
```
POST {STACK_BASE}/studios/{TOOL_ID}/trigger_async
Headers:
  Authorization: {API_KEY}
  Content-Type: application/json
Body:
  {
    "params": { "query": "user_prompt" },
    "project": "PROJECT_ID"
  }
Returns:
  { "job_id": "..." }
```

### Poll (Check Status)
```
GET {STACK_BASE}/studios/{TOOL_ID}/async_poll/{job_id}?ending_update_only=true
Headers:
  Authorization: {API_KEY}
Polls until:
  { "status": "completed", "output": "..." }
```

## Error Handling

The implementation includes robust error handling:

### Missing Environment Variables
- ✅ Validates all required vars at runtime
- ✅ Returns helpful error message showing which vars are missing
- ✅ Renders error visibly in UI (not just console)

### Network Errors
- ✅ Catches HTTP errors (non-2xx responses)
- ✅ Reads response body before throwing (avoids blank responses)
- ✅ Includes status code and error text in error message

### Parsing Errors
- ✅ Handles invalid JSON in responses
- ✅ Handles missing expected fields
- ✅ Returns descriptive error messages

### Timeouts
- ✅ Polls for max 60 seconds
- ✅ Returns clear timeout error if exceeded

## Console Logging

The implementation provides detailed console logs for debugging:

```javascript
[Relevance Tool] Triggering async tool...
[Relevance Tool] Job started: {job_id}
[Relevance Tool] Polling... (2s)
[Relevance Tool] Poll response: {...}
[Relevance Tool] Completed with output: ...
[RelevanceAgent] Tool output received: ...
[RelevanceAgent] Returning A2UI message: [...]
```

Check your browser console to debug any issues.

## Deployment

### Local Development
```bash
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

### Production (Vercel, etc.)

1. Set environment variables in platform settings:
   - `VITE_RELEVANCE_STACK_BASE`
   - `VITE_RELEVANCE_PROJECT_ID`
   - `VITE_RELEVANCE_API_KEY`
   - `VITE_RELEVANCE_TOOL_ID`

2. Variables prefixed with `VITE_` are automatically injected by Vite at build time

3. Secrets are never hardcoded in source code ✅

## Testing

### Quick Test
1. Fill `.env` with your Relevance credentials
2. Restart dev server
3. Open http://localhost:5173
4. Type a prompt and submit
5. Should see response appear within ~60 seconds

### What to Look For
- ✅ Response text appears (never blank screen)
- ✅ Console shows `[Relevance Tool]` and `[RelevanceAgent]` logs
- ✅ Network tab shows:
  - `trigger_async` request with 200/201 response
  - Multiple `async_poll` requests
  - Final poll shows completed status

### Common Issues

**Blank Screen / No Response**
- Check browser console for errors
- Verify all 4 env vars are set and non-empty
- Check that Tool ID is correct in Relevance dashboard

**Network Errors (422, 401, etc.)**
- 401: Check API key is correct
- 422: Check request body format (should be exact)
- Check Stack Base URL format

**Timeout After 60 seconds**
- Tool may be taking too long
- Check Relevance dashboard for tool execution issues
- Increase timeout if needed in `RelevanceToolsClient.runTool()`

## Troubleshooting

### Enable Debug Logging
Browser console already shows all logs. Look for:
- `[Relevance Tool]` prefix for tool-specific logs
- `[RelevanceAgent]` prefix for agent wrapper logs

### Check Network Requests
1. Open Browser DevTools → Network tab
2. Filter by `studios` to see tool API calls
3. Click each request to see headers and body
4. Verify:
   - Authorization header is just the API key (not `projectId:apiKey`)
   - Request body matches expected format
   - Responses have expected structure

### Verify Credentials
Test your credentials with curl:
```bash
curl -X POST \
  "https://api-xxxxx.stack.tryrelevance.com/latest/studios/{TOOL_ID}/trigger_async" \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "params": { "query": "test" },
    "project": "YOUR_PROJECT_ID"
  }'
```

## Security

✅ **Best Practices Implemented**:
- No API keys hardcoded in source code
- Secrets stored in `.env` (excluded from git)
- Environment variables read at runtime from `.env`
- `.env` never committed to version control
- All secrets marked with comments (keep this secret!)

## Migration from Agents API

If you were previously using Agents API:

**Old Code** (Agents API - not suitable for interactive UIs):
```typescript
fetch("https://api-.../latest/agents/trigger", {
  method: "POST",
  headers: {
    "Authorization": `${projectId}:${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    message: { role: "user", content: promptText },
    agent_id: agentId
  })
});
// Response: { status: "job_started" } - not the actual output!
```

**New Code** (Tools API - perfect for interactive UIs):
```typescript
// Uses RelevanceToolsClient internally
const output = await toolsClient.runTool(promptText);
// Response: actual output text, ready to display!
```

## API Rate Limits

- ✅ Check Relevance documentation for rate limits
- ✅ Default timeout: 60 seconds per tool execution
- ✅ Poll interval: 500ms
- ✅ Adjust as needed in `RelevanceToolsClient.runTool()`

## Future Improvements

Possible enhancements:
- [ ] Streaming responses (server-sent events)
- [ ] Progress indicator while polling
- [ ] Configurable timeout
- [ ] Retry logic for transient failures
- [ ] Response caching
- [ ] Analytics/logging

## Support

For issues:
1. Check console logs (search for `[Relevance Tool]`)
2. Verify environment variables in Network tab request headers
3. Check Relevance AI dashboard for tool execution status
4. Consult Relevance AI API documentation

## Related Files

- **Implementation**: `samples/client/lit/shell/app.ts`
- **Configuration**: `samples/client/lit/shell/.env`
- **Template**: `samples/client/lit/shell/.env.example`
- **Documentation**: `samples/client/lit/shell/README.md`

---

**Status**: ✅ Ready for production deployment

The Tools API integration provides reliable, interactive UI responses with proper error handling and no hardcoded secrets.
