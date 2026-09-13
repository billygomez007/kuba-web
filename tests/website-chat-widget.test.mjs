import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/kuba/chat.js", import.meta.url), "utf8");

test("reads data-welcome and renders it through safe DOM APIs", () => {
  assert.match(source, /dataset\.welcome/);
  assert.match(source, /textContent/);
  assert.match(source, /createTextNode/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.match(source, /maxWelcomeLength = 500/);
});

test("keeps title and welcome message separate with a generic fallback", () => {
  assert.match(source, /title\.textContent = "Kuba AI"/);
  assert.match(source, /addMessage\("Kuba", welcomeMessage\)/);
  assert.match(source, /if \(welcomeMessage\)/);
  assert.match(source, /Ask us anything/);
});

test("makes the public key available to preflight without adding credentials", () => {
  assert.match(source, /website-chat\?publicKey=\$\{encodeURIComponent\(publicKey\)\}/);
  assert.doesNotMatch(source, /credentials\s*:/);
  assert.doesNotMatch(source, /Authorization/);
});

test("prevents duplicate widget instances", () => {
  assert.match(source, /document\.querySelector\(widgetMarker\)/);
  assert.match(source, /data-kuba-chat-widget/);
});

function createFakeDom(welcome) {
  class FakeNode {
    constructor(tagName, text = "") {
      this.tagName = tagName.toUpperCase();
      this.text = text;
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.attributes = {};
      this.listeners = {};
      this.value = "";
      this.src = "https://superkuba.com/kuba/chat.js";
    }

    get textContent() {
      return this.text + this.children.map((child) => child.textContent).join("");
    }

    set textContent(value) {
      this.text = String(value);
      this.children = [];
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }
  }

  const body = new FakeNode("body");
  const script = new FakeNode("script");
  script.dataset = {
    publicKey: "kuba_pk_test",
    ...(welcome === undefined ? {} : { welcome }),
  };

  function hasWidgetMarker(node) {
    return node.dataset?.kubaChatWidget || node.children.some(hasWidgetMarker);
  }

  const document = {
    currentScript: script,
    body,
    createElement: (tagName) => new FakeNode(tagName),
    createTextNode: (text) => new FakeNode("#text", String(text)),
    querySelector: (selector) =>
      selector === "[data-kuba-chat-widget]" && body.children.some(hasWidgetMarker)
        ? body.children.find(hasWidgetMarker)
        : null,
  };

  return { body, document, script };
}

function runWidget(welcome) {
  const dom = createFakeDom(welcome);
  vm.runInNewContext(source, {
    document: dom.document,
    URL,
    console,
  });
  return dom;
}

test("renders hostile, Unicode, and long welcome values as text with a safe limit", () => {
  const hostile = '<script>alert(1)</script> <img src=x onerror=alert(2)> & café';
  const dom = runWidget(hostile);
  const messages = dom.body.children[1].children[1];

  assert.equal(messages.children.length, 1);
  assert.equal(messages.children[0].textContent, `Kuba: ${hostile}`);

  const long = runWidget("x".repeat(600));
  const longMessage = long.body.children[1].children[1].children[0].textContent;
  assert.equal(longMessage.length, "Kuba: ".length + 500);
});

test("keeps the generic fallback when the welcome attribute is absent or empty", () => {
  assert.equal(runWidget(undefined).body.children[1].children[1].children.length, 0);
  assert.equal(runWidget("   ").body.children[1].children[1].children.length, 0);
});

test("does not duplicate the widget when the provider script is inserted twice", () => {
  const dom = runWidget("Hello");
  dom.document.currentScript = {
    dataset: { publicKey: "kuba_pk_test", welcome: "Again" },
    src: "https://superkuba.com/kuba/chat.js",
  };

  vm.runInNewContext(source, { document: dom.document, URL, console });
  assert.equal(dom.body.children.length, 2);
  assert.equal(dom.body.children[1].children[1].children.length, 1);
});
