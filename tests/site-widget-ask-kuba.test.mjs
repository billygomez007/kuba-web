import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return fs.readFile(path, "utf8");
}

test("SuperKuba marketing website mounts Talk to Kuba", async () => {
  const page = await read("app/page.tsx");
  const widget = await read(
    "app/components/chat/SuperKubaSiteWidget.tsx",
  );

  assert.match(
    page,
    /<SuperKubaSiteWidget\s*\/>/,
  );

  assert.match(
    widget,
    /NEXT_PUBLIC_SUPERKUBA_WIDGET_PUBLIC_KEY/,
  );

  assert.match(
    widget,
    /\/api\/integrations\/website-chat/,
  );

  assert.match(
    widget,
    /Talk to Kuba/,
  );
});

test("Ask Kuba is mounted globally inside authenticated dashboard", async () => {
  const layout = await read(
    "app/dashboard/layout.tsx",
  );

  const assistant = await read(
    "app/components/chat/AskKubaAssistant.tsx",
  );

  assert.match(
    layout,
    /<AskKubaAssistant\s*\/>/,
  );

  assert.match(
    assistant,
    /\/api\/ai\/command-center/,
  );

  assert.match(
    assistant,
    /Ask Kuba/,
  );
});

test("customer-installable website widget remains untouched", async () => {
  const widget = await read(
    "public/kuba/chat.js",
  );

  assert.match(
    widget,
    /data-public-key|dataset\.publicKey/,
  );

  assert.match(
    widget,
    /\/api\/integrations\/website-chat/,
  );
});
