import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getArticleArtifact,
  hashArticleInput,
  upsertArticleArtifact,
} from "./ai-artifacts";

function createSupabaseStub({
  selectResult = { data: null, error: null },
  upsertResult = { data: { payload: null }, error: null },
}: {
  selectResult?: { data: unknown; error: unknown };
  upsertResult?: { data: unknown; error: unknown };
}) {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const builder = {
    select(...args: unknown[]) {
      calls.push({ name: "select", args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ name: "eq", args });
      return builder;
    },
    maybeSingle() {
      calls.push({ name: "maybeSingle", args: [] });
      return Promise.resolve(selectResult);
    },
    upsert(...args: unknown[]) {
      calls.push({ name: "upsert", args });
      return builder;
    },
    single() {
      calls.push({ name: "single", args: [] });
      return Promise.resolve(upsertResult);
    },
  };

  return {
    client: {
      from(...args: unknown[]) {
        calls.push({ name: "from", args });
        return builder;
      },
    } as unknown as SupabaseClient,
    calls,
  };
}

test("hashArticleInput returns a stable SHA-256 hex digest", () => {
  assert.equal(
    hashArticleInput("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
  );
});

test("getArticleArtifact filters by user article type and input hash", async () => {
  const { client, calls } = createSupabaseStub({
    selectResult: { data: { payload: { html: "<p>Cached</p>" } }, error: null },
  });

  const payload = await getArticleArtifact<{ html: string }>({
    supabase: client,
    userId: "user-1",
    articleId: "article-1",
    artifactType: "chunked_html",
    inputHash: "hash-1",
  });

  assert.deepEqual(payload, { html: "<p>Cached</p>" });
  assert.deepEqual(calls, [
    { name: "from", args: ["article_ai_artifacts"] },
    { name: "select", args: ["payload"] },
    { name: "eq", args: ["user_id", "user-1"] },
    { name: "eq", args: ["article_id", "article-1"] },
    { name: "eq", args: ["artifact_type", "chunked_html"] },
    { name: "eq", args: ["input_hash", "hash-1"] },
    { name: "maybeSingle", args: [] },
  ]);
});

test("upsertArticleArtifact writes a per-user article artifact payload", async () => {
  const { client, calls } = createSupabaseStub({
    upsertResult: { data: { payload: { items: [] } }, error: null },
  });
  const now = new Date("2026-05-24T12:00:00.000Z");

  const payload = await upsertArticleArtifact<{ items: unknown[] }>({
    supabase: client,
    userId: "user-1",
    articleId: "article-1",
    artifactType: "idioms",
    inputHash: "hash-1",
    model: "gpt-4o-mini",
    payload: { items: [] },
    now,
  });

  assert.deepEqual(payload, { items: [] });
  assert.deepEqual(calls[0], { name: "from", args: ["article_ai_artifacts"] });
  assert.deepEqual(calls[1], {
    name: "upsert",
    args: [
      {
        user_id: "user-1",
        article_id: "article-1",
        artifact_type: "idioms",
        input_hash: "hash-1",
        model: "gpt-4o-mini",
        payload: { items: [] },
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id,article_id,artifact_type,input_hash" },
    ],
  });
});
