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

test("large diagnostic artifacts are retained only for manual runs", async () => {
  const workflow = await readFile(".github/workflows/update-index.yml", "utf8");
  const artifactStep = workflow.slice(
    workflow.indexOf("- name: Upload database, coverage, and browser packages"),
    workflow.indexOf("- name: Configure GitHub Pages")
  );

  assert.match(
    artifactStep,
    /if:\s*\$\{\{ github\.event_name == 'workflow_dispatch' \}\}/
  );
  assert.match(artifactStep, /retention-days:\s*7/);
});

test("Pages deployment is explicitly enabled and depends on a verified build", async () => {
  const workflow = await readFile(".github/workflows/update-index.yml", "utf8");
  const verification = workflow.indexOf("run: npm run verify");
  const pagesUpload = workflow.indexOf("uses: actions/upload-pages-artifact@v4");

  assert.ok(verification >= 0, "the canonical verification step must exist");
  assert.ok(pagesUpload > verification, "Pages upload must follow canonical verification");
  assert.match(
    workflow,
    /if:\s*\$\{\{ vars\.ENABLE_PAGES_DEPLOYMENT == 'true' \}\}/
  );
  assert.match(
    workflow,
    /uses: actions\/upload-pages-artifact@v4\s+with:\s+path: data\/generated\/public/
  );
  assert.match(workflow, /deploy-pages:\s+[\s\S]*needs: build-index/);
  assert.match(workflow, /deploy-pages:\s+[\s\S]*pages: write/);
  assert.match(workflow, /deploy-pages:\s+[\s\S]*id-token: write/);
  assert.match(workflow, /deploy-pages:\s+[\s\S]*name: github-pages/);
  assert.match(workflow, /uses: actions\/deploy-pages@v4/);
  assert.doesNotMatch(
    workflow.slice(pagesUpload),
    /path:[^\n]*(database\.sqlite|data\/cache)/,
    "the Pages artifact must not include SQLite or acquisition caches"
  );
});
