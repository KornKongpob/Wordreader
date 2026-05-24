import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArticleAiArtifactType } from "../types";

interface ArticleArtifactLookupOptions {
  supabase: SupabaseClient;
  userId: string;
  articleId: string;
  artifactType: ArticleAiArtifactType;
  inputHash: string;
}

interface ArticleArtifactUpsertOptions<TPayload>
  extends ArticleArtifactLookupOptions {
  model?: string;
  payload: TPayload;
  now?: Date;
}

interface ArticleArtifactPayloadRow<TPayload> {
  payload: TPayload;
}

export function hashArticleInput(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function getArticleArtifact<TPayload>({
  supabase,
  userId,
  articleId,
  artifactType,
  inputHash,
}: ArticleArtifactLookupOptions): Promise<TPayload | null> {
  const { data, error } = await supabase
    .from("article_ai_artifacts")
    .select("payload")
    .eq("user_id", userId)
    .eq("article_id", articleId)
    .eq("artifact_type", artifactType)
    .eq("input_hash", inputHash)
    .maybeSingle<ArticleArtifactPayloadRow<TPayload>>();

  if (error) {
    throw error;
  }

  return data?.payload ?? null;
}

export async function upsertArticleArtifact<TPayload>({
  supabase,
  userId,
  articleId,
  artifactType,
  inputHash,
  model = "",
  payload,
  now = new Date(),
}: ArticleArtifactUpsertOptions<TPayload>): Promise<TPayload> {
  const { data, error } = await supabase
    .from("article_ai_artifacts")
    .upsert(
      {
        user_id: userId,
        article_id: articleId,
        artifact_type: artifactType,
        input_hash: inputHash,
        model,
        payload,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id,article_id,artifact_type,input_hash" }
    )
    .select("payload")
    .single<ArticleArtifactPayloadRow<TPayload>>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Could not store AI artifact.");
  }

  return data.payload;
}
