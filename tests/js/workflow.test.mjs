import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("scheduled updates restore durable database state between runs", async () => {
  const workflow = await readFile(".github/workflows/update-index.yml", "utf8");

  assert.match(workflow, /path:\s*\|[\s\S]*data\/cache\/http/);
  assert.match(workflow, /path:\s*\|[\s\S]*data\/generated\/database\.sqlite/);
  assert.match(workflow, /key: wabbajack-state-\$\{\{ runner\.os \}\}-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /restore-keys:\s*\|\s*wabbajack-state-\$\{\{ runner\.os \}\}-/);
});
