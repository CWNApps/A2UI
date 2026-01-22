# GenUI Quick Start Guide

Get the GenUI application up and running in 5 minutes.

## 1. Setup (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Relevance AI credentials
# Required:
# - VITE_API_KEY
# - VITE_PROJECT_ID  
# - VITE_AGENT_ID
# - VITE_API_BASE_URL
```

**Getting credentials**:
1. Log in to https://relevance.ai
2. Settings → API Keys → Copy API Key (VITE_API_KEY)
3. Copy Project ID (VITE_PROJECT_ID)
4. Agents → Create/Select Agent → Copy Agent ID (VITE_AGENT_ID)

## 2. Build (1 minute)

```bash
npm run build
# Expected output:
# ✅ Ran 1 script and skipped 2 in 3s.
```

## 3. Start Development Server (1 minute)

```bash
npm run dev
# Visit: http://localhost:5173
```

## 4. Test Integration (2 minutes)

### Option A: Browser Console

```javascript
// In browser console (F12 → Console tab)

import { genUI, initializeGenUI } from './src/lib/genUIApp';

await genUI.initialize();

const result = await genUI.query('What is 2+2?');

console.log('Status:', result.response.status);
console.log('Visualization:', result.visualizationHtml ? 'Yes' : 'No');
console.log('Follow-ups:', result.followUpQueries);
```

### Option B: Create Test Component

```typescript
// In your component or app.ts

import { genUI, initializeGenUI } from './src/lib/genUIApp';

async function testQuery() {
  await initializeGenUI();
  
  try {
    const result = await genUI.query('Generate a sales report');
    
    console.log('✓ Query successful!');
    console.log('Response:', result.response.data);
    
    if (result.visualizationHtml) {
      document.getElementById('output').innerHTML = result.visualizationHtml;
    }
    
  } catch (error) {
    console.error('✗ Query failed:', error);
  }
}

testQuery();
```

## 5. Deploy to Vercel (Optional)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy

# Set environment variables
vercel env add VITE_API_KEY
vercel env add VITE_PROJECT_ID
vercel env add VITE_AGENT_ID

# Redeploy with env vars
vercel deploy --prod
```

## Common Tasks

### Execute a Query

```typescript
const result = await genUI.query('Your query here');
console.log(result.visualizationHtml);  // Display visualization
```

### Execute Recursive Queries

```typescript
const results = await genUI.recursiveQuery('Comprehensive analysis');
// results array with depth info
```

### Check Service Health

```typescript
const health = genUI.getHealth();
console.log(health.config.valid);      // true/false
console.log(health.requests.active);   // number
console.log(health.cache.size);        // number
```

### View Logs

```typescript
const recentLogs = genUI.getLogs(50);  // Last 50
console.table(recentLogs);
```

### Export Logs

```typescript
const json = genUI.exportLogs('json');
const csv = genUI.exportLogs('csv');
```

### Clear Cache

```typescript
genUI.clearCache();
```

## Troubleshooting

### "Config validation failed"

```typescript
const health = genUI.getHealth();
console.log(health.config.errors);
// Action: Check .env file for missing variables
```

### "HTTP 422 Error"

- This means the request payload format is wrong
- The app prevents this automatically
- If you still see it, check that no "role" property is in the payload

### "Query times out"

```typescript
// Increase timeout in .env
VITE_QUERY_TIMEOUT_MS=60000  // 60 seconds
```

### "Visualization not rendering"

```typescript
const result = await genUI.query(text);
console.log('Raw response:', result.response.data);
// If HTML is empty, the agent response might not have UI payload
```

## Key Files

- **`.env`** - Your configuration (create from `.env.example`)
- **`src/lib/genUIApp.ts`** - Main entry point
- **`GENUI_IMPLEMENTATION.md`** - Full documentation
- **`GENUI_TESTING.md`** - Testing guide

## What's Included

✅ Agent request building (correct format, no 422 errors)
✅ A2UI visualization rendering
✅ Recursive query management
✅ Error handling with retries
✅ Query caching
✅ Comprehensive logging
✅ Configuration management
✅ Health monitoring

## API Reference

```typescript
// Initialize
await genUI.initialize(config?: {});

// Query
const result = await genUI.query(text: string, conversationId?: string);

// Recursive
const results = await genUI.recursiveQuery(text: string, conversationId?: string);

// Health
genUI.getHealth();              // Full health status
genUI.getSummary();             // Configuration summary

// Logs
genUI.getLogs(count?: number);  // Get recent logs
genUI.exportLogs('json' | 'csv');

// Management
genUI.clearCache();             // Clear all cached responses
```

## Result Object

```typescript
interface QueryResult {
  query: string;                    // The query executed
  response: {
    status: number;                 // HTTP status
    data: any;                      // Agent response
    timestamp: number;              // When received
  };
  visualizationHtml?: string;       // Rendered A2UI
  followUpQueries?: string[];       // Auto-detected follow-ups
  depth: number;                    // Recursion depth
  cached: boolean;                  // Was from cache
}
```

## Next Steps

1. ✅ Complete setup (5 min)
2. Run test query (1 min)
3. Integrate into your component
4. Customize visualization styling
5. Configure caching strategy
6. Deploy to production

## Support

- See `GENUI_IMPLEMENTATION.md` for detailed documentation
- See `GENUI_TESTING.md` for testing guide
- Check `.env.example` for all configuration options
- View source comments in `src/lib/` for code details

---

**Status**: Ready to use ✅
**Time to first query**: ~5 minutes
**Configuration required**: 4 environment variables
