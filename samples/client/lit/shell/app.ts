/// <reference types="vite/client" />
/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import {
  LitElement,
  html,
  css,
  nothing,
  HTMLTemplateResult,
  unsafeCSS,
} from "lit";
import { customElement, state } from "lit/decorators.js";
import { theme as uiTheme } from "./theme/default-theme.js";
import { A2UIClient } from "./client.js";
import {
  SnackbarAction,
  SnackbarMessage,
  SnackbarUUID,
  SnackType,
} from "./types/types.js";
import { type Snackbar } from "./ui/snackbar.js";
import { repeat } from "lit/directives/repeat.js";
import { v0_8 } from "@a2ui/lit";
import * as UI from "@a2ui/lit/ui";

// App elements.
import "./ui/ui.js";

// Configurations
import { AppConfig } from "./configs/types.js";
import { config as restaurantConfig } from "./configs/restaurant.js";
import { config as contactsConfig } from "./configs/contacts.js";
import { styleMap } from "lit/directives/style-map.js";

// Import Relevance AI helpers
import {
  getRelevanceConfig,
  validateRelevanceConfig,
  type RelevanceConfig,
} from "./src/lib/env";
import {
  triggerAndPollTool,
  parseToolParams,
} from "./src/lib/relevanceTool";

/**
 * Converts a Relevance payload to proper A2UI ServerToClient messages.
 * Handles tables, metrics, charts, and generic JSON.
 * Always returns valid A2UI with surfaceUpdate + beginRendering.
 * Never renders blank - always shows at least a title.
 */
