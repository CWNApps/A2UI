# GenUI Application Implementation Guide

## Overview

GenUI is a complete, production-ready application for building interactive AI-powered user interfaces with:

- **Agent Integration**: Seamless Relevance AI Agent communication with correct payload format
- **A2UI Visualization**: Render complex visualizations (tables, charts, metrics, lists)
- **Recursive Querying**: Intelligent follow-up query management
- **Error Handling**: Comprehensive retry logic with exponential backoff
- **Caching**: Response caching with TTL to optimize performance
- **Configuration Management**: Environment-based configuration with validation
- **Logging & Monitoring**: Complete logging infrastructure with export capabilities

## Architecture

### Core Modules

```
src/lib/
├── agentPayloadBuilder.ts      # Build & validate Relevance AI payloads
├── a2uiRenderer.ts             # Render A2UI visualizations to HTML
├── recursiveQueryEngine.ts      # Manage recursive queries with queue/stack
├── errorHandler.ts             # Error handling & logging
├── configManager.ts            # Configuration management
├── agentCommunicationService.ts# High-level service combining all components
└── genUIApp.ts                 # Singleton app integration
```

### Data Flow

```
User Input
    ↓
GenUIApp.query()
    ↓
AgentCommunicationService.executeQuery()
    ↓
[Check Cache]
    ↓
buildAgentRequestPayload()
    ↓
Relevance AI Agent API
    ↓
extractPayloadFromResponse()
    ↓
[Render Visualization]
    ↓
QueryResult (with HTML & follow-ups)
```

## Key Features

### 1. Correct Agent Request Format

**IMPORTANT**: The agent request payload must use this exact format:

```typescript
{
  agent_id: string,
  conversation_id: string,
  message: { text: string }
}

// ❌ WRONG - Causes HTTP 422 error
{
  role: "user",      // Don't include this
  input: "...",
  context: {...}
}
```

The `buildAgentRequestPayload()` function automatically creates the correct format and rejects invalid payloads.

### 2. A2UI Visualization Support

Supports all A2UI visualization types:

```typescript
// Table
{
  type: "table",
  headers: ["col1", "col2"],
  rows: [["val1", "val2"]]
}

// Metric
{
  type: "metric",
  value: 42,
  label: "Total",
  trend: "up"
}

// Chart
{
  type: "chart",
  chartType: "bar",
  labels: ["A", "B"],
  datasets: [{ label: "Data", data: [10, 20] }]
}

// Mixed/Composite
{
  type: "mixed",
  components: [
    { type: "metric", ... },
    { type: "chart", ... }
  ]
}
```

### 3. Recursive Query Management

Automatically manages follow-up queries:

```typescript
// Single query
const result = await genUI.query("Show me sales data");

// Recursive queries (auto-generates follow-ups)
const results = await genUI.recursiveQuery(
  "Generate comprehensive dashboard"
);

// Results includes:
// - Initial query result
// - Auto-detected follow-up queries
// - Cached responses where applicable
```

### 4. Error Handling & Retry Logic

Automatic retry with exponential backoff:

```typescript
try {
  const result = await genUI.query("What is my revenue?");
} catch (error) {
  if (error instanceof AgentError) {
    console.log(`Error: ${error.message}`);
    console.log(`Status: ${error.statusCode}`);
    console.log(`Retryable: ${error.retryable}`);
  }
}
```

Retryable status codes: 408, 429, 500, 502, 503, 504

### 5. Caching System

Query results are cached with TTL:

```typescript
// First call: hits API
const result1 = await genUI.query("Show sales");

// Subsequent calls within 5 minutes: returns cached
const result2 = await genUI.query("Show sales");
// result2.cached === true

// Clear cache
genUI.clearCache();
```

Configuration:
- `enableCaching`: true/false
- `cacheTtlMs`: 300000 (5 minutes default)
- `maxCacheSize`: 100 entries

## Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
# Required
VITE_API_KEY=your_api_key
VITE_PROJECT_ID=your_project_id
VITE_AGENT_ID=your_agent_id
VITE_API_BASE_URL=https://api.relevance.ai

# Optional (defaults provided)
VITE_CONVERSATION_ID=
VITE_USER_ID=
VITE_MAX_QUERY_DEPTH=5
VITE_ENABLE_CACHING=true
VITE_MAX_RETRIES=3
VITE_LOG_LEVEL=INFO
```

### Runtime Configuration

```typescript
import { initializeGenUI } from './src/lib/genUIApp';

// Initialize with custom config
await initializeGenUI({
  maxQueryDepth: 3,
  enableCaching: false,
  maxRetries: 5
});
```

### Validation

```typescript
const health = genUI.getHealth();
console.log(health.config.valid);     // true/false
console.log(health.config.errors);    // [list of errors]
```

## Usage Examples

### Basic Query

```typescript
import { genUI, initializeGenUI } from './src/lib/genUIApp';

// Initialize
await initializeGenUI();

// Execute query
const result = await genUI.query("What are my top 10 customers?");

// Access results
console.log(result.response.data);        // Agent response
console.log(result.visualizationHtml);    // Rendered visualization
console.log(result.followUpQueries);      // Auto-detected follow-ups
```

### Recursive Query Chain

```typescript
const results = await genUI.recursiveQuery(
  "Create a comprehensive sales dashboard"
);

// results is an array of QueryResult
results.forEach((result, index) => {
  console.log(`Query ${index + 1} (depth ${result.depth}): ${result.query}`);
  console.log(`Response status: ${result.response.status}`);
  if (result.visualizationHtml) {
    // Display visualization
    document.getElementById('output').innerHTML += result.visualizationHtml;
  }
});
```

### Error Handling with Retry

```typescript
import { executeWithRetry, DEFAULT_RETRY_POLICY } from './src/lib/errorHandler';

const result = await executeWithRetry(
  () => genUI.query("Complex analytics query"),
  {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 5,
    initialDelayMs: 2000
  },
  genUI.getErrorHandler()
);
```

### Logging & Monitoring

```typescript
// Get recent logs
const logs = genUI.getLogs(50);

// Export logs
const jsonLogs = genUI.exportLogs('json');
const csvLogs = genUI.exportLogs('csv');

// Check health
const health = genUI.getHealth();
console.log(`Active requests: ${health.requests.active}`);
console.log(`Cache size: ${health.cache.size}`);

// Get summary
const summary = genUI.getSummary();
console.log(JSON.stringify(summary, null, 2));
```

## Integration with Lit Components

### Using in a Lit Element

```typescript
import { LitElement, html } from 'lit';
import { genUI, initializeGenUI } from './src/lib/genUIApp';

export class QueryComponent extends LitElement {
  async connectedCallback() {
    super.connectedCallback();
    
    // Initialize on first mount
    if (!genUI.isInitialized()) {
      await initializeGenUI();
    }
  }

  async executeQuery(queryText: string) {
    try {
      const result = await genUI.query(queryText);
      this.renderResult(result);
    } catch (error) {
      console.error('Query failed:', error);
    }
  }

