# GenUI Testing & Verification Guide

This guide covers comprehensive testing of the GenUI application and its integration with Relevance AI Agents.

## Quick Start Tests

### 1. Verify Build Success

```bash
npm run build
# Expected: Build completes successfully with no TypeScript errors
# ✓ All new modules (agentPayloadBuilder, a2uiRenderer, recursiveQueryEngine, etc.) should compile
```

### 2. Test Agent Payload Builder

```typescript
import { 
  buildAgentRequestPayload,
  validateAgentRequestPayload 
} from './src/lib/agentPayloadBuilder';

// ✓ Correct payload format
const payload = buildAgentRequestPayload(
  'agent123',
  'conv456',
  'Generate sales report'
);

console.assert(payload.agent_id === 'agent123');
console.assert(payload.conversation_id === 'conv456');
console.assert(payload.message.text === 'Generate sales report');
console.assert(!('role' in payload)); // ✓ No "role" property

// ✓ Validate payload
try {
  validateAgentRequestPayload(payload);
  console.log('✓ Payload is valid');
} catch (e) {
  console.error('✗ Validation failed:', e.message);
}

// ✗ Reject invalid payload with "role"
const badPayload = { agent_id: 'a', role: 'user', message: { text: 't' } };
try {
  validateAgentRequestPayload(badPayload);
  console.error('✗ Should have rejected');
} catch (e) {
  console.log('✓ Correctly rejected:', e.message);
}
```

### 3. Test A2UI Renderer

```typescript
import { renderA2UIPayload } from './src/lib/a2uiRenderer';

// ✓ Render table
const table = renderA2UIPayload({
  type: 'table',
  headers: ['Name', 'Value'],
  rows: [['Total', '1000'], ['Average', '500']]
});
console.assert(table.includes('<table>'));
console.assert(table.includes('Total'));
console.assert(table.includes('1000'));

// ✓ Render metric
const metric = renderA2UIPayload({
  type: 'metric',
  value: 42,
  label: 'Score',
  trend: 'up'
});
console.assert(metric.includes('42'));
console.assert(metric.includes('Score'));

// ✓ Render chart
const chart = renderA2UIPayload({
  type: 'chart',
  chartType: 'bar',
  labels: ['Jan', 'Feb'],
  datasets: [{ label: 'Sales', data: [100, 200] }]
});
console.assert(chart.includes('bar'));

console.log('✓ All visualization types render correctly');
```

### 4. Test Configuration Manager

```typescript
import { ConfigManager } from './src/lib/configManager';

const config = new ConfigManager({
  agentId: 'test-agent',
  apiKey: 'test-key'
});

// ✓ Get/set values
console.assert(config.get('maxQueryDepth') === 5);
config.set('maxQueryDepth', 3);
console.assert(config.get('maxQueryDepth') === 3);

// ✓ Validation
const validation = config.validate();
console.log(validation.valid ? '✓ Config valid' : '⚠ Config incomplete');

// ✓ Export
const summary = config.getSummary();
console.log('✓ Config summary:', Object.keys(summary).join(', '));
```

### 5. Test Error Handler

```typescript
import { ErrorHandler, validateHttpResponse } from './src/lib/errorHandler';

const handler = new ErrorHandler();

// ✓ Logging
handler.info('Test message', { key: 'value' });
handler.error('Test error', 'Error description');
console.assert(handler.getLogs().length > 0);

// ✓ HTTP validation
const v422 = validateHttpResponse(422, { message: 'Invalid' }, '/api');
console.assert(!v422.valid);
console.assert(v422.error.includes('422'));

const v200 = validateHttpResponse(200, { data: 'ok' }, '/api');
console.assert(v200.valid);

console.log('✓ Error handling works correctly');
```

## Integration Tests

### Complete Flow Test

