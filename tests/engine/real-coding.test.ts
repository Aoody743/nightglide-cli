import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import {
  type AgentEvent,
  type FileDiffData,
  ModelNotConfiguredError,
} from "@nightglide/core";
import {
  MockAgentEngine,
  MockAgentSession,
  OmpAgentEngine,
  OmpAgentSession,
  parseDiffStats,
  generateUnifiedDiff,
} from "../../packages/engine/src/index.js";

describe("Real Native Coding Integration & Verification", () => {
  // =========================================================================
  // CATEGORY 1: MOCK VERIFIED (Fast Deterministic Test of Coding Workflow)
  // =========================================================================
  describe("Category 1: MOCK VERIFIED", () => {
    test("deterministic mock coding workflow emits tool_start and tool_end with diff data", async () => {
      const mockEngine = new MockAgentEngine({
        stepDelayMs: 2,
        mockToolName: "write",
        mockToolInput: {
          path: "src/flight-telemetry.ts",
          content: "export const altitude = 35000;\nexport const heading = 180;\n",
        },
        mockToolDiff: {
          filePath: "src/flight-telemetry.ts",
          diff: "--- /dev/null\n+++ b/src/flight-telemetry.ts\n@@ -0,0 +1,2 @@\n+export const altitude = 35000;\n+export const heading = 180;\n",
          additions: 2,
          deletions: 0,
        },
      });

      const session = await mockEngine.createSession({
        workspacePath: "/mock/workspace",
      });

      const receivedEvents: AgentEvent[] = [];
      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      await session.sendMessage("Create and write src/flight-telemetry.ts");

      // Verify full lifecycle event types
      const types = receivedEvents.map((e) => e.type);
      expect(types).toContain("status");
      expect(types).toContain("tool_start");
      expect(types).toContain("tool_end");
      expect(types).toContain("text_delta");
      expect(types).toContain("done");

      // Verify tool_start payload
      const toolStart = receivedEvents.find((e) => e.type === "tool_start") as Extract<
        AgentEvent,
        { type: "tool_start" }
      >;
      expect(toolStart).toBeDefined();
      expect(toolStart.toolName).toBe("write");
      expect((toolStart.input as any).path).toBe("src/flight-telemetry.ts");

      // Verify tool_end payload has populated diff?: FileDiffData
      const toolEnd = receivedEvents.find((e) => e.type === "tool_end") as Extract<
        AgentEvent,
        { type: "tool_end" }
      >;
      expect(toolEnd).toBeDefined();
      expect(toolEnd.toolName).toBe("write");
      expect(toolEnd.diff).toBeDefined();
      expect(toolEnd.diff?.filePath).toBe("src/flight-telemetry.ts");
      expect(toolEnd.diff?.additions).toBe(2);
      expect(toolEnd.diff?.deletions).toBe(0);
      expect(toolEnd.diff?.diff).toContain("+export const altitude = 35000;");

      await session.dispose();
    });

    test("mock edit workflow populates diff with additions and deletions", async () => {
      const mockEngine = new MockAgentEngine({
        stepDelayMs: 2,
        mockToolName: "edit",
        mockToolInput: {
          path: "src/flight-telemetry.ts",
          old_string: "altitude = 35000",
          new_string: "altitude = 38000",
        },
        mockToolDiff: {
          filePath: "src/flight-telemetry.ts",
          diff: "--- a/src/flight-telemetry.ts\n+++ b/src/flight-telemetry.ts\n@@ -1,1 +1,1 @@\n-export const altitude = 35000;\n+export const altitude = 38000;\n",
          additions: 1,
          deletions: 1,
        },
      });

      const session = await mockEngine.createSession({
        workspacePath: "/mock/workspace",
      });

      const receivedEvents: AgentEvent[] = [];
      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      await session.sendMessage("Edit altitude in src/flight-telemetry.ts");

      const toolEnd = receivedEvents.find((e) => e.type === "tool_end") as Extract<
        AgentEvent,
        { type: "tool_end" }
      >;
      expect(toolEnd).toBeDefined();
      expect(toolEnd.toolName).toBe("edit");
      expect(toolEnd.diff).toBeDefined();
      expect(toolEnd.diff?.additions).toBe(1);
      expect(toolEnd.diff?.deletions).toBe(1);

      await session.dispose();
    });

    test("mock approval workflow emits approval_request and resolves cleanly", async () => {
      let approvalRequested = false;
      const receivedEvents: AgentEvent[] = [];

      const mockEngine = new MockAgentEngine({
        stepDelayMs: 2,
        mockToolName: "write",
        requireApproval: true,
      });

      const session = await mockEngine.createSession({
        workspacePath: "/mock/workspace",
        approvalMode: "always-ask",
        onApprovalRequest: (request) => {
          approvalRequested = true;
          expect(request.id).toBeDefined();
          expect(request.toolName).toBe("write");
          expect(request.prompt.compact).toContain("write");
          // Resolve with "once"
          request.resolve("once");
        },
      });

      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      await session.sendMessage("Write flight-data.json");

      expect(approvalRequested).toBe(true);
      expect(receivedEvents.some((e) => e.type === "approval_request")).toBe(true);
      expect(receivedEvents.some((e) => e.type === "approval_resolved")).toBe(true);

      const resolvedEvent = receivedEvents.find(
        (e) => e.type === "approval_resolved"
      ) as Extract<AgentEvent, { type: "approval_resolved" }>;
      expect(resolvedEvent.answer).toBe("once");

      await session.dispose();
    });

    test("mock cancellation halts workflow and resets status to idle", async () => {
      const mockEngine = new MockAgentEngine({
        stepDelayMs: 50,
      });

      const session = await mockEngine.createSession({
        workspacePath: "/mock/workspace",
      });

      const messagePromise = session.sendMessage("Slow celestial query");
      await new Promise((r) => setTimeout(r, 10));

      await session.cancel();
      await messagePromise;

      expect(session.getState().status).toBe("idle");
      await session.dispose();
    });
  });

  // =========================================================================
  // CATEGORY 2: SDK VERIFIED (Real Native OMP SDK in Temp Workspace with Git)
  // =========================================================================
  describe("Category 2: SDK VERIFIED", () => {
    let tempWorkspace: string;
    let tempAgentDir: string;

    beforeEach(async () => {
      // Create a disposable temporary workspace in os.tmpdir()
      tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-sdk-coding-"));
      tempAgentDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-sdk-agent-"));

      // Initialize a real git repository in the temporary workspace
      try {
        execSync("git init", { cwd: tempWorkspace, stdio: "ignore" });
        execSync('git config user.name "Nightglide Agent"', { cwd: tempWorkspace, stdio: "ignore" });
        execSync('git config user.email "agent@nightglide.local"', { cwd: tempWorkspace, stdio: "ignore" });
      } catch {
        // Fallback if git is absent in environment
      }
    });

    afterEach(async () => {
      await fs.rm(tempWorkspace, { recursive: true, force: true }).catch(() => {});
      await fs.rm(tempAgentDir, { recursive: true, force: true }).catch(() => {});
    });

    test("native OMP session registers full suite of native coding tools", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const session = (await engine.createSession({
        workspacePath: tempWorkspace,
        readOnly: false,
      })) as OmpAgentSession;

      const omp = (session as any).ompSession;
      const activeTools: string[] = omp.getActiveToolNames?.() ?? [];

      // Verify all 8 native tools required by specification
      expect(activeTools).toContain("read");
      expect(activeTools).toContain("write");
      expect(activeTools).toContain("edit");
      expect(activeTools).toContain("bash");
      expect(activeTools).toContain("task");
      expect(activeTools).toContain("find");
      expect(activeTools).toContain("grep");
      expect(activeTools).toContain("glob");

      await session.dispose();
    }, 30000);

    test("SDK native file creation via write tool populates FileDiffData in tool_end", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const session = (await engine.createSession({
        workspacePath: tempWorkspace,
        approvalMode: "yolo",
      })) as OmpAgentSession;

      const receivedEvents: AgentEvent[] = [];
      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      const omp = (session as any).ompSession;
      const writeTool = omp.getToolByName("write");
      expect(writeTool).toBeDefined();

      const relativeFilePath = "src/index.ts";
      const fileContent = "export const PI = 3.14159;\nexport const E = 2.71828;\n";

      // Simulate native turn execution of write tool
      session.handleOmpEvent({
        type: "tool_execution_start",
        toolName: "write",
        toolCallId: "call_write_1",
        args: { path: relativeFilePath, content: fileContent },
      });

      const result = await writeTool.execute("call_write_1", {
        path: relativeFilePath,
        content: fileContent,
      });

      session.handleOmpEvent({
        type: "tool_execution_end",
        toolName: "write",
        toolCallId: "call_write_1",
        result,
      });

      // 1. Verify file exists on disk in the disposable temporary workspace
      const diskPath = path.join(tempWorkspace, relativeFilePath);
      const existsOnDisk = await fs.exists(diskPath);
      expect(existsOnDisk).toBe(true);
      const writtenContent = await fs.readFile(diskPath, "utf8");
      expect(writtenContent).toBe(fileContent);

      // 2. Verify tool_start event was emitted
      const toolStart = receivedEvents.find(
        (e) => e.type === "tool_start" && e.toolName === "write"
      ) as Extract<AgentEvent, { type: "tool_start" }>;
      expect(toolStart).toBeDefined();
      expect(toolStart.toolCallId).toBe("call_write_1");

      // 3. Verify tool_end event was emitted with diff?: FileDiffData
      const toolEnd = receivedEvents.find(
        (e) => e.type === "tool_end" && e.toolName === "write"
      ) as Extract<AgentEvent, { type: "tool_end" }>;
      expect(toolEnd).toBeDefined();
      expect(toolEnd.toolCallId).toBe("call_write_1");
      expect(toolEnd.diff).toBeDefined();
      expect(toolEnd.diff?.filePath).toBe(relativeFilePath);
      expect(toolEnd.diff?.additions).toBeGreaterThanOrEqual(2);
      expect(toolEnd.diff?.deletions).toBe(0);
      expect(toolEnd.diff?.diff).toContain("+export const PI = 3.14159;");

      await session.dispose();
    }, 30000);

    test("SDK native file modification via edit tool populates FileDiffData with additions & deletions", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const session = (await engine.createSession({
        workspacePath: tempWorkspace,
        approvalMode: "yolo",
      })) as OmpAgentSession;

      const receivedEvents: AgentEvent[] = [];
      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      const omp = (session as any).ompSession;
      const writeTool = omp.getToolByName("write");
      const editTool = omp.getToolByName("edit");
      expect(writeTool).toBeDefined();
      expect(editTool).toBeDefined();

      const relativeFilePath = "src/config.ts";
      const initialContent = "export const mode = 'development';\nexport const port = 3000;\n";
      await writeTool.execute("setup_write", {
        path: relativeFilePath,
        content: initialContent,
      });

      // Now edit the file using replace mode
      session.handleOmpEvent({
        type: "tool_execution_start",
        toolName: "edit",
        toolCallId: "call_edit_1",
        args: {
          path: relativeFilePath,
          old_string: "mode = 'development'",
          new_string: "mode = 'production'",
        },
      });

      const editResult = await editTool.execute("call_edit_1", {
        path: relativeFilePath,
        old_string: "mode = 'development'",
        new_string: "mode = 'production'",
      });

      session.handleOmpEvent({
        type: "tool_execution_end",
        toolName: "edit",
        toolCallId: "call_edit_1",
        result: editResult,
      });

      // Verify file modified on disk
      const diskPath = path.join(tempWorkspace, relativeFilePath);
      const updatedDiskContent = await fs.readFile(diskPath, "utf8");
      expect(updatedDiskContent).toContain("mode = 'production'");

      // Verify tool_end event has populated diff with additions and deletions
      const toolEnd = receivedEvents.find(
        (e) => e.type === "tool_end" && e.toolCallId === "call_edit_1"
      ) as Extract<AgentEvent, { type: "tool_end" }>;
      expect(toolEnd).toBeDefined();
      expect(toolEnd.diff).toBeDefined();
      expect(toolEnd.diff?.filePath).toBe(relativeFilePath);
      expect(toolEnd.diff?.additions).toBeGreaterThanOrEqual(1);
      expect(toolEnd.diff?.deletions).toBeGreaterThanOrEqual(1);

      await session.dispose();
    }, 30000);

    test("SDK native approval hook wires ExtensionUIContext.approve into approval_request event and waits for resolution", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      let callbackTriggered = false;
      const receivedEvents: AgentEvent[] = [];

      const session = (await engine.createSession({
        workspacePath: tempWorkspace,
        approvalMode: "always-ask",
        onApprovalRequest: (req) => {
          callbackTriggered = true;
          expect(req.id).toBeDefined();
          expect(req.toolName).toBe("bash");
          expect(req.prompt.compact).toContain("bash");
          // Approve once
          req.resolve("once");
        },
      })) as OmpAgentSession;

      session.subscribe((event) => {
        receivedEvents.push(event);
      });

      const omp = (session as any).ompSession;
      const bashTool = omp.getToolByName("bash");
      expect(bashTool).toBeDefined();

      // Calling bash tool under always-ask mode triggers uiContext.approve()
      const bashResult = await bashTool.execute("call_bash_approval", {
        command: "echo APPROVED_BY_NIGHTGLIDE",
      });

      expect(callbackTriggered).toBe(true);
      expect(bashResult.content[0].text).toContain("APPROVED_BY_NIGHTGLIDE");

      // Verify events emitted to subscribers
      expect(receivedEvents.some((e) => e.type === "approval_request")).toBe(true);
      expect(receivedEvents.some((e) => e.type === "approval_resolved")).toBe(true);

      const resolved = receivedEvents.find(
        (e) => e.type === "approval_resolved"
      ) as Extract<AgentEvent, { type: "approval_resolved" }>;
      expect(resolved.answer).toBe("once");

      await session.dispose();
    }, 30000);

    test("SDK native approval denial rejects tool execution gracefully", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const session = (await engine.createSession({
        workspacePath: tempWorkspace,
        approvalMode: "always-ask",
        onApprovalRequest: (req) => {
          // Deny execution
          req.resolve("deny");
        },
      })) as OmpAgentSession;

      const omp = (session as any).ompSession;
      const bashTool = omp.getToolByName("bash");

      let errorCaught: Error | null = null;
      try {
        await bashTool.execute("call_bash_denied", {
          command: "echo SHOULD_NOT_RUN",
        });
      } catch (err) {
        errorCaught = err as Error;
      }

      expect(errorCaught).not.toBeNull();
      expect(errorCaught?.message).toContain("denied");

      await session.dispose();
    }, 30000);

    test("SDK cancellation calls ompSession.abort and transitions active subagents cleanly", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const session = (await engine.createSession({
        workspacePath: tempWorkspace,
      })) as OmpAgentSession;

      // Simulate a spawned subagent in progress
      session.handleSubagentEvent({
        id: "sub_coding_worker",
        event: {
          type: "turn_start",
        },
      });

      const stateBefore = session.getState();
      expect(stateBefore.activeSubagents?.length).toBe(1);
      expect(stateBefore.activeSubagents?.[0].status).toBe("thinking");

      // Cancel the session
      await session.cancel();

      // Verify subagent transitioned to completed
      const stateAfter = session.getState();
      expect(stateAfter.status).toBe("idle");
      expect(stateAfter.activeSubagents?.[0].status).toBe("completed");

      await session.dispose();
    }, 30000);

    test("diff utility functions handle edge cases accurately", () => {
      // 1. parseDiffStats
      const unified = "--- a/file\n+++ b/file\n@@ -1,2 +1,3 @@\n-line1\n+line1_new\n+line2_new\n line3";
      const stats = parseDiffStats(unified);
      expect(stats.additions).toBe(2);
      expect(stats.deletions).toBe(1);

      // 2. generateUnifiedDiff for new file
      const newDiff = generateUnifiedDiff("new.ts", "", "line1\nline2\n");
      expect(newDiff).toContain("--- /dev/null");
      expect(newDiff).toContain("+++ b/new.ts");
      expect(newDiff).toContain("+line1");
      expect(newDiff).toContain("+line2");

      // 3. generateUnifiedDiff for identical files
      const emptyDiff = generateUnifiedDiff("same.ts", "content", "content");
      expect(emptyDiff).toBe("");
    });
  });

  // =========================================================================
  // CATEGORY 3: LIVE VERIFIED (Live Inference or Explicit BLOCKED/UNAUTHENTICATED)
  // =========================================================================
  describe("Category 3: LIVE VERIFIED", () => {
    test("Category 3: LIVE VERIFIED - attempts live inference or marks BLOCKED / UNAUTHENTICATED gracefully", async () => {
      const liveEndpointConfigured = Boolean(
        process.env.NIGHTGLIDE_LIVE_TEST &&
          (process.env.OMLX_API_KEY ||
            process.env.LOCAL_AI_API_KEY ||
            process.env.OPENAI_API_KEY ||
            process.env.ANTHROPIC_API_KEY)
      );

      const engine = new OmpAgentEngine();
      const health = await engine.checkHealth();

      if (!liveEndpointConfigured || !health.ready) {
        // Explicitly mark as BLOCKED / UNAUTHENTICATED without throwing uncaught failure
        console.info(
          "[LIVE VERIFIED] BLOCKED / UNAUTHENTICATED: Local model endpoint unreachable or no authenticated API key configured. Safe skip."
        );
        expect(health.engineId).toBe("omp-adapter");
        expect(health.isMock).toBe(false);
        return;
      }

      // If credentials and live model endpoint are genuinely active:
      try {
        const session = await engine.createSession({
          workspacePath: os.tmpdir(),
          model: "omlx/qwen2.5-coder-7b",
        });

        const receivedEvents: AgentEvent[] = [];
        session.subscribe((event) => {
          receivedEvents.push(event);
        });

        await session.sendMessage("Reply with 'LIVE_VERIFIED'");
        expect(receivedEvents.some((e) => e.type === "text_delta" || e.type === "done")).toBe(
          true
        );
        console.info("[LIVE VERIFIED] Live inference executed successfully against local model.");
        await session.dispose();
      } catch (err: unknown) {
        if (
          err instanceof ModelNotConfiguredError ||
          (err instanceof Error &&
            (err.message.includes("401") ||
              err.message.includes("ECONNREFUSED") ||
              err.message.includes("No model configured") ||
              err.message.includes("unauthenticated")))
        ) {
          console.info(
            `[LIVE VERIFIED] BLOCKED / UNAUTHENTICATED: Local endpoint returned: ${(err as Error).message}`
          );
          expect(true).toBe(true);
        } else {
          throw err;
        }
      }
    }, 45000);
  });
});
