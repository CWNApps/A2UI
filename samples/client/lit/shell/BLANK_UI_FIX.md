# Fix: Blank UI for Relevance Tool Results

## Problem Statement

The Relevance tool integration was working (tool calls succeeded and returned structured data), but the UI remained blank when displaying results. The issue was that Relevance returns complex payloads (tables, metrics, charts, etc.) but the frontend was simply converting them to JSON strings without building proper A2UI components.

### Example Problematic Scenario
```
Tool returns:
{
  "component": "table",
  "title": "Restaurant Dashboard",
  "data": {
    "rows": [
      { "name": "Luigi's", "rating": 4.8, "price": "$$" },
      { "name": "Olive Garden", "rating": 4.2, "price": "$$" }
    ]
  }
}

Old behavior: Rendered as plain JSON text (unreadable)
New behavior: Renders as proper A2UI table with:
  - Title: "Restaurant Dashboard"
  - Column headers: name, rating, price
  - Row data with Text components in Row layout
  - Card wrapper for visual grouping
```

## Root Causes

1. **No Payload Translation Layer**: The tool output was parsed but never converted to A2UI components
2. **No Type Detection**: Code didn't detect that payload had `component: "table"`
3. **Invalid A2UI Message Format**: Was sending `beginRendering` with components embedded, but A2UI protocol requires `surfaceUpdate` first with components list, then `beginRendering` with just root reference
4. **No Fallback for Empty Data**: When tables had no rows, nothing rendered (blank screen)
5. **No Special Handling**: Metrics, charts, and other visualization types were all rendered as raw JSON

## Solution: `toA2uiMessagesFromRelevance()` Function

Created a comprehensive conversion function that:

### 1. Payload Type Detection
- Detects `component` or `visualization_type` field values:
  - `"table"` → Build Row/Column layout with data rows
  - `"metric"` → Show value with unit
  - `"chart"` → Render as key:value rows
  - `"graph"` → Show node/edge count summary
  - Fallback → Render as formatted JSON

### 2. Table Rendering (Standard Components Only)
When `component === "table"` or `data.rows` exists:

```typescript
// Header row
Row {
  children: [
    Text("name"),
    Text("rating"),
    Text("price")
  ]
}

// Data rows (each becomes a Row)
Row {
  children: [
    Text("Luigi's"),
    Text("4.8"),
    Text("$$")
  ]
}

// Wrapped in Card + Column for visual grouping
Column {
  children: [
    Card {
      children: [Column { children: [header_row, data_row_1, data_row_2, ...] }]
    }
  ]
}
```

### 3. Empty Row Handling
When `data.rows` is empty or missing:
- Shows friendly message: "No rows returned. This is normal if the tool was called without data."
- Shows raw payload JSON (truncated to 2k chars) for debugging
- Never shows blank screen

### 4. Metric Rendering
When `component === "metric"`:
```
Text: "{value} {unit}"
e.g., "42 customers" or "1,234.5 USD"
```

### 5. Chart Rendering
When `component === "chart"`:
```
Row layout of key:value pairs
Label: "Revenue"
Value: "$50,000"
```

### 6. Graph Rendering
When `component === "graph"`:
```
Summary: "Graph: 150 nodes, 340 edges"
```

### 7. Proper A2UI Message Ordering
Returns **exactly 2 messages** in correct order:

```typescript
// Message 1: surfaceUpdate with ALL components
{
  surfaceUpdate: {
    surfaceId: "@default",
    components: [
      { id: "root", component: { Column: { children: [...] } } },
      { id: "content_column_1", component: { Column: { children: [...] } } },
      { id: "title_2", component: { Text: { text: { literalString: "..." } } } },
      { id: "table_card_3", component: { Card: { children: [...] } } },
      // ... all components in flat list
    ]
  }
}

// Message 2: beginRendering signals ready (with only surfaceId and root)
{
  beginRendering: {
    surfaceId: "@default",
    root: "root"  // Must be exactly "root" per A2UI spec
  }
}
```

### 8. Always Visible Title
Every response includes a title (either from payload or "Tool Result") to ensure UI is never blank.

## Implementation Changes

### File: `app.ts`

#### Change 1: Added `toA2uiMessagesFromRelevance()` function (300+ lines)
- Location: Before the `rh` class definition
- Purpose: Convert Relevance payload to valid A2UI messages
- Handles: tables, metrics, charts, graphs, and fallback JSON