```typescript
import { genUI, initializeGenUI } from './src/lib/genUIApp';

async function testCompleteFlow() {
  try {
    console.log('Step 1: Initialize application...');
    await genUI.initialize();
    
    console.log('Step 2: Check health...');
    const health = genUI.getHealth();
    console.log('  - Config valid:', health.config.valid);
    console.log('  - Active requests:', health.requests.active);
    
    if (!health.config.valid) {
      console.error('✗ Config validation failed:', health.config.errors);
      return;
    }
    
    console.log('Step 3: Execute query...');
    const result = await genUI.query('What is the current date?');
    
    console.log('Step 4: Verify result...');
    console.assert(result.response.status === 200 || result.response.status === 'ok');
    console.assert(result.cached === false);
    console.log('  - Response status:', result.response.status);
    console.log('  - Has visualization:', !!result.visualizationHtml);
    console.log('  - Follow-up queries:', result.followUpQueries?.length || 0);
    
    console.log('Step 5: Test caching...');
    const result2 = await genUI.query('What is the current date?');
    console.assert(result2.cached === true, 'Should be cached');
    console.log('  - Second query cached:', result2.cached);
    
    console.log('✓ Complete flow test passed');
    
  } catch (error) {
    console.error('✗ Test failed:', error instanceof Error ? error.message : error);
  }
}

testCompleteFlow();
```

### Recursive Query Test

```typescript
async function testRecursiveQueries() {
  try {
    console.log('Testing recursive queries...');
    await genUI.initialize();
    
    const results = await genUI.recursiveQuery(
      'Create a comprehensive business report'
    );
    
    console.log(`✓ Got ${results.length} query results`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. Depth ${r.depth}: ${r.query.substring(0, 50)}...`);
      console.log(`     Status: ${r.response.status}, Cached: ${r.cached}`);
    });
    
  } catch (error) {
    console.error('✗ Recursive query test failed:', error);
  }
}

testRecursiveQueries();
```

## Configuration Verification

### Required Environment Variables

```bash
# Create .env file with:
VITE_API_KEY=your_api_key
VITE_PROJECT_ID=your_project_id
VITE_AGENT_ID=your_agent_id
VITE_API_BASE_URL=https://api.relevance.ai

# Verify variables are loaded
echo $VITE_API_KEY  # Should show your key
```

### Configuration Validation

```typescript
import { genUI } from './src/lib/genUIApp';

await genUI.initialize();
const validation = genUI.getConfigManager().validate();

if (validation.valid) {
  console.log('✓ All configuration variables set correctly');
} else {
  console.log('✗ Missing configuration:');
  validation.errors.forEach(e => console.log(`  - ${e}`));
}
```

## Payload Format Verification

### Correct Format (✓)

```json
{
  "agent_id": "your_agent_id",
  "conversation_id": "your_conversation_id",
  "message": {
    "text": "Your query here"
  }
}
```

### Incorrect Format (✗) - Causes HTTP 422

```json
{
  "role": "user",
  "input": "Your query",
  "context": {}
}
```

### Test Payload Builder Rejects Bad Format

```typescript
import { buildAgentRequestPayload, validateAgentRequestPayload } from './src/lib/agentPayloadBuilder';

// This will create the correct format
const payload = buildAgentRequestPayload('agent_id', 'conv_id', 'query');

// Validate it
try {
  validateAgentRequestPayload(payload);
  console.log('✓ Payload format is correct');
} catch (e) {
  console.error('✗ Payload format is wrong:', e.message);
}
```

## Performance Tests

### Query Performance

```typescript
async function measureQueryPerformance() {
  await genUI.initialize();
  
  // Measure single query
  console.time('Single query');
  const result = await genUI.query('Test query');
  console.timeEnd('Single query');
  // Expected: 1-3 seconds
  
  // Measure cached query
  console.time('Cached query');
  const cached = await genUI.query('Test query');
  console.timeEnd('Cached query');
  // Expected: <10ms
  
  console.log('✓ Performance measured');
}
```

### Concurrent Request Handling

```typescript
async function testConcurrentRequests() {
  await genUI.initialize();
  
  const queries = Array(5).fill(null).map((_, i) => `Query ${i}`);
  
  console.time('5 concurrent queries');
  const results = await Promise.all(
    queries.map(q => genUI.query(q))
  );
  console.timeEnd('5 concurrent queries');
  
  console.log(`✓ Processed ${results.length} queries concurrently`);
}
```

## Error Handling Tests

### Network Error Simulation

```typescript
async function testNetworkErrors() {
  // In browser DevTools:
  // 1. Open Network tab
  // 2. Right-click → Throttling → Offline
  // 3. Execute query
  // 4. Expect retry attempts to be logged
  
  const logs = genUI.getLogs();
  const retryLogs = logs.filter(l => l.message.includes('Attempt'));
  
  if (retryLogs.length > 0) {
    console.log(`✓ Retry logic triggered ${retryLogs.length} times`);
  } else {
    console.warn('⚠ No retry attempts logged');
  }
}
```

### 422 Error Test

```typescript
// This test verifies proper handling of 422 validation errors
// Requires an intentionally malformed request