function toA2uiMessagesFromRelevance(
  payload: any,
  title: string = "Tool Result"
): v0_8.Types.ServerToClientMessage[] {
  const components: any[] = [];
  let componentIds: string[] = [];
  let contentChildren: string[] = [];

  // Helper to generate unique component ID
  let idCounter = 0;
  const genId = (prefix: string) => `${prefix}_${++idCounter}`;

  // Helper to add a component to the list
  const addComponent = (id: string, component: any) => {
    components.push({ id, component });
    return id;
  };

  // === TITLE (always present) ===
  const titleId = genId("title");
  addComponent(titleId, {
    Text: {
      text: { literalString: payload?.title || title },
      usageHint: "heading",
    },
  });
  contentChildren.push(titleId);

  // === PAYLOAD TYPE DETECTION ===
  const isTable =
    payload?.component === "table" ||
    payload?.visualization_type === "table" ||
    (payload?.data?.rows && Array.isArray(payload.data.rows));

  const isMetric =
    payload?.component === "metric" ||
    payload?.visualization_type === "metric";

  const isChart =
    payload?.component === "chart" ||
    payload?.visualization_type === "chart";

  const isGraph =
    payload?.component === "graph" ||
    payload?.visualization_type === "graph";

  // === TABLE RENDERING ===
  if (isTable) {
    const rows: any[] = payload?.data?.rows || [];
    
    if (rows.length === 0) {
      // Empty table: show friendly message + raw payload
      const emptyMsgId = genId("empty_msg");
      addComponent(emptyMsgId, {
        Text: {
          text: { literalString: "No rows returned. This is normal if the tool was called without data." },
          usageHint: "body",
        },
      });
      contentChildren.push(emptyMsgId);

      // Show raw payload for debugging
      if (payload && Object.keys(payload).length > 0) {
        const debugPayload = JSON.stringify(payload, null, 2);
        const truncated = debugPayload.length > 2000
          ? debugPayload.substring(0, 2000) + "\n... (truncated)"
          : debugPayload;

        const debugId = genId("debug_payload");
        addComponent(debugId, {
          Text: {
            text: { literalString: `Raw payload:\n${truncated}` },
            usageHint: "code",
          },
        });
        contentChildren.push(debugId);
      }
    } else {
      // Build table-like layout using Row + Column + Text
      const tableId = genId("table_card");
      const tableBodyId = genId("table_body");
      const tableRowIds: string[] = [];

      // Extract header keys
      const firstRow = rows[0] || {};
      const headerKeys = Object.keys(firstRow).length > 0 ? Object.keys(firstRow) : ["message"];

      // Header row
      const headerRowId = genId("table_header_row");
      const headerCellIds: string[] = [];
      for (const key of headerKeys) {
        const cellId = genId("header_cell");
        addComponent(cellId, {
          Text: {
            text: { literalString: key },
            usageHint: "heading",
          },
        });
        headerCellIds.push(cellId);
      }
      addComponent(headerRowId, {
        Row: { children: headerCellIds },
      });
      tableRowIds.push(headerRowId);

      // Data rows (max 50 to avoid overwhelming UI)
      const maxRows = Math.min(rows.length, 50);
      for (let i = 0; i < maxRows; i++) {
        const row = rows[i];
        const rowId = genId("table_row");
        const cellIds: string[] = [];

        for (const key of headerKeys) {
          const value = row[key];
          const cellId = genId("table_cell");
          const cellText =
            typeof value === "object"
              ? JSON.stringify(value)
              : String(value ?? "");
          addComponent(cellId, {
            Text: {
              text: { literalString: cellText },
              usageHint: "body",
            },
          });
          cellIds.push(cellId);
        }

        addComponent(rowId, { Row: { children: cellIds } });
        tableRowIds.push(rowId);
      }

      // Wrap table in Card + Column
      addComponent(tableBodyId, { Column: { children: tableRowIds } });
      addComponent(tableId, {
        Card: {
          children: [tableBodyId],
        },
      });
      contentChildren.push(tableId);

      // Show row count
      if (rows.length > maxRows) {
        const countId = genId("row_count");
        addComponent(countId, {
          Text: {
            text: { literalString: `Showing ${maxRows} of ${rows.length} rows` },
            usageHint: "hint",
          },
        });
        contentChildren.push(countId);
      }
    }
  }
  // === METRIC RENDERING ===
  else if (isMetric) {
    const metricId = genId("metric_value");
    const value = payload?.value ?? payload?.metric ?? "N/A";
    const unit = payload?.unit ? ` ${payload.unit}` : "";
    addComponent(metricId, {
      Text: {
        text: { literalString: `${value}${unit}` },
        usageHint: "heading",
      },
    });
    contentChildren.push(metricId);
  }
  // === CHART RENDERING ===
  else if (isChart) {
    const data = payload?.data || {};
    if (typeof data === "object" && Object.keys(data).length > 0) {
      // Render as key:value rows
      const rowIds: string[] = [];
      for (const [key, val] of Object.entries(data)) {
        const rowId = genId("chart_row");
        const keyId = genId("chart_key");
        const valId = genId("chart_val");

        addComponent(keyId, {
          Text: { text: { literalString: key }, usageHint: "body" },
        });
        addComponent(valId, {
          Text: { text: { literalString: String(val) }, usageHint: "body" },
        });
        addComponent(rowId, { Row: { children: [keyId, valId] } });
        rowIds.push(rowId);
      }

      if (rowIds.length > 0) {
        const chartId = genId("chart_col");
        addComponent(chartId, { Column: { children: rowIds } });
        contentChildren.push(chartId);
      }
    }
  }
  // === GRAPH RENDERING ===
  else if (isGraph) {
    const nodes = payload?.nodes || [];
    const edges = payload?.edges || [];
    const summaryId = genId("graph_summary");
    addComponent(summaryId, {
      Text: {
        text: { literalString: `Graph: ${nodes.length} nodes, ${edges.length} edges` },
        usageHint: "body",
      },
    });
    contentChildren.push(summaryId);
  }
  // === FALLBACK: RAW PAYLOAD AS TEXT ===
  else {
    let displayText = "";
    if (typeof payload === "string") {
      displayText = payload;
    } else if (payload && typeof payload === "object") {
      displayText = JSON.stringify(payload, null, 2);
    } else {
      displayText = String(payload || "No data");
    }

    // Truncate if too long
    if (displayText.length > 2000) {
      displayText = displayText.substring(0, 2000) + "\n... (truncated)";
    }

    const payloadId = genId("payload_text");
    addComponent(payloadId, {
      Text: {
        text: { literalString: displayText },
        usageHint: "body",
      },
    });
    contentChildren.push(payloadId);
  }

  // === BUILD ROOT CONTAINER ===
  const rootId = "root";
  const contentId = genId("content_column");
  addComponent(contentId, { Column: { children: contentChildren } });
  addComponent(rootId, {
    Column: {
      children: [contentId],
    },
  });

  // === BUILD COMPONENT ADJACENCY LIST (surfaceUpdate format) ===
  // Each component includes its children inline as part of the component definition
  // This is the flat list format expected by A2UI protocol
  const componentList = components.map((c) => ({
    id: c.id,
    component: c.component,
  }));

  // === RETURN A2UI MESSAGES (proper ordering) ===
  const messages: v0_8.Types.ServerToClientMessage[] = [
    // First: surfaceUpdate with all components
    {
      surfaceUpdate: {
        surfaceId: "@default",
        components: componentList,
      } as any,
    },
    // Second: beginRendering to signal ready
    {
      beginRendering: {
        surfaceId: "@default",
        root: rootId,
      } as any,
    },
  ];

  return messages;
}

