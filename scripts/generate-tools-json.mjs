#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const toolsImage = "gitkraken-mcp:tools-json";
const pinnedCoreVersion = readPinnedCoreVersion();
const outputPath = resolve(process.argv[2] ?? "tools.json");
const command = parseCommand();
const deniedToolNames = new Set(["app_tool_box", "app_update_user_preferences"]);

const output = execFileSync(command[0], command.slice(1), {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

const tools = [];
let currentTool;
let currentArgument;

function finishArgument() {
  currentArgument = undefined;
}

function finishTool() {
  finishArgument();
  currentTool = undefined;
}

for (const line of output.split(/\r?\n/)) {
  const toolMatch = line.match(/^Tool: (.+)$/);
  if (toolMatch) {
    finishTool();
    if (deniedToolNames.has(toolMatch[1])) {
      continue;
    }
    currentTool = {
      name: toolMatch[1],
      description: "",
      arguments: [],
    };
    tools.push(currentTool);
    continue;
  }

  if (!currentTool) {
    continue;
  }

  const descriptionMatch = line.match(/^  Description:\s*(.+)$/);
  if (descriptionMatch) {
    currentTool.description = descriptionMatch[1].trim();
    continue;
  }

  const argumentMatch = line.match(/^    - ([^\s]+) \[([^\]]+)\](?: \(required\))?$/);
  if (argumentMatch) {
    currentArgument = {
      name: argumentMatch[1],
      type: argumentMatch[2],
      desc: "",
    };
    currentTool.arguments.push(currentArgument);
    continue;
  }

  const argumentDescriptionMatch = line.match(/^      (.+)$/);
  if (argumentDescriptionMatch && currentArgument) {
    currentArgument.desc = currentArgument.desc
      ? `${currentArgument.desc} ${argumentDescriptionMatch[1].trim()}`
      : argumentDescriptionMatch[1].trim();
  }
}

if (tools.length === 0) {
  throw new Error("No MCP tools were found in `gk mcp --list-tools` output.");
}

writeFileSync(outputPath, `${JSON.stringify(tools, null, 2)}\n`);
console.log(`Wrote ${tools.length} tools to ${outputPath}`);

function parseCommand() {
  if (process.env.TOOLS_COMMAND) {
    const parsed = JSON.parse(process.env.TOOLS_COMMAND);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      parsed.some((argument) => typeof argument !== "string" || argument.length === 0)
    ) {
      throw new Error("TOOLS_COMMAND must be a JSON array of nonempty strings.");
    }
    return parsed;
  }

  if (process.env.GK_BIN) {
    assertCoreVersion(process.env.GK_BIN, ["version"]);
    return [process.env.GK_BIN, "mcp", "--list-tools"];
  }

  console.log(`Building ${toolsImage} from the pinned GitKraken core...`);
  execFileSync("docker", ["build", "--tag", toolsImage, repositoryRoot], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  assertCoreVersion("docker", [
    "run",
    "--rm",
    "--entrypoint",
    "/app/node_modules/.bin/gk",
    toolsImage,
    "version",
  ]);

  return ["docker", "run", "--rm", toolsImage, "--list-tools"];
}

function readPinnedCoreVersion() {
  const dockerfile = readFileSync(resolve(repositoryRoot, "Dockerfile"), "utf8");
  const match = dockerfile.match(/^ARG GK_CORE_VERSION=([^\s]+)$/m);
  if (!match) {
    throw new Error("Dockerfile does not declare ARG GK_CORE_VERSION.");
  }
  return match[1];
}

function assertCoreVersion(file, args) {
  const versionOutput = execFileSync(file, args, { encoding: "utf8" }).trim();
  const match =
    versionOutput.match(/CLI Core:\s*([^\s]+)/) ??
    versionOutput.match(/^(\d+\.\d+\.\d+(?:-[^\s]+)?)/m);
  const actualVersion = match?.[1];

  if (actualVersion !== pinnedCoreVersion) {
    throw new Error(
      `Expected GitKraken core ${pinnedCoreVersion}, but ${file} reported ` +
        `${actualVersion ?? JSON.stringify(versionOutput)}.`,
    );
  }
}
