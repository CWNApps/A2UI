# How Relevance Tool Results Render as A2UI Components

## Quick Overview

When a Relevance tool returns data, the frontend now automatically converts it to proper A2UI components instead of rendering blank or showing raw JSON.

## Flow Diagram

```
Tool returns JSON payload
        ↓
toA2uiMessagesFromRelevance() detects type
        ↓
Based on component/visualization_type:
├─ "table"    → Build Row/Column layout with data rows
├─ "metric"   → Display value with unit
├─ "chart"    → Render as key:value rows
├─ "graph"    → Show node/edge count
└─ (other)    → Format as pretty JSON
        ↓
Build components with unique IDs
        ↓
Return 2 A2UI messages:
├─ surfaceUpdate (with all components list)
└─ beginRendering (with root reference)
        ↓
Browser renders the UI
```

## Example: Table Rendering

### Input Payload
```json
{
  "component": "table",
  "title": "Restaurants",
  "data": {
    "rows": [
      { "name": "Luigi's", "rating": 4.8, "price": "$$" },
      { "name": "Olive Garden", "rating": 4.2, "price": "$$" }
    ]
  }
}
```

### Generated A2UI Components
```
root (Column)
├─ content_column_1 (Column)
│  ├─ title_2 (Text: "Restaurants")
│  └─ table_card_3 (Card)
│     └─ table_body_4 (Column)
│        ├─ table_header_row_5 (Row)
│        │  ├─ header_cell_6 (Text: "name")
│        │  ├─ header_cell_7 (Text: "rating")
│        │  └─ header_cell_8 (Text: "price")
│        ├─ table_row_9 (Row)
│        │  ├─ table_cell_10 (Text: "Luigi's")
│        │  ├─ table_cell_11 (Text: "4.8")
│        │  └─ table_cell_12 (Text: "$$")
│        └─ table_row_13 (Row)
│           ├─ table_cell_14 (Text: "Olive Garden")
│           ├─ table_cell_15 (Text: "4.2")
│           └─ table_cell_16 (Text: "$$")
```

### Generated Messages

**Message 1: surfaceUpdate**
```json
{
  "surfaceUpdate": {
    "surfaceId": "@default",
    "components": [
      { "id": "root", "component": { "Column": { "children": ["content_column_1"] } } },
      { "id": "content_column_1", "component": { "Column": { "children": ["title_2", "table_card_3"] } } },
      { "id": "title_2", "component": { "Text": { "text": { "literalString": "Restaurants" }, "usageHint": "heading" } } },
      { "id": "table_card_3", "component": { "Card": { "children": ["table_body_4"] } } },
      // ... all other components
    ]
  }
}
```

**Message 2: beginRendering**
```json
{
  "beginRendering": {
    "surfaceId": "@default",
    "root": "root"
  }
}
```

## Component Type Detection

The function checks these fields (in order):

1. **Table**: `component === "table"` OR `visualization_type === "table"` OR `data.rows` exists and is an array
2. **Metric**: `component === "metric"` OR `visualization_type === "metric"`
3. **Chart**: `component === "chart"` OR `visualization_type === "chart"`
4. **Graph**: `component === "graph"` OR `visualization_type === "graph"`
5. **Fallback**: Render as formatted JSON (for any other type)

## Empty Data Handling

When a table has no rows:

```
✗ Old behavior: Blank screen
✓ New behavior:
  - Title: "Tool Result"
  - Message: "No rows returned. This is normal if the tool was called without data."
  - Debug: Raw payload JSON (up to 2,000 chars)
```

## Payload Truncation

If a payload is larger than 2,000 characters, it's truncated with `... (truncated)` appended. This prevents the UI from rendering massive amounts of text.

## Standard Components Used

All rendering uses only A2UI standard catalog components:

- **Column**: Vertical layout
- **Row**: Horizontal layout
- **Text**: Text content with optional styling hint
- **Card**: Visual grouping/container
- (No custom components, no Table component that doesn't exist in standard catalog)

## Error Handling

If the tool call fails:

```typescript
// Error message always rendered as visible Text
return [{
  beginRendering: {
    surfaceId: "@default",
    root: "root",
    components: [
      { id: "root", component: { Column: { children: ["error-text-id"] } } },
      { id: "error-text-id", component: { Text: { text: { literalString: "Error: {message}" } } } }
    ]
  }
}];
```

Result: **Never blank**, always shows error.

## Console Logging

Track the rendering process:

```
[RelevanceAgent] Triggering tool with params: { message: "..." }
[Relevance Tool] Triggering async tool...
[Relevance Tool] Job started: job_abc123
[Relevance Tool] Polling... (0s, attempt #1)
[Relevance Tool] ✓ Complete. Extracted output: { component: "table", ... }
[RelevanceAgent] ✓ Tool output received: ...
[RelevanceAgent] Rendered A2UI messages with 2 message(s)
```

## Testing in Browser

### For Tables
1. Set `serverUrl = ""` in shell config
2. Submit text: `{"message": "show restaurants as table"}`
3. Verify:
   - Title appears at top
   - Header row with column names
   - Data rows in table layout
   - No blank screen

### For Empty Data
1. Submit query that returns empty rows
2. Verify:
   - "No rows returned..." message shows
   - Raw payload visible for debugging
   - No blank screen

### For Other Types
1. Submit query that returns `{ component: "metric", value: 42, unit: "units" }`
2. Verify metric displays: "42 units"

### A2UI Protocol Check
1. Open browser DevTools → Console
2. Submit tool call
3. Verify message: `[RelevanceAgent] Rendered A2UI messages with 2 message(s)`
4. Verify UI renders (not blank)

## Key Differences from Old Implementation

| Aspect | Old | New |
|--------|-----|-----|
| Message Format | `beginRendering` with embedded components | `surfaceUpdate` + `beginRendering` |
| Component Type Detection | None (all JSON strings) | Detects table/metric/chart/graph |
| Table Rendering | Raw JSON text | Row/Column/Text layout |
| Empty Data | Blank screen | Friendly message + debug info |
| Payload Size | No limit | Truncated at 2k chars |
| Always Visible | No (could be blank) | Yes (always has title) |

## Non-Breaking

This fix:
- ✅ Uses only standard A2UI components (no new component types required)
- ✅ Maintains backward compatibility (string payloads still work)
- ✅ Doesn't change polling logic or env var reading
- ✅ No new dependencies
- ✅ Can be deployed immediately