#### Change 2: Updated `rh.send()` method
**Before:**
```typescript
// Just wrapped output as Text in beginRendering
let outputContent = assistantText;
try { outputContent = JSON.parse(assistantText); } catch {}
const result = [{
  beginRendering: {
    root: "root",
    components: [{
      id: "root",
      component: { Column: { children: ["t1"] } }
    }, {
      id: "t1",
      component: { Text: { text: { literalString: JSON.stringify(outputContent) } } }
    }]
  }
}];
```

**After:**
```typescript
// Parse payload and convert to A2UI messages
let payload: any = null;
try {
  payload = JSON.parse(assistantText);
} catch {
  payload = assistantText;
}
const messages = toA2uiMessagesFromRelevance(payload, "Tool Result");
return messages;  // Returns [surfaceUpdate, beginRendering]
```

## Testing Checklist

### ✅ Table Rendering
- [ ] Submit tool call that returns `{ component: "table", data: { rows: [...] } }`
- [ ] Verify UI shows:
  - Title at top
  - Header row with column names
  - Data rows as Table-like layout
  - Row count if truncated
  - Never blank, never just JSON

### ✅ Empty Table Handling
- [ ] Submit tool call that returns empty rows: `{ component: "table", data: { rows: [] } }`
- [ ] Verify UI shows:
  - Title
  - "No rows returned..." message
  - Raw payload JSON for debugging
  - Never blank

### ✅ Metric Rendering
- [ ] Submit tool call that returns `{ component: "metric", value: 42, unit: "units" }`
- [ ] Verify UI shows value with unit

### ✅ Chart Rendering
- [ ] Submit tool call that returns `{ component: "chart", data: { "Label": "Value" } }`
- [ ] Verify UI renders as key:value rows

### ✅ Graph Rendering
- [ ] Submit tool call that returns `{ component: "graph", nodes: [...], edges: [...] }`
- [ ] Verify UI shows node/edge count

### ✅ Fallback Rendering
- [ ] Submit tool call that returns arbitrary JSON (no component field)
- [ ] Verify UI shows formatted JSON with title

### ✅ A2UI Protocol Compliance
- [ ] Open browser DevTools Network tab
- [ ] Submit tool call
- [ ] Verify console shows:
  - `[RelevanceAgent] Rendered A2UI messages with 2 message(s)`
  - Two messages: surfaceUpdate + beginRendering
- [ ] Verify UI renders (not blank)

### ✅ Error Handling
- [ ] Set an env var to invalid value
- [ ] Submit tool call
- [ ] Verify visible error message appears (not blank)

## Console Logs

The implementation adds helpful console logging:

```
[RelevanceAgent] Triggering tool with params: { message: "show restaurants" }
[Relevance Tool] Triggering async tool... { message: "show restaurants" }
[Relevance Tool] Job started: job_abc123
[Relevance Tool] Polling... (0s, attempt #1)
[Relevance Tool] Polling... (1.5s, attempt #2)
[Relevance Tool] ✓ Complete. Extracted output: {"component":"table","data":{"rows":[...]}}
[RelevanceAgent] ✓ Tool output received: {"component":"table",...}
[RelevanceAgent] Rendered A2UI messages with 2 message(s)
```

## Build Status

✅ TypeScript build passes
```
✅ Ran 1 script and skipped 2 in 2.2s
```

## Deployment

1. Commit the changes:
   ```bash
   git add samples/client/lit/shell/app.ts
   git commit -m "Fix blank UI for Relevance tool results - render as A2UI components"
   ```

2. Push to Vercel:
   ```bash
   git push origin main
   ```

3. Verify in production:
   - Submit a tool call
   - Confirm UI renders table/metric/chart (not blank)
   - Check console for proper A2UI message flow

## Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Table Handling** | Raw JSON text | Proper Row/Column layout |
| **Empty Data** | Blank screen | "No rows" message + debug payload |
| **Metrics** | `{"value": 42}` as text | `42 units` formatted |
| **A2UI Format** | Invalid (components in beginRendering) | Valid (surfaceUpdate first, then beginRendering) |
| **Payload Types** | All treated as text | Detected: table, metric, chart, graph |
| **Visual Grouping** | None | Cards for table wrapping |
| **Truncation** | No | Large payloads truncated at 2k chars |
| **Error Visibility** | Possible blank on error | Always shows error message |

## Non-Breaking Changes

- ✅ Uses only standard A2UI components (Column, Row, Text, Card)
- ✅ Maintains backward compatibility (string payloads render as text)
- ✅ Env var reading unchanged (still uses `import.meta.env`)
- ✅ Polling logic unchanged (still works with Relevance API)
- ✅ No new dependencies added
