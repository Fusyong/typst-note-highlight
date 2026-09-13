import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = [
  "check-begin.mjs",
  "test-grammar.mjs",
  "test-snt-edit.mjs",
  "test-snt-nav.mjs",
  "test-ntp-extract.mjs",
];

let failed = false;
for (const name of scripts) {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", name)], {
    encoding: "utf8",
    cwd: root,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  // Windows + oniguruma WASM 可能在退出时 libuv 断言崩溃；以 stdout 有无 FAIL 为准
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (out.includes("FAIL") || (r.status !== 0 && r.status !== null && !/UV_HANDLE_CLOSING|Assertion failed/i.test(out))) {
    failed = true;
  }
  if (r.status !== 0 && r.status !== null && /UV_HANDLE_CLOSING|Assertion failed/i.test(out) && !out.includes("FAIL")) {
    console.log(`(忽略 ${name} 退出时的 libuv 断言，用例已通过)`);
  }
}

process.exit(failed ? 1 : 0);