  renderResult(result: QueryResult) {
    return html`
      <div class="result">
        <div class="visualization">
          ${unsafeHTML(result.visualizationHtml || '<p>No visualization</p>')}
        </div>
        ${result.followUpQueries?.length > 0 ? html`
          <div class="follow-ups">
            <h3>Suggested Follow-up Questions:</h3>
            ${result.followUpQueries.map(q => html`<p>${q}</p>`)}
          </div>
        ` : ''}
      </div>
    `;
  }
}
```

## Troubleshooting

### HTTP 422 Error

**Problem**: Agent request returns 422 Unprocessable Entity

**Cause**: Invalid request payload format

**Solution**: 
- Check that payload uses correct format (no "role" property)
- Use `buildAgentRequestPayload()` which ensures correct format
- Check all required fields are present

### Blank Visualization

**Problem**: No visualization displayed

**Causes & Solutions**:
1. A2UI payload not found in response → Check response structure
2. Unsupported visualization type → Check A2UI type is in supported list
3. Malformed HTML → Check for XSS prevention

**Debug**:
```typescript
const result = await genUI.query(text);
console.log('Raw response:', result.response.data);
console.log('Extracted payload:', extractPayloadFromResponse(result.response.data));
```

### Slow Queries

**Problem**: Queries take too long

**Solutions**:
1. Check `queryTimeoutMs` setting
2. Enable caching: `enableCaching: true`
3. Reduce `maxTableRows` for large result sets
4. Check network connectivity

### Memory Issues

**Problem**: Application uses too much memory

**Solutions**:
1. Reduce `maxCacheSize`
2. Disable caching if not needed
3. Clear cache periodically: `genUI.clearCache()`
4. Reduce `maxQueueSize` for queries

## Production Deployment

### Vercel Deployment

1. **Set Environment Variables**:
   ```bash
   vercel env add VITE_API_KEY
   vercel env add VITE_PROJECT_ID
   vercel env add VITE_AGENT_ID
   ```

2. **Configure vercel.json** (already includes SPA routing):
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

3. **Deploy**:
   ```bash
   vercel deploy --prod
   ```

### Production Configuration

```env
NODE_ENV=production
VITE_LOG_LEVEL=WARN
VITE_ENABLE_DETAILED_ERRORS=false
VITE_MAX_RETRIES=5
VITE_MAX_CACHE_SIZE=50
VITE_QUERY_TIMEOUT_MS=45000
```

## Performance Optimization

### Caching Strategy

```typescript
// High-value queries
await initializeGenUI({
  enableCaching: true,
  cacheTtlMs: 600000,      // 10 minutes
  maxCacheSize: 200
});
```

### Concurrent Request Limiting

Service automatically limits concurrent requests to 5:
```typescript
// Access remaining capacity
const health = genUI.getHealth();
const availableSlots = 5 - health.requests.active;
```

### Query Depth Management

```typescript
await initializeGenUI({
  maxQueryDepth: 3  // Limit recursion
});
```

## Monitoring & Analytics

### Health Check Endpoint

```typescript
const health = genUI.getHealth();
// Returns: { healthy, config, requests, cache, queries }
```

### Export Logs

```typescript
// Export for analysis
const logs = genUI.exportLogs('json');

// Send to logging service
await fetch('/api/logs', {
  method: 'POST',
  body: logs
});
```

## Testing

### Unit Test Example

```typescript
import { expect } from '@esm-bundle/chai';
import { buildAgentRequestPayload } from './src/lib/agentPayloadBuilder';

describe('agentPayloadBuilder', () => {
  it('builds correct payload format', () => {
    const payload = buildAgentRequestPayload(
      'agent123',
      'conv456',
      'Hello world'
    );
    
    expect(payload).to.deep.include({
      agent_id: 'agent123',
      conversation_id: 'conv456',
      message: { text: 'Hello world' }
    });
    expect(payload).to.not.have.property('role');
  });
});
```

## API Reference

### GenUIApp

```typescript
genUI.initialize(config?: any): Promise<boolean>
genUI.query(text: string, conversationId?: string): Promise<QueryResult>
genUI.recursiveQuery(text: string, conversationId?: string): Promise<QueryResult[]>
genUI.getHealth(): HealthStatus
genUI.getSummary(): AppSummary
genUI.getLogs(count?: number): LogEntry[]
genUI.exportLogs(format: 'json' | 'csv'): string
genUI.clearCache(): void
```

## Support & Resources

- **Documentation**: See docs/ folder
- **Examples**: Check samples/ folder
- **Issues**: Report on GitHub
- **API Docs**: https://api.relevance.ai/docs

## License

Apache License 2.0 - See LICENSE file
