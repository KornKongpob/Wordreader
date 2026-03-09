import AppShell from "@/components/layout/AppShell";
import VocabList from "@/components/vocabulary/VocabList";

export default function VocabularyPage() {
  return (
    <AppShell>
      <div className="px-5 py-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">My Vocabulary</h1>
        <VocabList />
      </div>
    </AppShell>
  );
}
