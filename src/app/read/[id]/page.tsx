import { createClient } from "@/lib/supabase/server";
import { sanitizeReaderHtmlForServer } from "@/lib/reader-html-server";
import { notFound } from "next/navigation";
import ReaderView from "@/components/reader/ReaderView";
import type { Article } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReaderPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: article, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !article) {
    notFound();
  }

  return (
    <ReaderView
      article={{
        ...(article as Article),
        content: sanitizeReaderHtmlForServer((article as Article).content),
      }}
    />
  );
}