/**
 * RelevanceAgent - Wrapper for Relevance Tools API
 * Returns A2UI protocol messages
 * Supports both simple mode ({ message: "..." }) and advanced mode (JSON objects)
 */
class rh {
  #config: RelevanceConfig | null = null;
  #envError: string | null = null;

  constructor() {
    // Check for environment variable errors during init
    const config = getRelevanceConfig();
    const missing = validateRelevanceConfig(config);
    if (missing.length > 0) {
      this.#envError = `Missing env vars: ${missing.join(", ")}. Set these in your environment and redeploy.`;
      console.error("[RelevanceAgent]", this.#envError);
    } else {
      this.#config = config;
    }
  }

  async send(t: string): Promise<v0_8.Types.ServerToClientMessage[]> {
    try {
      // Read env vars
      const stackBase = import.meta.env.VITE_RELEVANCE_STACK_BASE;
      const projectId = import.meta.env.VITE_RELEVANCE_PROJECT_ID;
      const apiKey = import.meta.env.VITE_RELEVANCE_API_KEY;
      const toolId = import.meta.env.VITE_RELEVANCE_TOOL_ID;
      const authHeader = `${projectId}:${apiKey}`;

      // Validate env vars
      if (!stackBase || !projectId || !apiKey || !toolId) {
        const missing = [
          !stackBase && "VITE_RELEVANCE_STACK_BASE",
          !projectId && "VITE_RELEVANCE_PROJECT_ID",
          !apiKey && "VITE_RELEVANCE_API_KEY",
          !toolId && "VITE_RELEVANCE_TOOL_ID",
        ]
          .filter(Boolean)
          .join(", ");
        throw new Error(`Missing env vars: ${missing}`);
      }

      // 1. Trigger tool
      const triggerUrl = `${stackBase}/latest/studios/tools/trigger_async`;
      const triggerBody = {
        tool_id: toolId,
        params: { message: t },
      };
      console.log("[RelevanceAgent] Triggering tool at:", triggerUrl);
      const triggerResp = await fetch(triggerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(triggerBody),
      });

      if (!triggerResp.ok) {
        throw new Error(`Trigger failed: ${triggerResp.status} ${triggerResp.statusText}`);
      }

      const triggerJson = await triggerResp.json();
      console.log("[RelevanceAgent] Trigger response:", triggerJson);

      const jobId = triggerJson.job_id || triggerJson.id;
      if (!jobId) {
        throw new Error("No job_id returned from trigger.");
      }
      console.log("[RelevanceAgent] Job ID:", jobId);

      // 2. Poll job until complete
      let jobComplete = false;
      let jobRespJson: any = null;
      const jobUrl = `${stackBase}/latest/studios/jobs/${jobId}?ending_update_only=true`;
      const maxWaitMs = 60000; // 60 second timeout
      const startTime = Date.now();

      while (!jobComplete && Date.now() - startTime < maxWaitMs) {
        const jobResp = await fetch(jobUrl, {
          method: "GET",
          headers: {
            Authorization: authHeader,
          },
        });

        if (!jobResp.ok) {
          throw new Error(`Poll failed: ${jobResp.status} ${jobResp.statusText}`);
        }

        jobRespJson = await jobResp.json();

        // Check for completion
        if (
          jobRespJson.type === "complete" ||
          jobRespJson.status === "complete" ||
          (jobRespJson.completed && (jobRespJson.completed.type === "complete" || jobRespJson.completed.status === "complete"))
        ) {
          jobComplete = true;
          console.log("[RelevanceAgent] Completion detected.");
        } else {
          // Wait before next poll
          await new Promise((res) => setTimeout(res, 1000));
        }
      }

      if (!jobComplete) {
        throw new Error("Job polling timed out after 60 seconds.");
      }

      // 3. Extract payload
      let payload: any = undefined;
      if (jobRespJson.completed?.output?.transformed?.payload) {
        payload = jobRespJson.completed.output.transformed.payload;
      } else if (
        jobRespJson.completed?.updates &&
        Array.isArray(jobRespJson.completed.updates) &&
        jobRespJson.completed.updates.length > 0
      ) {
        const lastUpdate = jobRespJson.completed.updates[jobRespJson.completed.updates.length - 1];
        if (lastUpdate?.output?.transformed?.payload) {
          payload = lastUpdate.output.transformed.payload;
        }
      }

      if (!payload) {
        payload = jobRespJson.completed || jobRespJson;
      }

      console.log("[RelevanceAgent] Extracted payload:", payload);

      // 4. Build A2UI components
      const components: any[] = [];
      let componentId = 0;
      const genId = (prefix: string) => `${prefix}_${++componentId}`;

      // Title
      const titleText =
        payload?.title || payload?.dashboard_title || "Dashboard";
      const titleId = genId("title");
      components.push({
        id: titleId,
        component: {
          Text: {
            text: { literalString: titleText },
            usageHint: "heading",
          },
        },
      });

      // Body
      let bodyId: string;
      if (
        !payload ||
        !payload.data ||
        !Array.isArray(payload.data.rows) ||
        payload.data.rows.length === 0
      ) {
        // No rows: show "No rows returned" message
        bodyId = genId("body_text");
        let text = "No rows returned";
        if (payload?.message) {
          text += `: ${payload.message}`;
        }
        components.push({
          id: bodyId,
          component: {
            Text: {
              text: { literalString: text },
              usageHint: "body",
            },
          },
        });
      } else {
        // Has rows: create Cards for each row
        const cardIds: string[] = [];
        payload.data.rows.forEach((row: any, rowIdx: number) => {
          const cardId = genId(`card_${rowIdx}`);
          const colId = genId(`col_${rowIdx}`);

          // Create Text components for each key-value pair
          const textIds: string[] = [];
          Object.entries(row).forEach(([key, value], textIdx: number) => {
            const textId = genId(`text_${rowIdx}_${textIdx}`);
            textIds.push(textId);
            components.push({
              id: textId,
              component: {
                Text: {
                  text: { literalString: `${key}: ${value}` },
                  usageHint: "body",
                },
              },
            });
          });

          // Create Column for text items
          components.push({
            id: colId,
            component: {
              Column: {
                children: textIds,
              },
            },
          });

          // Create Card wrapping the Column
          components.push({
            id: cardId,
            component: {
              Card: {
                children: [colId],
              },
            },
          });

          cardIds.push(cardId);
        });

        // Create body as Column of Cards
        bodyId = genId("body");
        components.push({
          id: bodyId,
          component: {
            Column: {
              children: cardIds,
            },
          },
        });
      }

      // Root Column
      const rootId = "root";
      components.push({
        id: rootId,
        component: {
          Column: {
            children: [titleId, bodyId],
          },
        },
      });

      console.log("[RelevanceAgent] Component count:", components.length);

      // 5. Return A2UI protocol messages
      return [
        {
          surfaceUpdate: {
            surfaceId: "@default",
            components: components,
          },
        },
        {
          beginRendering: {
            surfaceId: "@default",
            root: "root",
          },
        },
      ] as any;
    } catch (err: any) {
      console.error("[RelevanceAgent] Error in send:", err);
      const errorMsg = err?.message || String(err);
      return [
        {
          surfaceUpdate: {
            surfaceId: "@default",
            components: [
              {
                id: "error",
                component: {
                  Text: {
                    text: { literalString: `Error: ${errorMsg}` },
                    usageHint: "body",
                  },
                },
              },
            ],
          },
        },
        {
          beginRendering: {
            surfaceId: "@default",
            root: "error",
          },
        },
      ] as any;
    }
  }

