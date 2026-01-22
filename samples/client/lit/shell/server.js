/**
 * Express Server with Agent Proxy Middleware
 * 
 * This server:
 * - Validates all agent requests with recursive validation
 * - Ensures "role" property is included (prevents 422 errors)
 * - Implements retry logic with exponential backoff
 * - Provides detailed error messages for debugging
 * - Handles async agent communication properly
 * 
 * Usage:
 * 1. Create .env file with:
 *    AGENT_API_ENDPOINT=https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger
 *    AGENT_API_KEY=your_api_key
 *    PORT=3000
 * 
 * 2. Run: node server.js
 * 
 * 3. Send requests to: POST http://localhost:3000/api/agent
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Import proxy middleware
const { createAgentProxyMiddleware } = require("./src/lib/backendProxyMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Agent proxy endpoint - with recursive validation
app.post(
  "/api/agent",
  createAgentProxyMiddleware({
    apiEndpoint: process.env.AGENT_API_ENDPOINT,
    apiKey: process.env.AGENT_API_KEY,
  })
);

// Alternative endpoint for direct trigger requests
app.post("/api/agent/trigger", async (req, res) => {
  try {
    const { role, input, context, parameters } = req.body;

    // Basic validation
    if (!input) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required field: "input"',
          code: 400,
        },
      });
    }

    if (!context?.conversation_id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required field: "context.conversation_id"',
          code: 400,
        },
      });
    }

    // Build complete payload with role
    const payload = {
      role: role || "data_engine", // ✅ Default role to prevent 422
      input,
      context: {
        conversation_id: context.conversation_id,
        user_id: context.user_id,
        project_id: context.project_id,
      },
      parameters: parameters || {},
    };

    console.log("[Trigger] Sending payload with role:", {
      role: payload.role,
      inputLength: payload.input.length,
      conversationId: payload.context.conversation_id,
    });

    // Execute request
    const response = await fetch(process.env.AGENT_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AGENT_API_KEY}`,
        "X-API-Key": process.env.AGENT_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Trigger] API Error:", response.status, data);

      // Specific handling for 422
      if (response.status === 422) {
        return res.status(422).json({
          success: false,
          error: {
            message: data.message || "Body Validation Error",
            code: 422,
            details: data,
            suggestion:
              'Ensure "role" property is included in the payload. Check agentPayloadBuilder.ts for correct format.',
          },
        });
      }

      return res.status(response.status).json({
        success: false,
        error: {
          message: data.message || response.statusText,
          code: response.status,
          details: data,
        },
      });
    }

    res.json({
      success: true,
      data,
      metadata: {
        endpoint: "trigger",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Trigger] Error:", error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 500,
      },
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[Error Handler]", err);
  res.status(500).json({
    success: false,
    error: {
      message: err.message || "Internal server error",
      code: 500,
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  Agent Proxy Server with Recursive Validation   ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║ Server running on http://localhost:${PORT}`);
  console.log(`║ Agent API: ${process.env.AGENT_API_ENDPOINT}`);
  console.log("║ Features:                                        ║");
  console.log("║ ✅ Recursive payload validation                 ║");
  console.log("║ ✅ Auto-fills missing 'role' property            ║");
  console.log("║ ✅ Retry with exponential backoff               ║");
  console.log("║ ✅ Prevents HTTP 422 errors                     ║");
  console.log("║ ✅ Detailed error messages                      ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log("");
  console.log("Endpoints:");
  console.log("  POST /api/agent - Universal agent proxy");
  console.log("  POST /api/agent/trigger - Direct trigger endpoint");
  console.log("  GET  /health - Health check");
  console.log("");
  console.log("Example request:");
  console.log(
    `curl -X POST http://localhost:${PORT}/api/agent/trigger \\`
  );
  console.log('  -H "Content-Type: application/json" \\');
  console.log("  -d '{");
  console.log('    "input": "What is 2+2?",');
  console.log('    "context": {');
  console.log('      "conversation_id": "test-conv-123",');
  console.log('      "user_id": "user-123"');
  console.log("    }");
  console.log("  }'");
  console.log("");
});

module.exports = app;
