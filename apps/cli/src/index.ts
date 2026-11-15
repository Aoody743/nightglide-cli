#!/usr/bin/env bun
import { printDoctorReport } from "./commands/doctor.js";
import { runDemoCommand } from "./commands/demo.js";
import { runChatCommand } from "./commands/chat.js";

const VERSION = "0.1.0 (M0 Foundation)";

function printHelp(): void {
  console.log(`
  ==============================================================
    NIGHTGLIDE — AI Coding CLI
    "Build beyond the horizon." / "漫翔苍穹，构筑所想。"
    Version: ${VERSION}
  ==============================================================

  USAGE:
    nightglide [command] [options]

  COMMANDS:
    (default)       Launch the Nightglide interactive TUI
    demo            Launch deterministic streaming UI demonstration (No API key needed)
    doctor          Run system, toolchain, and provider diagnostic health check
    chat            Launch chat directly in conversation mode
    --help, -h      Display this help reference
    --version, -v   Print version information

  EXAMPLES:
    $ nightglide
    $ nightglide demo
    $ nightglide doctor
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  switch (command) {
    case "doctor":
      await printDoctorReport();
      break;

    case "demo":
      await runDemoCommand();
      break;

    case "chat":
      await runChatCommand({ initialScreen: "chat" });
      break;

    case "--version":
    case "-v":
      console.log(`Nightglide v${VERSION}`);
      break;

    case "--help":
    case "-h":
    case "help":
      printHelp();
      break;

    case undefined:
      // Default action: launch Nightglide TUI
      await runChatCommand({ initialScreen: "welcome" });
      break;

    default:
      console.error(`\nUnknown command: "${command}"\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nUnexpected Nightglide execution failure:", err);
  process.exit(1);
});