  #createErrorResponse(message: string): v0_8.Types.ServerToClientMessage[] {
    console.error(`[RelevanceAgent] Error response: ${message}`);
    return [
      {
        beginRendering: {
          surfaceId: "@default",
          root: "root",
          components: [
            {
              id: "root",
              component: {
                Column: {
                  children: ["error-text-id"],
                },
              },
            },
            {
              id: "error-text-id",
              component: {
                Text: {
                  text: { literalString: `Error: ${message}` },
                  usageHint: "body",
                },
              },
            },
          ],
        },
      },
    ] as any;
  }
}

const configs: Record<string, AppConfig> = {
  restaurant: restaurantConfig,
  contacts: contactsConfig,
};

@customElement("a2ui-shell")
export class A2UILayoutEditor extends SignalWatcher(LitElement) {
  @provide({ context: UI.Context.themeContext })
  accessor theme: v0_8.Types.Theme = uiTheme;

  @state()
  accessor #requesting = false;

  @state()
  accessor #error: string | null = null;

  @state()
  accessor #lastMessages: v0_8.Types.ServerToClientMessage[] = [];

  @state()
  accessor config: AppConfig = configs.restaurant;

  @state()
  accessor #loadingTextIndex = 0;
  #loadingInterval: number | undefined;

  static styles = [
    unsafeCSS(v0_8.Styles.structuralStyles),
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        max-width: 640px;
        margin: 0 auto;
        min-height: 100%;
        color: light-dark(var(--n-10), var(--n-90));
        font-family: var(--font-family);
      }

