#!/usr/bin/env node
import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: run-with-timeout.mjs command [args...]");
  process.exit(64);
}

const timeoutMs = parseDuration(process.env.SITES_BUILD_TIMEOUT ?? "3m");
const killAfterMs = parseDuration(process.env.SITES_BUILD_KILL_AFTER ?? "10s");
const child = spawn(command, args, { detached: true, stdio: "inherit" });
let timedOut = false;

const timeout = setTimeout(() => {
  timedOut = true;
  console.error(`Build exceeded ${process.env.SITES_BUILD_TIMEOUT ?? "3m"}; sending SIGTERM.`);
  signalGroup("SIGTERM");
  setTimeout(() => signalGroup("SIGKILL"), killAfterMs).unref();
}, timeoutMs);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => signalGroup(signal));
}

child.on("error", (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  clearTimeout(timeout);
  if (timedOut) process.exitCode = 124;
  else if (typeof code === "number") process.exitCode = code;
  else {
    console.error(`Build stopped by ${signal ?? "an unknown signal"}.`);
    process.exitCode = 1;
  }
});

function signalGroup(signal) {
  if (!child.pid || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function parseDuration(value) {
  const match = /^(\d+)(ms|s|m)?$/u.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const units = { m: 60_000, ms: 1, s: 1_000 };
  return Number(match[1]) * units[match[2] ?? "ms"];
}
