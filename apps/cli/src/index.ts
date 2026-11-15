#!/usr/bin/env bun
import { printDoctorReport } from "./commands/doctor.js";
import { runDemoCommand } from "./commands/demo.js";
import { runChatCommand } from "./commands/chat.js";
import { runProvidersCommand } from "./commands/providers.js";
import { runModelsCommand } from "./commands/models.js";

const VERSION = "0.2.0 (M1 Multi-Provider & Agent Collaboration)";

function printHelp(): void {
  console.log(`
  ==============================================================
    NIGHTGLIDE — Multi-Provider & Agent Collaboration CLI
    "Build beyond the horizon." / "漫翔苍穹，构筑所想。"
    Version: ${VERSION}
  ==============================================================

  USAGE:
    nightglide [command] [options]

  COMMANDS:
    (default)       Launch the Nightglide interactive TUI
    demo            Launch collaborative multi-agent simulation (No API key needed)
    providers       List configured local & cloud providers and probe connection status
    models          Display available models, capabilities, and agent role mappings
    doctor          Run system, toolchain, and multi-provider health diagnostics
    chat            Launch chat directly in conversation mode
    --help, -h      Display this help reference
    --version, -v   Print version information

  EXAMPLES:
    $ nightglide
    $ nightglide demo
    $ nightglide providers
    $ nightglide models
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

    case "providers":
      await runProvidersCommand();
      break;

    case "models":
      await runModelsCommand();
      break;

    case "demo":
      await runDemoCommand({
        nonInteractive: args.includes("--non-interactive") || args.includes("-n"),
      });
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
