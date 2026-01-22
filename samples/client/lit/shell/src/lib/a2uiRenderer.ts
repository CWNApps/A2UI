/**
 * A2UI Visualization Renderer
 * 
 * Handles rendering of A2UI payloads including:
 * - Tables
 * - Charts
 * - Metrics
 * - Mixed/Composite visualizations
 * - Lists and text content
 */

export interface TableData {
  rows: Array<Record<string, any>>;
  columns?: string[];
  title?: string;
  metadata?: Record<string, any>;
}

export interface ChartData {
  type: "bar" | "line" | "pie" | "scatter" | "area";
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }>;
  };
  title?: string;
  options?: Record<string, any>;
}

export interface MetricData {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: number;
}

export interface A2UIPayload {
  component?: string;
  visualization_type?: string;
  ui_type?: string;
  title?: string;
  data?: {
    rows?: Array<Record<string, any>>;
    values?: any[];
    labels?: string[];
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

/**
 * Renders a table from A2UI payload
 */
export function renderTable(payload: any): string {
  if (!payload || !payload.data?.rows || !Array.isArray(payload.data.rows)) {
    return "<p>No table data available</p>";
  }

  const rows = payload.data.rows as Array<Record<string, any>>;
  if (rows.length === 0) {
    return "<p>Table has no rows</p>";
  }

  const columns = Object.keys(rows[0]);
  const title = payload.title || "Table";

  let html = `<div class="a2ui-table-container">`;
  html += `<h3>${escapeHtml(title)}</h3>`;
  html += `<table class="a2ui-table">`;
  html += `<thead><tr>`;

  // Header row
  columns.forEach((col) => {
    html += `<th>${escapeHtml(col)}</th>`;
  });
  html += `</tr></thead>`;

  // Body rows (limit to 100 for performance)
  html += `<tbody>`;
  const maxRows = Math.min(rows.length, 100);
  for (let i = 0; i < maxRows; i++) {
    const row = rows[i];
    html += `<tr>`;
    columns.forEach((col) => {
      const value = row[col];
      const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      html += `<td>${escapeHtml(displayValue)}</td>`;
    });
    html += `</tr>`;
  }
  html += `</tbody>`;
  html += `</table>`;

  if (rows.length > 100) {
    html += `<p class="a2ui-table-note">Showing 100 of ${rows.length} rows</p>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Renders a metric from A2UI payload
 */
export function renderMetric(payload: any): string {
  const value = payload.value ?? payload.metric ?? "N/A";
  const label = payload.label ?? "Metric";
  const unit = payload.unit ?? "";
  const trend = payload.trend ?? null;
  const trendValue = payload.trendValue ?? null;

  let html = `<div class="a2ui-metric">`;
  html += `<div class="a2ui-metric-label">${escapeHtml(label)}</div>`;
  html += `<div class="a2ui-metric-value">`;
  html += `${escapeHtml(String(value))}`;
  if (unit) {
    html += ` <span class="a2ui-metric-unit">${escapeHtml(unit)}</span>`;
  }
  html += `</div>`;

  if (trend && trendValue) {
    const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
    const trendClass = `a2ui-metric-trend a2ui-metric-trend-${trend}`;
    html += `<div class="${trendClass}">${trendIcon} ${trendValue}%</div>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Renders a list from A2UI payload
 */
export function renderList(payload: any): string {
  const items = payload.data?.values || payload.items || [];

  if (!Array.isArray(items) || items.length === 0) {
    return "<p>No list items available</p>";
  }

  let html = `<div class="a2ui-list-container">`;
  html += `<ul class="a2ui-list">`;

  items.forEach((item) => {
    const displayValue = typeof item === "object" ? JSON.stringify(item) : String(item ?? "");
    html += `<li>${escapeHtml(displayValue)}</li>`;
  });

  html += `</ul>`;
  html += `</div>`;
  return html;
}

/**
 * Renders mixed/composite visualization
 */
export function renderMixed(payload: any): string {
  const components = payload.data?.components || payload.components || [];

  if (!Array.isArray(components) || components.length === 0) {
    return "<p>No composite components available</p>";
  }

  let html = `<div class="a2ui-mixed-container">`;

  components.forEach((component, idx) => {
    html += `<div class="a2ui-component" data-index="${idx}">`;

    if (component.ui_type === "table" || component.component === "table") {
      html += renderTable(component);
    } else if (component.ui_type === "metric" || component.component === "metric") {
      html += renderMetric(component);
    } else if (component.ui_type === "list" || component.component === "list") {
      html += renderList(component);
    } else if (component.ui_type === "text") {
      html += `<div class="a2ui-text-component">${escapeHtml(component.text || "")}</div>`;
    } else {
      html += `<pre>${escapeHtml(JSON.stringify(component, null, 2))}</pre>`;
    }

    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

/**
 * Main render function - dispatches to appropriate renderer
 */
export function renderA2UIPayload(payload: any): string {
  if (!payload || typeof payload !== "object") {
    return `<div class="a2ui-error">Invalid payload</div>`;
  }

  const componentType = payload.component || payload.visualization_type || payload.ui_type;

  let html = "";

  // Add title if present
  if (payload.title) {
    html += `<h2 class="a2ui-title">${escapeHtml(payload.title)}</h2>`;
  }

  // Dispatch to appropriate renderer
  if (componentType === "table" || (payload.data?.rows && Array.isArray(payload.data.rows))) {
    html += renderTable(payload);
  } else if (componentType === "metric") {
    html += renderMetric(payload);
  } else if (componentType === "chart") {
    html += renderChart(payload);
  } else if (componentType === "list") {
    html += renderList(payload);
  } else if (componentType === "mixed" || Array.isArray(payload.components)) {
    html += renderMixed(payload);
  } else if (typeof payload === "string") {
    html += `<div class="a2ui-text">${escapeHtml(payload)}</div>`;
  } else {
    // Fallback: render as JSON
    html += `<pre class="a2ui-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  }

  return html;
}

/**
 * Renders a chart (basic structure - integrate with Chart.js or D3 for full functionality)
 */
export function renderChart(payload: any): string {
  const title = payload.title || "Chart";
  const chartType = payload.type || "bar";

  // This is a simplified version - in production, you'd integrate Chart.js or similar
  let html = `<div class="a2ui-chart-container">`;
  html += `<h3>${escapeHtml(title)}</h3>`;
  html += `<div class="a2ui-chart" data-type="${escapeHtml(chartType)}">`;

  if (payload.data?.labels && payload.data?.datasets) {
    const labels = payload.data.labels;
    const datasets = payload.data.datasets;

    html += `<p>Chart Data:</p>`;
    html += `<ul>`;
    datasets.forEach((dataset) => {
      html += `<li>${escapeHtml(dataset.label)}: ${dataset.data.join(", ")}</li>`;
    });
    html += `</ul>`;
  } else {
    html += `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  }

  html += `</div>`;
  html += `</div>`;
  return html;
}

/**
 * Helper: escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * CSS styles for A2UI components
 */
export const A2UI_STYLES = `
  .a2ui-table-container {
    margin: 20px 0;
    overflow-x: auto;
  }

  .a2ui-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .a2ui-table thead {
    background-color: #f5f5f5;
    font-weight: bold;
  }

  .a2ui-table th,
  .a2ui-table td {
    padding: 10px;
    border: 1px solid #ddd;
    text-align: left;
  }

  .a2ui-table tbody tr:hover {
    background-color: #f9f9f9;
  }

  .a2ui-table-note {
    color: #666;
    font-size: 12px;
    margin-top: 10px;
  }

  .a2ui-metric {
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    text-align: center;
    background-color: #fafafa;
    margin: 20px 0;
  }

  .a2ui-metric-label {
    font-size: 12px;
    color: #666;
    margin-bottom: 5px;
  }

  .a2ui-metric-value {
    font-size: 32px;
    font-weight: bold;
    color: #333;
  }

  .a2ui-metric-unit {
    font-size: 18px;
    color: #999;
  }

  .a2ui-metric-trend {
    font-size: 14px;
    margin-top: 10px;
    padding: 5px;
    border-radius: 4px;
  }

  .a2ui-metric-trend-up {
    color: green;
    background-color: #e8f5e9;
  }

  .a2ui-metric-trend-down {
    color: red;
    background-color: #ffebee;
  }

  .a2ui-metric-trend-neutral {
    color: #999;
    background-color: #f5f5f5;
  }

  .a2ui-list-container {
    margin: 20px 0;
  }

  .a2ui-list {
    list-style-position: inside;
    padding: 0;
  }

  .a2ui-list li {
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }

  .a2ui-chart-container {
    margin: 20px 0;
  }

  .a2ui-chart {
    padding: 20px;
    background-color: #fafafa;
    border: 1px solid #ddd;
    border-radius: 8px;
  }

  .a2ui-text-component,
  .a2ui-text {
    padding: 20px;
    background-color: #f9f9f9;
    border-left: 4px solid #007bff;
    margin: 20px 0;
  }

  .a2ui-json {
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    padding: 10px;
    overflow-x: auto;
    border-radius: 4px;
  }

  .a2ui-error {
    color: #d32f2f;
    padding: 20px;
    background-color: #ffebee;
    border-left: 4px solid #d32f2f;
    margin: 20px 0;
  }

  .a2ui-mixed-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 20px;
  }

  .a2ui-component {
    background-color: white;
    padding: 20px;
    border: 1px solid #eee;
    border-radius: 8px;
  }

  .a2ui-title {
    color: #333;
    border-bottom: 2px solid #007bff;
    padding-bottom: 10px;
    margin: 20px 0;
  }
`;
