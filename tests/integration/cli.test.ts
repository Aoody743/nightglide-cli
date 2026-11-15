import { describe, test, expect } from "bun:test";
import { runDiagnostics } from "../../apps/cli/src/commands/doctor.js";

describe("CLI Integration Tests", () => {
  test("CLI responds to --help and includes brand tagline", async () => {
    const proc = Bun.spawn(["bun", "run", "apps/cli/src/index.ts", "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("NIGHTGLIDE");
    expect(output).toContain("Build beyond the horizon.");
    expect(output).toContain("demo");
    expect(output).toContain("doctor");
  });

  test("CLI responds to --version", async () => {
    const proc = Bun.spawn(["bun", "run", "apps/cli/src/index.ts", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("Nightglide v0.2.0");
  });

  test("CLI responds to providers command", async () => {
    const proc = Bun.spawn(["bun", "run", "apps/cli/src/index.ts", "providers"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("NIGHTGLIDE PROVIDERS");
    expect(output).toContain("端点状态");
  });

  test("CLI responds to models command", async () => {
    const proc = Bun.spawn(["bun", "run", "apps/cli/src/index.ts", "models"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("NIGHTGLIDE MODELS");
    expect(output).toContain("角色分配");
  });

  test("runDiagnostics returns valid structured report", async () => {
    const report = await runDiagnostics();
    expect(report.timestamp).toBeDefined();
    expect(report.items.length).toBeGreaterThanOrEqual(4);
    expect(report.allHealthy).toBe(true);

    const names = report.items.map((i) => i.name);
    expect(names).toContain("Host System");
    expect(names).toContain("Bun Runtime");
  });

  test("demo command runs cleanly in non-interactive mode", async () => {
    const proc = Bun.spawn(["bun", "run", "apps/cli/src/index.ts", "demo"], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe", // non-interactive
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("NIGHTGLIDE DEMO");
    expect(output).toContain("MockAgentEngine");
  });
});
