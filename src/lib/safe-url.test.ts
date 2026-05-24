import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicArticleUrl } from "./safe-url";

test("rejects private and non-public article URLs", async () => {
  const cases = [
    "",
    "ftp://example.com/article",
    "https://user:pass@example.com/article",
    "http://localhost/article",
    "http://example.local/article",
    "http://127.0.0.1/article",
    "http://10.0.0.1/article",
    "http://172.16.0.1/article",
    "http://192.168.0.1/article",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/article",
    `https://example.com/${"a".repeat(2050)}`,
  ];

  for (const input of cases) {
    const result = await validatePublicArticleUrl(input);
    assert.equal(result.ok, false, `${input} should be rejected`);
  }
});

test("allows normal public article URLs", async () => {
  const result = await validatePublicArticleUrl("https://example.com/article");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url, "https://example.com/article");
  }
});
