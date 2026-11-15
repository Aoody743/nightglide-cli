import { describe, test, expect } from "bun:test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  MockAgentEngine,
  MockAgentSession,
  OmpAgentEngine,
  OmpAgentSession,
  DEFAULT_MOCK_GREETING_CHUNKS,
} from "@nightglide/engine";
import {
  SessionDisposedError,
  ModelNotConfiguredError,
  type AgentEvent,
} from "@nightglide/core";

describe("MockAgentEngine & MockAgentSession", () => {
  const testWorkspace = path.join(os.tmpdir(), "nightglide-mock-workspace");

  test("MockAgentEngine initializes with correct metadata", () => {
    const engine = new MockAgentEngine();
    expect(engine.id).toBe("mock-engine");
    expect(engine.isMock).toBe(true);
  });

  test("MockAgentEngine checkHealth returns ready", async () => {
    const engine = new MockAgentEngine();
    const health = await engine.checkHealth();

    expect(health.ready).toBe(true);
    expect(health.engineId).toBe("mock-engine");
    expect(health.isMock).toBe(true);
    expect(health.message).toContain("operational");
    expect(health.details?.mode).toBe("simulation");
  });

  test("MockAgentEngine creates session with expected initial state", async () => {
    const engine = new MockAgentEngine();
    const session = await engine.createSession({
      workspacePath: testWorkspace,
      model: "custom-celestial-model",
    });

    expect(session.id).toBeDefined();
    expect(session.model).toBe("custom-celestial-model");
    expect(session.workspacePath).toBe(testWorkspace);

    const state = session.getState();
    expect(state.status).toBe("idle");
    expect(state.messageHistoryCount).toBe(0);
    expect(state.isDisposed).toBe(false);
  });

  test("MockAgentSession streams complete deterministic sequence with tool execution", async () => {
    const engine = new MockAgentEngine({ stepDelayMs: 2 });
    const session = await engine.createSession({
      workspacePath: testWorkspace,
    });

    const receivedEvents: AgentEvent[] = [];
    const unsubscribe = session.subscribe((event) => {
      receivedEvents.push(event);
    });

    await session.sendMessage("Initiate celestial flight sequence");

    expect(receivedEvents.length).toBeGreaterThanOrEqual(7);

    // Verify event types occurred in proper progression
    const eventTypes = receivedEvents.map((e) => e.type);

    expect(eventTypes).toContain("status");
    expect(eventTypes).toContain("tool_start");
    expect(eventTypes).toContain("tool_end");
    expect(eventTypes).toContain("text_delta");
    expect(eventTypes).toContain("done");

    // Verify thinking status
    const thinkingStatus = receivedEvents.find(
      (e) => e.type === "status" && e.status === "thinking"
    );
    expect(thinkingStatus).toBeDefined();

    // Verify simulated "read" tool call
    const toolStart = receivedEvents.find(
      (e) => e.type === "tool_start"
    ) as Extract<AgentEvent, { type: "tool_start" }>;
    expect(toolStart).toBeDefined();
    expect(toolStart.toolName).toBe("read");
    expect(toolStart.input).toEqual({ path: "flight-plan.md" });

    const toolEnd = receivedEvents.find(
      (e) => e.type === "tool_end"
    ) as Extract<AgentEvent, { type: "tool_end" }>;
    expect(toolEnd).toBeDefined();
    expect(toolEnd.toolName).toBe("read");
    expect(toolEnd.result).toBeDefined();

    // Verify text deltas match default greeting chunks
    const textDeltas = receivedEvents
      .filter((e): e is Extract<AgentEvent, { type: "text_delta" }> => e.type === "text_delta")
      .map((e) => e.delta);

    expect(textDeltas).toEqual([...DEFAULT_MOCK_GREETING_CHUNKS]);

    // Verify completion
    const doneEvent = receivedEvents.find(
      (e) => e.type === "done"
    ) as Extract<AgentEvent, { type: "done" }>;
    expect(doneEvent).toBeDefined();
    expect(doneEvent.totalTokens).toBeGreaterThan(0);

    // Verify session state updated
    const finalState = session.getState();
    expect(finalState.status).toBe("idle");
    expect(finalState.messageHistoryCount).toBe(1);
    expect(finalState.isDisposed).toBe(false);

    unsubscribe();
  });

  test("MockAgentSession unsubscribe stops receiving events", async () => {
    const engine = new MockAgentEngine({ stepDelayMs: 2 });
    const session = await engine.createSession({ workspacePath: testWorkspace });

    let count = 0;
    const unsub = session.subscribe(() => {
      count++;
    });

    unsub();
    await session.sendMessage("Test message");

    expect(count).toBe(0);
  });

  test("MockAgentSession handles cancellation cleanly", async () => {
    const engine = new MockAgentEngine({ stepDelayMs: 30 });
    const session = await engine.createSession({ workspacePath: testWorkspace });

    const receivedEvents: AgentEvent[] = [];
    session.subscribe((event) => {
      receivedEvents.push(event);
    });

    // Start message delivery in background and cancel immediately after first tick
    const sendPromise = session.sendMessage("Flight directive to abort");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await session.cancel();
    await sendPromise;

    const state = session.getState();
    expect(state.status).toBe("idle");

    const cancellingStatus = receivedEvents.find(
      (e) => e.type === "status" && e.status === "cancelling"
    );
    expect(cancellingStatus).toBeDefined();
  });

  test("MockAgentSession disposal marks session disposed and prevents subsequent calls", async () => {
    const engine = new MockAgentEngine({ stepDelayMs: 2 });
    const session = await engine.createSession({ workspacePath: testWorkspace });

    expect(session.getState().isDisposed).toBe(false);
    await session.dispose();

    expect(session.getState().isDisposed).toBe(true);

    // Repeated dispose is safe and idempotent
    await session.dispose();
    expect(session.getState().isDisposed).toBe(true);

    // Sending message on disposed session throws SessionDisposedError
    expect(session.sendMessage("Should fail")).rejects.toThrow(SessionDisposedError);
  });
});

