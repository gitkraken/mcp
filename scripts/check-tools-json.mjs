#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const generatorPath = join(scriptDirectory, "generate-tools-json.mjs");
const committedPath = join(repositoryRoot, "tools.json");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "gk-mcp-tools-"));
const generatedPath = join(temporaryDirectory, "tools.json");

try {
  const result = spawnSync(process.execPath, [generatorPath, generatedPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });

  if (result.error) {
    throw new Error(`Unable to regenerate tools.json: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `The tools.json generator exited with status ${result.status}.${
        details ? `\n${details}` : ""
      }`,
    );
  }

  const committed = readFileSync(committedPath, "utf8");
  const generated = readFileSync(generatedPath, "utf8");

  if (committed !== generated) {
    const committedLines = committed.split("\n");
    const generatedLines = generated.split("\n");
    const differingLine = generatedLines.findIndex(
      (line, index) => line !== committedLines[index],
    );
    const location = differingLine === -1 ? "at end of file" : `at line ${differingLine + 1}`;

    throw new Error(
      `tools.json is out of date (${location}). Run ` +
        "`node scripts/generate-tools-json.mjs` and commit the result.",
    );
  }

  console.log("tools.json matches the current GitKraken MCP tool list.");
} catch (error) {
  console.error(`check-tools-json: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