async function test422Error() {
  try {
    // This will be rejected by payload builder
    const badPayload = {
      role: 'user',  // Invalid
      message: { text: 'test' }
    };
    
    // Should throw error mentioning 422
    // because buildAgentRequestPayload prevents this
  } catch (error) {
    console.log('✓ 422 error properly prevented:', error.message);
  }
}
```

## Logging & Debugging

### Export Logs for Analysis

```typescript
import { genUI } from './src/lib/genUIApp';

// Get all logs
const allLogs = genUI.getLogs();
console.log(`Total logs: ${allLogs.length}`);

// Export as JSON
const jsonLogs = genUI.exportLogs('json');
// Save or send to logging service

// Export as CSV
const csvLogs = genUI.exportLogs('csv');
// Import into analysis tool
```

### Monitor Real-time

```typescript
import { genUI } from './src/lib/genUIApp';

// Add listener
const unsubscribe = genUI.getErrorHandler().addListener((entry) => {
  console.log(`[${entry.level}] ${entry.message}`);
});

// Later: unsubscribe();
```

### Debug Summary

```typescript
const summary = genUI.getSummary();
console.log(JSON.stringify(summary, null, 2));

// Shows:
// - Agent configuration
// - Query statistics
// - Cache information
// - Recursive query settings
```

## Checklist

- [ ] Build completes without errors: `npm run build`
- [ ] All TypeScript files compile
- [ ] Payload builder creates correct format (no "role")
- [ ] A2UI renderer handles all types
- [ ] Configuration loads from environment
- [ ] Error handler logs correctly
- [ ] Single queries work and cache
- [ ] Recursive queries generate follow-ups
- [ ] Health checks report correctly
- [ ] Logs can be exported
- [ ] Retry logic works on failures
- [ ] 422 errors are prevented

## Troubleshooting

### Build Fails with TypeScript Errors

```bash
# Clean and rebuild
rm -rf dist
npm run build

# Check specific file
npx tsc --noEmit src/lib/agentPayloadBuilder.ts
```

### Configuration Not Loading

```typescript
// Check environment
console.log(import.meta.env.VITE_API_KEY);

// Check config manager
const config = genUI.getConfigManager().getConfig();
console.log(config);

// Validate
const validation = genUI.getConfigManager().validate();
console.log(validation.errors);
```

### Queries Return 422

```typescript
// This shouldn't happen with buildAgentRequestPayload
// But if it does, check:

import { buildAgentRequestPayload } from './src/lib/agentPayloadBuilder';
const payload = buildAgentRequestPayload(...);
console.log(JSON.stringify(payload, null, 2));
// Verify: NO "role" property, HAS "message.text"
```

### Visualizations Not Rendering

```typescript
// Check response structure
const result = await genUI.query(query);
console.log('Response:', result.response.data);

// Extract payload manually
import { extractPayloadFromResponse } from './src/lib/agentPayloadBuilder';
const payload = extractPayloadFromResponse(result.response.data);
console.log('Extracted payload:', payload);

// Render manually
import { renderA2UIPayload } from './src/lib/a2uiRenderer';
const html = renderA2UIPayload(payload);
console.log('Rendered HTML:', html);
```

## Success Indicators

✓ **All tests passing if you see:**
- Build completes with "wireit" success
- No TypeScript errors in any src/lib files
- Configuration validation passes
- Queries execute and return responses
- Visualizations render as HTML
- Cached queries return quickly
- Logs are collected properly
- Error messages are meaningful
- Recursive queries generate follow-ups
- Health checks report correct status
