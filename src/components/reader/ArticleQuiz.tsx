"use client";

import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { QuizQuestion } from "@/types";

interface ArticleQuizProps {
  articleId: string;
  articleTitle: string;
  content: string;
}

export default function ArticleQuiz({
  articleId,
  articleTitle,
  content,
}: ArticleQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSavedQuiz = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("article_quizzes")
        .select("quiz")
        .eq("user_id", user.id)
        .eq("article_id", articleId)
        .maybeSingle();

      if (Array.isArray(data?.quiz) && data.quiz.length > 0) {
        setQuestions(data.quiz as QuizQuestion[]);
      }
    };

    void loadSavedQuiz();
  }, [articleId]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, articleTitle, content }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not generate a quiz.");
        setLoading(false);
        return;
      }

      const nextQuestions = data.questions || [];
      setQuestions(nextQuestions);
      setSelected({});

      const supabase = createClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await supabase.from("article_quizzes").upsert(
            {
              user_id: user.id,
              article_id: articleId,
              quiz: nextQuestions,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,article_id" }
          );
        }
      }
    } catch {
      setError("Could not generate a quiz right now.");
    }

    setLoading(false);
  };

  const answered = Object.keys(selected).length;
  const score = questions.reduce((total, question, index) => {
    return total + (selected[index] === question.answer_index ? 1 : 0);
  }, 0);

  return (
    <section className="glass-panel mt-8 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-primary" />
          <div>
            <h2 className="font-medium">Quick comprehension quiz</h2>
            <p className="text-xs text-muted">Check if the article really stuck.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="subtle-button rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Generating..." : questions.length ? "Refresh quiz" : "Generate quiz"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          <span>Building a quiz from this article...</span>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {questions.length > 0 && (
        <div className="space-y-4">
          <div className="glass-chip rounded-xl px-3 py-2 text-sm text-muted">
            Score: {score}/{questions.length}
            {answered < questions.length && ` | ${questions.length - answered} left`}
          </div>
          {questions.map((question, index) => {
            const selectedOption = selected[index];
            const isAnswered = selectedOption !== undefined;

            return (
              <div key={`${question.question}-${index}`} className="glass-panel rounded-2xl p-4">
                <p className="mb-3 font-medium">
                  {index + 1}. {question.question}
                </p>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const isCorrect = optionIndex === question.answer_index;
                    const isSelected = selectedOption === optionIndex;

                    return (
                      <button
                        key={`${option}-${optionIndex}`}
                        type="button"
                        disabled={isAnswered}
                        onClick={() =>
                          setSelected((current) => ({ ...current, [index]: optionIndex }))
                        }
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isAnswered
                            ? isCorrect
                              ? "border-success bg-success/10 text-foreground"
                              : isSelected
                                ? "border-danger bg-danger/10 text-foreground"
                                : "border-border text-muted"
                            : "subtle-button hover:text-foreground"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {isAnswered && (
                  <div className="glass-chip mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm text-muted">
                    <CheckCircle2 size={16} className="mt-0.5 text-primary" />
                    <span>{question.explanation}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
