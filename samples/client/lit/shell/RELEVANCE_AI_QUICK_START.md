# Relevance AI Integration - Quick Start

## 1. Setup (3 steps)

```bash
# Step 1: Copy the environment template
cp .env.example .env

# Step 2: Edit .env with your Relevance AI credentials
# (Get these from your Relevance AI project settings)
# 
# VITE_RELEVANCE_PROJECT_ID=your_project_id
# VITE_RELEVANCE_API_KEY=your_api_key
# VITE_RELEVANCE_AGENT_ID=your_agent_id

# Step 3: Install and run
npm install
npm run dev
```

## 2. How It Works

The app detects Relevance AI mode when `config.serverUrl` is empty (default).

When you send a message:
1. ✅ Credentials are read from `.env`
2. ✅ API call is made to Relevance AI
3. ✅ Response is converted to A2UI protocol
4. ✅ **Text is always rendered** (never blank)
5. ✅ **JSON components are extracted and rendered if present**

## 3. What Gets Rendered

### Text + JSON Component
```
If API returns: "Check this table: <json-component>{"Table":...}</json-component>"

You see:
├─ Text: "Check this table:"
└─ Table: [rendered JSON]
```

### Text Only
```
If API returns: "Hello, here's your answer..."

You see:
└─ Text: "Hello, here's your answer..."
```

### Error Fallback
```
If API fails or env vars missing

You see:
└─ Text: "Error: Missing environment variables..."
```

**Result: UI never stays blank!**

## 4. Debugging

Check browser console for:

| Log | Meaning |
|-----|---------|
| `RAW AGENT RESPONSE: {...}` | Raw API response (check shape) |
| `EXTRACTED VISUAL DATA: {...}` | Parsed JSON component |
| `CONSTRUCTED COMPONENTS: [...]` | Built A2UI array |
| `RETURNING A2UI PROTOCOL: [...]` | Final message to renderer |

## 5. Common Issues

| Problem | Solution |
|---------|----------|
| Blank screen | Check `.env` is filled + restart dev server |
| "Missing environment variables" error | Run `cp .env.example .env` and fill it |
| API Error 401/403 | Verify credentials in Relevance AI dashboard |
| JSON not rendering | Check `<json-component>` tags are valid XML-style |

## 6. For Deployment

Set these environment variables in your platform:
- `VITE_RELEVANCE_PROJECT_ID`
- `VITE_RELEVANCE_API_KEY`
- `VITE_RELEVANCE_AGENT_ID`

Vite automatically injects them at build time. ✅

---

**First time?** Start with Step 1 above. You'll see responses in ~2 minutes.
