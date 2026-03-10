import AppShell from "@/components/layout/AppShell";
import VocabList from "@/components/vocabulary/VocabList";

export default function VocabularyPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-5 py-6 space-y-5">
        <section className="glass-hero rounded-[2rem] p-5">
          <p className="editorial-label mb-2">Vocabulary Studio</p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            My Vocabulary
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Browse saved words, surface what is due for review, and keep each article
            context easy to revisit.
          </p>
        </section>
        <VocabList />
      </div>
    </AppShell>
  );
}
