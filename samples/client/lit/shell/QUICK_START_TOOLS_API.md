# Quick Start: Relevance AI Tools Integration

## 30-Second Setup

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Fill with your Relevance credentials
nano .env  # or use your editor
# Add:
# VITE_RELEVANCE_STACK_BASE=https://api-xxxxx.stack.tryrelevance.com/latest
# VITE_RELEVANCE_PROJECT_ID=your_project_id
# VITE_RELEVANCE_API_KEY=your_api_key
# VITE_RELEVANCE_TOOL_ID=your_tool_id

# 3. Start
npm install
npm run dev
```

## What Changed

### ❌ Old (Agents API - Broken)
- 422 validation errors
- Blank UI (no direct response)
- Hardcoded secrets

### ✅ New (Tools API - Works)
- No more 422 errors
- Immediate UI feedback
- Secrets in environment variables

## How It Works

1. User types prompt → submit
2. Client POSTs to `/trigger_async` → gets `job_id`
3. Client POLLs `/async_poll/{job_id}` → waits for output
4. Tool finishes → output returned
5. UI displays response (never blank!)

## Files to Know

| File | Purpose |
|------|---------|
| `.env.example` | Copy this to `.env` and fill it |
| `.env` | Your local credentials (don't commit!) |
| `app.ts` | Implementation (RelevanceToolsClient + rh classes) |
| `README.md` | Full setup instructions |
| `RELEVANCE_TOOLS_INTEGRATION.md` | Technical details |

## Environment Variables

Must set all 4:

```env
VITE_RELEVANCE_STACK_BASE=https://api-xxxxx.stack.tryrelevance.com/latest
VITE_RELEVANCE_PROJECT_ID=your_project_id
VITE_RELEVANCE_API_KEY=your_api_key  # Keep secret!
VITE_RELEVANCE_TOOL_ID=your_tool_id
```

Finding them:
- **Stack Base**: Relevance dashboard or API docs
- **Project ID**: Settings → Project
- **API Key**: Settings → API Keys (keep secret!)
- **Tool ID**: Studios/Tools → select tool → copy ID

## Testing

```bash
npm run dev
# Open http://localhost:5173
# Type a prompt
# Submit
# Should see response within ~60 seconds
```

Check browser console for `[Relevance Tool]` logs to debug.

## Deployment (Vercel, etc)

Set 4 environment variables in platform settings:
- `VITE_RELEVANCE_STACK_BASE`
- `VITE_RELEVANCE_PROJECT_ID`
- `VITE_RELEVANCE_API_KEY`
- `VITE_RELEVANCE_TOOL_ID`

Vite auto-injects them at build time. Deploy normally.

## Troubleshooting

| Problem | Check |
|---------|-------|
| Blank screen | All 4 env vars set? Restart server. |
| 401 error | API key correct? |
| Timeout | Tool slow? Max 60s. |
| Parse error | Stack Base URL format correct? |

## Next Steps

1. Read `RELEVANCE_TOOLS_INTEGRATION.md` for full details
2. Set credentials in `.env`
3. Test locally
4. Deploy to Vercel
5. Done! 🎉

## Key Differences vs Old Implementation

| Aspect | Before | After |
|--------|--------|-------|
| API | Agents (broken) | Tools (works) |
| Response | No direct output | Immediate via polling |
| Auth | `projectId:apiKey` | `apiKey` only |
| Payload | Wrong format | Correct format |
| UI | Blank | Shows text response |
| Secrets | Hardcoded | In `.env` |

## Support

- **Setup issues**: See README.md Configuration section
- **Technical details**: See RELEVANCE_TOOLS_INTEGRATION.md
- **Debugging**: Check browser console `[Relevance Tool]` logs
- **Implementation**: See app.ts RelevanceToolsClient and rh classes

---

**That's it!** Your Relevance AI integration is now working. 🚀
