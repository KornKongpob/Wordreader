import { createClient } from "@/lib/supabase/server";
import { sanitizeReaderHtml } from "@/lib/reader-html";
import { notFound } from "next/navigation";
import ReaderView from "@/components/reader/ReaderView";
import type { Article } from "@/types";

export const dynamic = "force-dynamic";

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
        content: sanitizeReaderHtml((article as Article).content),
      }}
    />
  );
}
