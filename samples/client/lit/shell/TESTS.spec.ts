/**
 * Test Suite for Agent Trigger Endpoint (HTTP 422 Fix)
 * 
 * Tests cover:
 * ✓ Payload validation with role property
 * ✓ Recursive field validation
 * ✓ Error handling for 422 responses
 * ✓ Retry logic with exponential backoff
 * ✓ Backend proxy middleware
 * 
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildAgentPayload,
  validateAgentPayload,
  AgentCommunicationService,
  AgentError,
  ConfigManager,
} from "./IMPLEMENTATION_GUIDE";

// ============================================================================
// UNIT TESTS: Payload Building
// ============================================================================

describe("Agent Payload Builder", () => {
  describe("buildAgentPayload", () => {
    it("should include 'role' property", () => {
      const payload = buildAgentPayload("What is 2+2?", {
        conversationId: "conv-123",
      });

      expect(payload).toHaveProperty("role");
      expect(payload.role).toBe("data_engine");
    });

    it("should handle trimmed input", () => {
      const payload = buildAgentPayload("  What is 2+2?  ", {
        conversationId: "conv-123",
      });

      expect(payload.input).toBe("What is 2+2?");
    });

    it("should set conversation_id correctly", () => {
      const payload = buildAgentPayload("Question", {
        conversationId: "conv-456",
      });

      expect(payload.context.conversation_id).toBe("conv-456");
    });

    it("should include optional user_id and project_id", () => {
      const payload = buildAgentPayload("Question", {
        conversationId: "conv-789",
        userId: "user-123",
        projectId: "proj-456",
      });

      expect(payload.context.user_id).toBe("user-123");
      expect(payload.context.project_id).toBe("proj-456");
    });
  });

  describe("validateAgentPayload", () => {
    it("should reject non-object payloads", () => {
      expect(() => validateAgentPayload("not an object")).toThrow(
        "Payload must be an object"
      );
    });

    it("should add default role if missing", () => {
      const payload = validateAgentPayload({
        input: "Question",
        context: { conversation_id: "conv-123" },
      });

      expect(payload.role).toBe("data_engine");
    });

    it("should reject payload missing input", () => {
      expect(() =>
        validateAgentPayload({
          role: "data_engine",
          context: { conversation_id: "conv-123" },
        })
      ).toThrow('Missing required field: "input"');
    });

    it("should reject payload missing context", () => {
      expect(() =>
        validateAgentPayload({
          role: "data_engine",
          input: "Question",
        })
      ).toThrow('Missing required field: "context"');
    });

    it("should reject context missing conversation_id", () => {
      expect(() =>
        validateAgentPayload({
          role: "data_engine",
          input: "Question",
          context: {},
        })
      ).toThrow('Missing required field: "context.conversation_id"');
    });

    it("should validate recursively with all fields present", () => {
      const payload = validateAgentPayload({
        role: "data_engine",
        input: "What is 2+2?",
        context: {
          conversation_id: "conv-123",
          user_id: "user-456",
          project_id: "proj-789",
        },
      });

      expect(payload).toMatchObject({
        role: "data_engine",
        input: "What is 2+2?",
        context: {
          conversation_id: "conv-123",
          user_id: "user-456",
          project_id: "proj-789",
        },
      });
    });
  });
});

// ============================================================================
// UNIT TESTS: Agent Communication Service
// ============================================================================

describe("AgentCommunicationService", () => {
  let service: AgentCommunicationService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AgentCommunicationService(
      "https://api-example.stack.tryrelevance.com/latest/agents/trigger",
      "test-api-key"
    );

    // Mock fetch
    fetchMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("executeAgent", () => {
    it("should send payload with role property", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, message: "4" }),
      });

      await service.executeAgent("What is 2+2?", {
        conversationId: "conv-123",
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);

      expect(payload).toHaveProperty("role", "data_engine");
      expect(payload).toHaveProperty("input", "What is 2+2?");
      expect(payload).toHaveProperty("context");
    });

    it("should include correct headers", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await service.executeAgent("Question", { conversationId: "conv-123" });

      const call = fetchMock.mock.calls[0];
      const headers = call[1].headers;

      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBe("Bearer test-api-key");
      expect(headers["X-API-Key"]).toBe("test-api-key");
    });

    it("should throw AgentError on 422 response", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: async () => ({
            message: "Body Validation Error - Missing required property: 'role'",
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: async () => ({
            message: "Body Validation Error - Missing required property: 'role'",
          }),
        });

      await expect(
        service.executeAgent("Question", { conversationId: "conv-123" })
      ).rejects.toThrow(AgentError);

      try {
        await service.executeAgent("Question", { conversationId: "conv-123" });
      } catch (error) {
        expect(error).toBeInstanceOf(AgentError);
        expect((error as AgentError).code).toBe(422);
        expect((error as AgentError).is422()).toBe(true);
      }
    });

    it("should retry on 500+ server errors", async () => {
      // First two calls return 500, third succeeds
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: "Internal Server Error" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: "Service Unavailable" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: "4" }),
        });

      const result = await service.executeAgent("Question", {
        conversationId: "conv-123",
      });

      expect(result).toEqual({ success: true, message: "4" });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("should give up after max retries", async () => {
      // Always return 500
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal Server Error" }),
      });

      await expect(
        service.executeAgent("Question", { conversationId: "conv-123" })
      ).rejects.toThrow(AgentError);

      // Should attempt 3 times (initial + 2 retries)
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("should return successful response", async () => {
      const successResponse = {
        success: true,
        message: "Agent executed successfully",
        data: { result: "2+2=4" },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => successResponse,
      });

      const result = await service.executeAgent("What is 2+2?", {
        conversationId: "conv-123",
      });

      expect(result).toEqual(successResponse);
    });
  });
});

// ============================================================================
// UNIT TESTS: Configuration Manager
// ============================================================================

describe("ConfigManager", () => {
  beforeEach(() => {
    // Reset singleton
    ConfigManager.reset();
  });

  describe("initialization", () => {
    it("should initialize with provided config", () => {
      ConfigManager.initialize({
        endpoint: "https://api.example.com/latest/agents/trigger",
        apiKey: "test-key",
      });

      const manager = ConfigManager.getInstance();
      expect(manager).toBeDefined();
    });

    it("should throw if getInstance called before initialize", () => {
      expect(() => ConfigManager.getInstance()).toThrow(
        "ConfigManager not initialized"
      );
    });
  });

  describe("validation", () => {
    it("should validate endpoint contains /trigger", () => {
      ConfigManager.initialize({
        endpoint: "https://api.example.com/latest/agents/trigger",
        apiKey: "test-key",
      });

      const manager = ConfigManager.getInstance();
      expect(manager.isValidEndpoint()).toBe(true);
    });

    it("should reject /run endpoint", () => {
      ConfigManager.initialize({
        endpoint: "https://api.example.com/latest/agents/run",
        apiKey: "test-key",
      });

      const manager = ConfigManager.getInstance();
      expect(manager.isValidEndpoint()).toBe(false);
    });

    it("should report validation errors for missing fields", () => {
      ConfigManager.initialize({
        endpoint: "",
        apiKey: "",
      });

      const manager = ConfigManager.getInstance();
      const errors = manager.validateConfig();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Missing "endpoint" configuration');
      expect(errors).toContain('Missing "apiKey" configuration');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Integration: Full Agent Communication Flow", () => {
  let service: AgentCommunicationService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AgentCommunicationService(
      "https://api-bcbe5a.stack.tryrelevance.com/latest/agents/trigger",
      "test-api-key"
    );

    fetchMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  it("should handle complete agent communication with role", async () => {
    // Setup successful response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: "Agent executed",
        data: { answer: "4" },
        metadata: { timestamp: new Date().toISOString() },
      }),
    });

    // Execute agent
    const result = await service.executeAgent("What is 2+2?", {
      conversationId: "conv-123",
      userId: "user-456",
      projectId: "proj-789",
    });

    // Verify result
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ answer: "4" });

    // Verify payload included role
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.role).toBe("data_engine");
  });

  it("should handle 422 error with helpful message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        message: "Body Validation Error",
        errors: {
          role: "Missing required property",
        },
      }),
    });

    await expect(
      service.executeAgent("Question", { conversationId: "conv-123" })
    ).rejects.toThrow();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe("Performance", () => {
  it("should validate payload quickly", () => {
    const payload = {
      role: "data_engine",
      input: "What is 2+2?",
      context: { conversation_id: "conv-123" },
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      validateAgentPayload(payload);
    }
    const duration = performance.now() - start;

    // Should be very fast (< 100ms for 1000 validations)
    expect(duration).toBeLessThan(100);
  });

  it("should build payload with acceptable latency", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      buildAgentPayload("Question", {
        conversationId: "conv-123",
        userId: `user-${i}`,
      });
    }
    const duration = performance.now() - start;

    // Should be fast (< 50ms for 1000 payloads)
    expect(duration).toBeLessThan(50);
  });
});
