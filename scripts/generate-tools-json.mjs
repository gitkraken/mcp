#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "tools.json");

const output = execFileSync("gk", ["mcp", "--list-tools"], {
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
