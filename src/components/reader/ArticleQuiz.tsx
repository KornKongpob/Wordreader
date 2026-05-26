"use client";

import { useEffect, useState } from "react";
import { Brain, CheckCircle2, History, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import {
  buildArticleQuizAttemptPayload,
  getQuizScore,
} from "@/lib/article-quiz-attempts";
import type { ArticleQuizAttempt, QuizQuestion } from "@/types";

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
  const [articleQuizId, setArticleQuizId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<ArticleQuizAttempt[]>([]);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState("");

  useEffect(() => {
    const loadSavedQuiz = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { user } = await getUserWithProfile(supabase);

      if (!user) return;

      const [{ data: quizData }, { data: attemptData }] = await Promise.all([
        supabase
          .from("article_quizzes")
          .select("id, quiz")
          .eq("user_id", user.id)
          .eq("article_id", articleId)
          .maybeSingle(),
        supabase
          .from("article_quiz_attempts")
          .select("id, user_id, article_id, article_quiz_id, score, total, answers, completed_at")
          .eq("user_id", user.id)
          .eq("article_id", articleId)
          .order("completed_at", { ascending: false })
          .limit(5),
      ]);

      if (Array.isArray(quizData?.quiz) && quizData.quiz.length > 0) {
        setArticleQuizId(quizData.id);
        setQuestions(quizData.quiz as QuizQuestion[]);
      }

      setAttempts((attemptData ?? []) as ArticleQuizAttempt[]);
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
      setAttemptStatus("");

      const supabase = createClient();
      if (supabase) {
        const { user, error: userError } = await getUserWithProfile(supabase);

        if (user) {
          const { data: savedQuiz, error: saveError } = await supabase
            .from("article_quizzes")
            .upsert(
              {
                user_id: user.id,
                article_id: articleId,
                quiz: nextQuestions,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,article_id" }
            )
            .select("id")
            .single();

          if (saveError) {
            setError(saveError.message);
          } else if (savedQuiz?.id) {
            setArticleQuizId(savedQuiz.id);
          }
        } else if (userError && userError !== "Please sign in again.") {
          setError(userError);
        }
      }
    } catch {
      setError("Could not generate a quiz right now.");
    }

    setLoading(false);
  };

  const handleSaveAttempt = async () => {
    if (savingAttempt || questions.length === 0) return;

    setSavingAttempt(true);
    setError("");
    setAttemptStatus("");

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Could not save this attempt while offline.");
        return;
      }

      const { user, error: userError } = await getUserWithProfile(supabase);
      if (!user) {
        setError(userError || "Please sign in again to save this attempt.");
        return;
      }

      const payload = buildArticleQuizAttemptPayload({
        userId: user.id,
        articleId,
        articleQuizId,
        questions,
        selectedAnswers: selected,
      });

      const { data, error: saveError } = await supabase
        .from("article_quiz_attempts")
        .insert(payload)
        .select("id, user_id, article_id, article_quiz_id, score, total, answers, completed_at")
        .single();

      if (saveError) {
        setError(saveError.message);
        return;
      }

      if (data) {
        setAttempts((current) => [data as ArticleQuizAttempt, ...current].slice(0, 5));
      }
      setAttemptStatus("Attempt saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save this attempt."
      );
    } finally {
      setSavingAttempt(false);
    }
  };

  const answered = Object.keys(selected).length;
  const score = getQuizScore(questions, selected);
  const allAnswered = questions.length > 0 && answered === questions.length;

  return (
    <section className="glass-panel mt-8 rounded-2xl p-4">
      <div className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Brain size={16} className="text-primary" />
          <div className="min-w-0">
            <h2 className="text-safe-title font-medium">Quick comprehension quiz</h2>
            <p className="text-safe-meta text-xs text-muted">
              Check if the article really stuck.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="subtle-button min-h-[2.75rem] w-full rounded-xl px-3 py-2 text-center text-sm font-medium disabled:opacity-60 sm:w-auto"
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
          <div className="glass-chip text-safe-body rounded-xl px-3 py-2 text-sm text-muted">
            Score: {score}/{questions.length}
            {answered < questions.length && ` | ${questions.length - answered} left`}
          </div>
          {questions.map((question, index) => {
            const selectedOption = selected[index];
            const isAnswered = selectedOption !== undefined;

            return (
              <div key={`${question.question}-${index}`} className="glass-panel rounded-2xl p-4">
                <p className="text-safe-title mb-3 font-medium">
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
                        className={`text-safe-body w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
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
                    <span className="text-safe-body">{question.explanation}</span>
                  </div>
                )}
              </div>
            );
          })}
          {allAnswered && (
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-safe-title text-sm font-medium">
                    Final score: {score}/{questions.length}
                  </p>
                  <p className="text-safe-meta mt-1 text-xs text-muted">
                    Save this result to track comprehension over time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveAttempt()}
                  disabled={savingAttempt}
                  className="glow-button inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                >
                  {savingAttempt ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save attempt
                </button>
              </div>
              {attemptStatus && (
                <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
                  {attemptStatus}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {attempts.length > 0 && (
        <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <History size={16} className="text-primary" />
            <h3 className="text-safe-title text-sm font-medium">Previous attempts</h3>
          </div>
          <div className="space-y-2">
            {attempts.map((attempt) => {
              const percent = Math.round((attempt.score / attempt.total) * 100);

              return (
                <div
                  key={attempt.id}
                  className="glass-chip flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm"
                >
                  <span className="text-safe-body font-medium">
                    {attempt.score}/{attempt.total} ({percent}%)
                  </span>
                  <span className="text-safe-meta text-xs text-muted">
                    {new Date(attempt.completed_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
