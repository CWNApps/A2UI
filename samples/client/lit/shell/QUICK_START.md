# Quick Start: Relevance Tools API Integration

## 🎯 What Changed
The Vite app now runs Relevance Tools interactively with:
- ✅ **Proper trigger + poll pattern** (not blank responses)
- ✅ **Clear error messages** when env vars are missing (not console-only)
- ✅ **Simple and advanced input modes** (text or JSON)
- ✅ **Correct authentication** (projectId:apiKey format)
- ✅ **Timeout protection** (60s max)

## 🚀 Local Development (30 seconds)

```bash
cd samples/client/lit/shell
cp .env.example .env
# Edit .env with your 4 env vars
npm install
npm run dev
# Visit http://localhost:5173
```

### Get Your Environment Variables
1. **VITE_RELEVANCE_STACK_BASE**: From Relevance Dashboard → API Docs
   - Format: `https://api-xxxxx.stack.tryrelevance.com/latest`
2. **VITE_RELEVANCE_PROJECT_ID**: From Project Settings
3. **VITE_RELEVANCE_API_KEY**: From Project Settings (keep secret!)
4. **VITE_RELEVANCE_TOOL_ID**: From your Tool/Studio Settings

## ⚙️ Vercel Deployment

1. Open your Vercel project settings
2. Add 4 environment variables:
   - `VITE_RELEVANCE_STACK_BASE`
   - `VITE_RELEVANCE_PROJECT_ID`
   - `VITE_RELEVANCE_API_KEY`
   - `VITE_RELEVANCE_TOOL_ID`
3. Redeploy
4. Test by visiting the deployed URL

## 🧪 Testing the App

### Simple Mode (Plain Text)
```
User enters: "find restaurants"
✓ App sends: { message: "find restaurants" }
```

### Advanced Mode (JSON)
```
User enters: {"title":"Restaurants","limit":10}
✓ App sends: {"title":"Restaurants","limit":10}
```

### Watch Network Tab
1. Open DevTools → Network tab
2. Submit form
3. Look for:
   - ✅ `trigger_async` POST (status 200)
   - ✅ `async_poll` GET (status 200, repeats)
   - ✅ No 422 errors

## 📦 Files Changed

| File | Change | Lines |
|------|--------|-------|
| `src/lib/env.ts` | ✨ Created | 54 |
| `src/lib/relevanceTool.ts` | ✨ Created | 171 |
| `app.ts` | 🔧 Updated | ~50 |
| `.env.example` | 📝 Updated | ~40 |

## 🔍 File Locations

```
samples/client/lit/shell/
├── src/lib/
│   ├── env.ts              (new - config helper)
│   └── relevanceTool.ts    (new - Tool API client)
├── app.ts                  (updated - uses new helpers)
├── .env.example            (updated - more docs)
├── .env                    (your local config)
└── FINAL_CHANGES.md        (this document's details)
```

## ✅ Non-Negotiable Requirements Met

- [x] No revert of 404 fix
- [x] No changes to build output/root directory
- [x] Visible on-screen errors (not blank)
- [x] Compatibility with existing env vars
- [x] All 4 env vars properly named
- [x] Authorization header: `projectId:apiKey`
- [x] Request payload: `{ params: {...} }`
- [x] Build passes: `npm run build` ✅

## 🐛 Troubleshooting

### "Missing env vars: ..." shows on screen
✓ Expected! Set all 4 vars in .env or Vercel
- Did you copy `.env.example` to `.env`?
- Did you fill in all 4 values?
- Did you restart `npm run dev`?

### Network shows 422 error
❌ Old behavior (should not happen now)
- Check Authorization header format: `projectId:apiKey`
- Check request body: `{ params: {...} }`
- Check all env vars are set

### Network shows no async_poll requests
❌ Old behavior (should not happen now)
- Polling should start immediately after trigger_async
- Should repeat every 400-800ms
- Should stop when status="completed"

### Blank screen with no error
❌ Old behavior (should not happen now)
- App should always show either:
  - Error message: "Error: Missing env vars: ..."
  - Tool output: "Results: ..."
  - Loading spinner: "Awaiting an answer..."

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `IMPLEMENTATION_CHANGES.md` | Detailed implementation overview |
| `FINAL_CHANGES.md` | Complete diffs and examples |
| `.env.example` | Template with descriptions |

## 🎓 How It Works (High Level)

1. **Init:** Constructor validates env vars, stores error if missing
2. **Submit:** User enters text → `send()` is called
3. **Parse:** Input parsed (simple: `{message:...}`, advanced: JSON)
4. **Trigger:** POST to `/trigger_async`, get `job_id`
5. **Poll:** GET `/async_poll/{job_id}` every 400-800ms
6. **Complete:** When `status="completed"`, return output
7. **Render:** Response rendered as A2UI Text component
8. **Error:** Any errors rendered visibly as Text component

## 🔐 Security Notes

- Never commit `.env` to version control (in `.gitignore`)
- Use Vercel environment variables for production
- API key is sent in Authorization header (not in URL)
- All 4 vars treated as sensitive - use Vercel for deployment

## 💡 Key Decisions

| Decision | Reason |
|----------|--------|
| Separate `env.ts` | Centralized config management |
| Separate `relevanceTool.ts` | Reusable Tool API client |
| `projectId:apiKey` format | Matches Relevance API spec |
| `{ params: {...} }` payload | Matches Relevance API spec |
| 60s timeout | Reasonable for most tools |
| 400-800ms backoff | Prevents thundering herd |
| Error always visible | No blank screens |
| Simple + advanced modes | Flexibility for different tools |

## 📞 Next Steps

1. ✅ Set 4 env vars locally (or in Vercel)
2. ✅ Run `npm run build` (verify it passes)
3. ✅ Run `npm run dev` (test locally)
4. ✅ Check Network tab (trigger_async → async_poll)
5. ✅ Submit text and see results
6. ✅ Deploy to Vercel when ready
7. ✅ Test in production (watch Network tab)

---

**Build Status:** ✅ `npm run build` passes  
**Last Updated:** 2025-01-21  
**Implementation:** Complete
