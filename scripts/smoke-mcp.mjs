#!/usr/bin/env node

import { spawn } from "node:child_process";

let child;
let exit;

try {
  const requestTimeoutMs = parseTimeout("MCP_TIMEOUT_MS", 15_000);
  const shutdownTimeoutMs = parseTimeout("MCP_SHUTDOWN_TIMEOUT_MS", 5_000);
  const command = parseCommand(process.env.MCP_COMMAND);

  child = spawn(command.file, command.shell ? [] : command.args.slice(1), {
    env: process.env,
    shell: command.shell,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-16_384);
  });

  exit = waitForExit(child);
  const rpc = createJsonRpcClient(child, requestTimeoutMs, () => stderr);

  const initialize = await rpc.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "gk-mcp-smoke-test",
      version: "1.0.0",
    },
  });

  assertObject(initialize, "initialize result");
  if (typeof initialize.protocolVersion !== "string") {
    throw new Error("initialize result is missing a string protocolVersion");
  }

  rpc.notify("notifications/initialized");

  const listed = await rpc.request("tools/list", {});
  const tools = validateToolsResult(listed);

  if (process.env.MCP_SMOKE_REPOSITORY !== undefined) {
    if (!tools.some((tool) => tool.name === "git_status")) {
      throw new Error("tools/list did not advertise the required git_status tool");
    }

    const callResult = await rpc.request("tools/call", {
      name: "git_status",
      arguments: { directory: process.env.MCP_SMOKE_REPOSITORY },
    });
    assertObject(callResult, "git_status result");
    if (callResult.isError === true) {
      throw new Error(`git_status returned an MCP error: ${formatToolContent(callResult.content)}`);
    }
  }

  child.stdin.end();
  const outcome = await withTimeout(
    exit,
    shutdownTimeoutMs,
    `MCP server did not exit within ${shutdownTimeoutMs}ms after stdin closed`,
  );
  assertSuccessfulExit(outcome, stderr);

  console.log(`MCP smoke test passed: ${tools.length} tools.`);
} catch (error) {
  await stopChild(child, exit);
  console.error(`smoke-mcp: ${error.message}`);
  process.exitCode = 1;
}

function parseCommand(value) {
  if (!value?.trim()) {
    return { file: "gk", args: ["gk", "mcp"], shell: false };
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    let args;
    try {
      args = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`MCP_COMMAND is not valid JSON: ${error.message}`);
    }
    if (
      !Array.isArray(args) ||
      args.length === 0 ||
      args.some((argument) => typeof argument !== "string" || argument.length === 0)
    ) {
      throw new Error("MCP_COMMAND JSON must be a nonempty array of nonempty strings");
    }
    return { file: args[0], args, shell: false };
  }

  return { file: trimmed, args: [], shell: true };
}

function parseTimeout(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds`);
  }
  return parsed;
}

function createJsonRpcClient(process, timeoutMs, getStderr) {
  let nextId = 1;
  let stdoutBuffer = "";
  const pending = new Map();

  process.stdout.setEncoding("utf8");
  process.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    let newline;
    while ((newline = stdoutBuffer.indexOf("\n")) !== -1) {
      const line = stdoutBuffer.slice(0, newline).replace(/\r$/, "");
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (line.trim()) handleLine(line);
    }
  });

  process.stdout.on("end", () => {
    if (stdoutBuffer.trim()) handleLine(stdoutBuffer.replace(/\r$/, ""));
  });

  function handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      rejectAll(new Error(`MCP server wrote invalid JSON to stdout: ${error.message}\n${line}`));
      return;
    }

    if (message?.jsonrpc !== "2.0" || !("id" in message)) return;
    const request = pending.get(message.id);
    if (!request) return;

    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) {
      request.reject(
        new Error(
          `JSON-RPC request ${request.method} failed: ${JSON.stringify(message.error)}`,
        ),
      );
    } else if (!("result" in message)) {
      request.reject(new Error(`JSON-RPC response to ${request.method} has no result`));
    } else {
      request.resolve(message.result);
    }
  }

  function write(message) {
    if (!process.stdin.writable) {
      throw new Error("MCP server stdin is not writable");
    }
    process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function rejectAll(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  }

  process.once("error", (error) => {
    rejectAll(new Error(`Unable to launch MCP server: ${error.message}`));
  });
  process.stdin.on("error", (error) => {
    rejectAll(new Error(`Unable to write to MCP server stdin: ${error.message}`));
  });
  process.once("exit", (code, signal) => {
    const details = formatStderr(getStderr());
    rejectAll(
      new Error(
        `MCP server exited before completing requests (${formatExit(code, signal)})${details}`,
      ),
    );
  });

  return {
    request(method, params) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new Error(
              `JSON-RPC request ${method} timed out after ${timeoutMs}ms${formatStderr(
                getStderr(),
              )}`,
            ),
          );
        }, timeoutMs);
        pending.set(id, { method, resolve, reject, timer });
        try {
          write({ jsonrpc: "2.0", id, method, params });
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        }
      });
    },
    notify(method, params) {
      write({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
    },
  };
}

function validateToolsResult(result) {
  assertObject(result, "tools/list result");
  if (!Array.isArray(result.tools) || result.tools.length === 0) {
    throw new Error("tools/list result must contain a nonempty tools array");
  }

  const names = new Set();
  for (const [index, tool] of result.tools.entries()) {
    assertObject(tool, `tool at index ${index}`);
    if (typeof tool.name !== "string" || tool.name.trim() === "") {
      throw new Error(`tool at index ${index} has an invalid name`);
    }
    if (names.has(tool.name)) {
      throw new Error(`tools/list returned duplicate tool name ${JSON.stringify(tool.name)}`);
    }
    names.add(tool.name);

    if (tool.description !== undefined && typeof tool.description !== "string") {
      throw new Error(`tool ${JSON.stringify(tool.name)} has an invalid description`);
    }
    assertObject(tool.inputSchema, `inputSchema for tool ${JSON.stringify(tool.name)}`);
    if (tool.inputSchema.type !== "object") {
      throw new Error(`inputSchema for tool ${JSON.stringify(tool.name)} must have type object`);
    }
  }

  return result.tools;
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function waitForExit(process) {
  return new Promise((resolve) => {
    process.once("error", (error) => {
      resolve({ error });
    });
    process.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

function assertSuccessfulExit(outcome, stderr) {
  if (outcome.error) {
    throw new Error(`Unable to launch MCP server: ${outcome.error.message}`);
  }
  if (outcome.code !== 0) {
    throw new Error(
      `MCP server ${formatExit(outcome.code, outcome.signal)}${formatStderr(stderr)}`,
    );
  }
}

async function stopChild(process, exit) {
  if (!process || process.exitCode !== null || process.signalCode !== null) return;

  process.kill("SIGTERM");
  if (exit) {
    const stopped = await Promise.race([
      exit.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 1_000)),
    ]);
    if (stopped) return;
  }

  process.kill("SIGKILL");
}

function withTimeout(promise, milliseconds, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function formatExit(code, signal) {
  return signal ? `was terminated by ${signal}` : `exited with status ${code}`;
}

function formatStderr(stderr) {
  const trimmed = stderr.trim();
  return trimmed ? `\nServer stderr:\n${trimmed}` : "";
}

function formatToolContent(content) {
  if (!Array.isArray(content)) return JSON.stringify(content);

  const text = content
    .filter((item) => item && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
  return text || JSON.stringify(content);
}