      #hero-img {
        width: 100%;
        max-width: 400px;
        aspect-ratio: 1280/720;
        height: auto;
        margin-bottom: var(--bb-grid-size-6);
        display: block;
        margin: 0 auto;
        background: var(--background-image-light) center center / contain
          no-repeat;
      }

      #surfaces {
        width: 100%;
        max-width: 100svw;
        padding: var(--bb-grid-size-3);
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1) 0.3s backwards;
      }

      form {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 16px;
        align-items: center;
        padding: 16px 0;
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1) 1s backwards;

        & h1 {
          color: light-dark(var(--p-40), var(--n-90));
        }

        & > div {
          display: flex;
          flex: 1;
          gap: 16px;
          align-items: center;
          width: 100%;

          & > input {
            display: block;
            flex: 1;
            border-radius: 32px;
            padding: 16px 24px;
            border: 1px solid var(--p-60);
            background: light-dark(var(--n-100), var(--n-10));
            font-size: 16px;
          }

          & > button {
            display: flex;
            align-items: center;
            background: var(--p-40);
            color: var(--n-100);
            border: none;
            padding: 8px 16px;
            border-radius: 32px;
            opacity: 0.5;

            &:not([disabled]) {
              cursor: pointer;
              opacity: 1;
            }
          }
        }
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      .pending {
        width: 100%;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1) 0.3s backwards;
        gap: 16px;
      }

      .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-left-color: var(--p-60);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .theme-toggle {
        padding: 0;
        margin: 0;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        top: var(--bb-grid-size-3);
        right: var(--bb-grid-size-4);
        background: light-dark(var(--n-100), var(--n-0));
        border-radius: 50%;
        color: var(--p-30);
        cursor: pointer;
        width: 48px;
        height: 48px;
        font-size: 32px;

        & .g-icon {
          pointer-events: none;

          &::before {
            content: "dark_mode";
          }
        }
      }

      @container style(--color-scheme: dark) {
        .theme-toggle .g-icon::before {
          content: "light_mode";
          color: var(--n-90);
        }

        #hero-img {
          background-image: var(--background-image-dark);
        }
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes pulse {
        0% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
        100% {
          opacity: 0.6;
        }
      }

      .error {
        color: var(--e-40);
        background-color: var(--e-95);
        border: 1px solid var(--e-80);
        padding: 16px;
        border-radius: 8px;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  #processor = v0_8.Data.createSignalA2uiMessageProcessor();
  #a2uiClient = new A2UIClient();
  #relevanceAgent = new rh();
  #snackbar: Snackbar | undefined = undefined;
  #pendingSnackbarMessages: Array<{
    message: SnackbarMessage;
    replaceAll: boolean;
  }> = [];

  #maybeRenderError() {
    if (!this.#error) return nothing;

    return html`<div class="error">${this.#error}</div>`;
  }

  connectedCallback() {
    super.connectedCallback();

    // Load config from URL
    const urlParams = new URLSearchParams(window.location.search);
    const appKey = urlParams.get("app") || "restaurant";
    this.config = configs[appKey] || configs.restaurant;

    // Apply the theme directly, which will use the Lit context.
    if (this.config.theme) {
      this.theme = this.config.theme;
    }

    window.document.title = this.config.title;
    window.document.documentElement.style.setProperty(
      "--background",
      this.config.background
    );

    // Initialize client with configured URL
    this.#a2uiClient = new A2UIClient(this.config.serverUrl);
  }

  render() {
    return [
      this.#renderThemeToggle(),
      this.#maybeRenderForm(),
      this.#maybeRenderData(),
      this.#maybeRenderError(),
    ];
  }

  #renderThemeToggle() {
    return html` <div>
      <button
        @click=${(evt: Event) => {
        if (!(evt.target instanceof HTMLButtonElement)) return;
        const { colorScheme } = window.getComputedStyle(evt.target);
        if (colorScheme === "dark") {
          document.body.classList.add("light");
          document.body.classList.remove("dark");
        } else {
          document.body.classList.add("dark");
          document.body.classList.remove("light");
        }
      }}
        class="theme-toggle"
      >
        <span class="g-icon filled-heavy"></span>
      </button>
    </div>`;
  }

  #maybeRenderForm() {
    if (this.#requesting) return nothing;
    if (this.#lastMessages.length > 0) return nothing;

    return html` <form
      @submit=${async (evt: Event) => {
        evt.preventDefault();
        if (!(evt.target instanceof HTMLFormElement)) {
          return;
        }
        const data = new FormData(evt.target);
        const body = data.get("body") ?? null;
        if (!body) {
          return;
        }
        const message = body as v0_8.Types.A2UIClientEventMessage;
        await this.#sendAndProcessMessage(message);
      }}
    >
      ${this.config.heroImage
        ? html`<div
            style=${styleMap({
          "--background-image-light": `url(${this.config.heroImage})`,
          "--background-image-dark": `url(${this.config.heroImageDark ?? this.config.heroImage
            })`,
        })}
            id="hero-img"
          ></div>`
        : nothing}
      <h1 class="app-title">${this.config.title}</h1>
      <div>
        <input
          required
          value="${this.config.placeholder}"
          autocomplete="off"
          id="body"
          name="body"
          type="text"
          ?disabled=${this.#requesting}
        />
        <button type="submit" ?disabled=${this.#requesting}>
          <span class="g-icon filled-heavy">send</span>
        </button>
      </div>
    </form>`;
  }

  #startLoadingAnimation() {
    if (
      Array.isArray(this.config.loadingText) &&
      this.config.loadingText.length > 1
    ) {
      this.#loadingTextIndex = 0;
      this.#loadingInterval = window.setInterval(() => {
        this.#loadingTextIndex =
          (this.#loadingTextIndex + 1) %
          (this.config.loadingText as string[]).length;
      }, 2000);
    }
  }

  #stopLoadingAnimation() {
    if (this.#loadingInterval) {
      clearInterval(this.#loadingInterval);
      this.#loadingInterval = undefined;
    }
  }

  async #sendMessage(
    message: v0_8.Types.A2UIClientEventMessage
  ): Promise<v0_8.Types.ServerToClientMessage[]> {
    try {
      this.#requesting = true;
      this.#startLoadingAnimation();

      let response: v0_8.Types.ServerToClientMessage[];

      // Use rh (Relevance AI Agent) if serverUrl is empty, otherwise use A2UIClient
      if (this.config.serverUrl === "") {
        if (typeof message === "string") {
          response = await this.#relevanceAgent.send(message);
        } else if ("userAction" in message) {
          // For user actions, convert to text message
          response = await this.#relevanceAgent.send(
            JSON.stringify(message.userAction)
          );
        } else {
          response = [];
        }
      } else {
        response = await this.#a2uiClient.send(message);
      }

      this.#requesting = false;
      this.#stopLoadingAnimation();

      return response;
    } catch (err) {
      this.snackbar(err as string, SnackType.ERROR);
    } finally {
      this.#requesting = false;
      this.#stopLoadingAnimation();
    }

    return [];
  }

  #maybeRenderData() {
    if (this.#requesting) {
      let text = "Awaiting an answer...";
      if (this.config.loadingText) {
        if (Array.isArray(this.config.loadingText)) {
          text = this.config.loadingText[this.#loadingTextIndex];
        } else {
          text = this.config.loadingText;
        }
      }

      return html` <div class="pending">
        <div class="spinner"></div>
        <div class="loading-text">${text}</div>
      </div>`;
    }

    const surfaces = this.#processor.getSurfaces();
    if (surfaces.size === 0) {
      return nothing;
    }

    return html`<section id="surfaces">
      ${repeat(
      this.#processor.getSurfaces(),
      ([surfaceId]) => surfaceId,
      ([surfaceId, surface]) => {
        return html`<a2ui-surface
              @a2uiaction=${async (
          evt: v0_8.Events.StateEvent<"a2ui.action">
        ) => {
            const [target] = evt.composedPath();
            if (!(target instanceof HTMLElement)) {
              return;
            }

            const context: v0_8.Types.A2UIClientEventMessage["userAction"]["context"] =
              {};
            if (evt.detail.action.context) {
              const srcContext = evt.detail.action.context;
              for (const item of srcContext) {
                if (item.value.literalBoolean) {
                  context[item.key] = item.value.literalBoolean;
                } else if (item.value.literalNumber) {
                  context[item.key] = item.value.literalNumber;
                } else if (item.value.literalString) {
                  context[item.key] = item.value.literalString;
                } else if (item.value.path) {
                  const path = this.#processor.resolvePath(
                    item.value.path,
                    evt.detail.dataContextPath
                  );
                  const value = this.#processor.getData(
                    evt.detail.sourceComponent,
                    path,
                    surfaceId
                  );
                  context[item.key] = value;
                }
              }
            }

            const message: v0_8.Types.A2UIClientEventMessage = {
              userAction: {
                name: evt.detail.action.name,
                surfaceId,
                sourceComponentId: target.id,
                timestamp: new Date().toISOString(),
                context,
              },
            };

            await this.#sendAndProcessMessage(message);
          }}
              .surfaceId=${surfaceId}
              .surface=${surface}
              .processor=${this.#processor}
            ></a2-uisurface>`;
      }
    )}
    </section>`;
  }

  async #sendAndProcessMessage(request) {
    const messages = await this.#sendMessage(request);

    console.log(messages);

    this.#lastMessages = messages;
    this.#processor.clearSurfaces();
    this.#processor.processMessages(messages);
  }

  snackbar(
    message: string | HTMLTemplateResult,
    type: SnackType,
    actions: SnackbarAction[] = [],
    persistent = false,
    id = globalThis.crypto.randomUUID(),
    replaceAll = false
  ) {
    if (!this.#snackbar) {
      this.#pendingSnackbarMessages.push({
        message: {
          id,
          message,
          type,
          persistent,
          actions,
        },
        replaceAll,
      });
      return;
    }

    return this.#snackbar.show(
      {
        id,
        message,
        type,
        persistent,
        actions,
      },
      replaceAll
    );
  }

  unsnackbar(id?: SnackbarUUID) {
    if (!this.#snackbar) {
      return;
    }

    this.#snackbar.hide(id);
  }
}