describe("OmpAgentEngine & OmpAgentSession", () => {
  const testWorkspace = path.join(os.tmpdir(), "nightglide-omp-workspace");

  test("OmpAgentEngine initializes with correct metadata", () => {
    const engine = new OmpAgentEngine();
    expect(engine.id).toBe("omp-adapter");
    expect(engine.isMock).toBe(false);
  });

  test("OmpAgentEngine checkHealth executes isolated probe and returns status", async () => {
    const engine = new OmpAgentEngine({
      defaultWorkspacePath: testWorkspace,
    });

    const health = await engine.checkHealth();
    expect(health.engineId).toBe("omp-adapter");
    expect(health.isMock).toBe(false);
    expect(typeof health.ready).toBe("boolean");
    expect(typeof health.message).toBe("string");
    expect(health.details).toBeDefined();
    expect(health.details?.allowedTools).toEqual(["read", "find", "grep", "task"]);
  }, 30000);

  test("OmpAgentEngine creates isolated session and disposes cleanly", async () => {
    const tempAgentDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-omp-agent-"));
    const engine = new OmpAgentEngine({
      defaultAgentDir: tempAgentDir,
    });

    try {
      const session = await engine.createSession({
        workspacePath: testWorkspace,
        model: "test-model",
      });

      expect(session.id).toBeDefined();
      expect(session.workspacePath).toBe(testWorkspace);

      const state = session.getState();
      expect(state.status).toBe("idle");
      expect(state.isDisposed).toBe(false);

      await session.dispose();
      expect(session.getState().isDisposed).toBe(true);

      // Safe idempotent dispose
      await session.dispose();
      expect(session.getState().isDisposed).toBe(true);
    } finally {
      await fs.rm(tempAgentDir, { recursive: true, force: true });
    }
  }, 30000);

  test("OmpAgentSession normalizes stream deltas and lifecycle events to AgentEvents", async () => {
    const tempAgentDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-omp-norm-"));
    const engine = new OmpAgentEngine({
      defaultAgentDir: tempAgentDir,
    });

    try {
      const session = (await engine.createSession({
        workspacePath: testWorkspace,
      })) as OmpAgentSession;

      const receivedEvents: AgentEvent[] = [];
      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      // 1. Test turn start -> thinking status
      session.handleOmpEvent({ type: "turn_start" });
      expect(session.getState().status).toBe("thinking");

      // 2. Test text stream delta -> streaming status and text_delta event
      session.handleOmpEvent({
        type: "message_update",
        assistantMessageEvent: {
          type: "text_delta",
          delta: "Celestial vector established.",
        },
      });
      expect(session.getState().status).toBe("streaming");
      expect(
        receivedEvents.some(
          (e) => e.type === "text_delta" && e.delta === "Celestial vector established."
        )
      ).toBe(true);

      // 3. Test tool execution start -> executing_tool status and tool_start event
      session.handleOmpEvent({
        type: "tool_execution_start",
        toolName: "read",
        toolCallId: "call_abc_1",
        args: { path: "stellar-map.json" },
      });
      expect(session.getState().status).toBe("executing_tool");
      expect(
        receivedEvents.some(
          (e) =>
            e.type === "tool_start" &&
            e.toolName === "read" &&
            e.toolCallId === "call_abc_1" &&
            (e.input as any).path === "stellar-map.json"
        )
      ).toBe(true);

      // 4. Test tool execution end -> tool_end event
      session.handleOmpEvent({
        type: "tool_execution_end",
        toolName: "read",
        toolCallId: "call_abc_1",
        result: "Coordinates locked",
        isError: false,
      });
      expect(
        receivedEvents.some(
          (e) =>
            e.type === "tool_end" &&
            e.toolName === "read" &&
            e.toolCallId === "call_abc_1" &&
            e.result === "Coordinates locked"
        )
      ).toBe(true);

      // 5. Test agent_end -> completed status, done event, then idle
      session.handleOmpEvent({ type: "agent_end" });
      expect(receivedEvents.some((e) => e.type === "done")).toBe(true);
      expect(session.getState().status).toBe("idle");

      // 6. Test auto_retry failure -> error event
      session.handleOmpEvent({
        type: "auto_retry_end",
        success: false,
        attempt: 3,
        finalError: "Connection timed out",
      });
      expect(session.getState().status).toBe("error");
      expect(
        receivedEvents.some(
          (e) => e.type === "error" && e.error === "Connection timed out"
        )
      ).toBe(true);

      await session.dispose();
    } finally {
      await fs.rm(tempAgentDir, { recursive: true, force: true });
    }
  }, 30000);

  test("OmpAgentSession throws ModelNotConfiguredError when model is unconfigured", async () => {
    const tempAgentDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-omp-err-"));
    const engine = new OmpAgentEngine({
      defaultAgentDir: tempAgentDir,
    });

    try {
      const session = await engine.createSession({
        workspacePath: testWorkspace,
      });

      const receivedEvents: AgentEvent[] = [];
      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      // No model/auth in isolated environment, prompt should reject with ModelNotConfiguredError
      expect(session.sendMessage("Fly to Polaris")).rejects.toThrow(ModelNotConfiguredError);

      await session.dispose();

      // Disposed session throws SessionDisposedError
      expect(session.sendMessage("Fly to Vega")).rejects.toThrow(SessionDisposedError);
    } finally {
      await fs.rm(tempAgentDir, { recursive: true, force: true });
    }
  }, 30000);

  test("OmpAgentSession cancel updates status and resets to idle", async () => {
    const tempAgentDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-omp-cancel-"));
    const engine = new OmpAgentEngine({
      defaultAgentDir: tempAgentDir,
    });

    try {
      const session = await engine.createSession({
        workspacePath: testWorkspace,
      });

      await session.cancel();
      expect(session.getState().status).toBe("idle");

      await session.dispose();
    } finally {
      await fs.rm(tempAgentDir, { recursive: true, force: true });
    }
  }, 30000);
});
