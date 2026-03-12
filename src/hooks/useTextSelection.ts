"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SelectionKind = "short" | "sentence" | "paragraph";

interface TextSelection {
  text: string;
  sentence: string;
  paragraph: string;
  position: { x: number; y: number };
  wordCount: number;
  kind: SelectionKind;
}

interface UseTextSelectionOptions {
  maxLength?: number;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean).length;
}

function countSentences(value: string) {
  return normalizeText(value)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function normalizeBoundaryText(value: string) {
  return normalizeText(value).replace(/^[("'“”‘’\s]+|[)"'“”‘’\s.!?,;:]+$/g, "");
}

function inferSelectionKind(text: string, sentence: string, paragraph: string): SelectionKind {
  const normalizedText = normalizeText(text);
  const normalizedSentence = normalizeText(sentence);
  const normalizedParagraph = normalizeText(paragraph);
  const selectedWordCount = countWords(normalizedText);

  if (
    normalizedParagraph &&
    normalizedText === normalizedParagraph &&
    countSentences(normalizedParagraph) > 1
  ) {
    return "paragraph";
  }

  if (
    selectedWordCount > 4 &&
    normalizeBoundaryText(normalizedText) === normalizeBoundaryText(normalizedSentence)
  ) {
    return "sentence";
  }

  return "short";
}

export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseTextSelectionOptions = {}
) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const isProcessing = useRef(false);
  const maxLength = options.maxLength ?? 100;

  const getBlockElement = useCallback(
    (node: Node): HTMLElement | null => {
      const container = containerRef.current;
      let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;

      while (current && current !== container) {
        if (current instanceof HTMLElement) {
          const tag = current.tagName.toLowerCase();
          if (["p", "li", "blockquote", "figcaption"].includes(tag) || /^h[1-6]$/.test(tag)) {
            return current;
          }
        }

        current = current.parentNode;
      }

      return null;
    },
    [containerRef]
  );

  const getSentenceFromRange = useCallback(
    (range: Range): string => {
      const selectedText = range.toString().trim();
      if (!selectedText) return "";

      const container = containerRef.current;
      let scope: Node = getBlockElement(range.startContainer) ?? range.commonAncestorContainer;

      if (scope.nodeType === Node.TEXT_NODE) {
        scope = scope.parentNode ?? scope;
      }

      while (scope.parentNode && scope.parentNode !== container) {
        if (scope instanceof HTMLElement) {
          const tag = scope.tagName.toLowerCase();
          if (["p", "li", "blockquote", "figcaption"].includes(tag) || /^h[1-6]$/.test(tag)) {
            break;
          }
        }

        scope = scope.parentNode;
      }

      try {
        const fullText = scope.textContent || "";
        if (!fullText) return selectedText;

        const beforeRange = range.cloneRange();
        beforeRange.selectNodeContents(scope);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const startIndex = beforeRange.toString().length;
        const endIndex = startIndex + range.toString().length;

        let sentenceStart = 0;
        for (let index = startIndex - 1; index >= 0; index -= 1) {
          if (".!?\n".includes(fullText[index])) {
            sentenceStart = index + 1;
            break;
          }
        }

        let sentenceEnd = fullText.length;
        for (let index = endIndex; index < fullText.length; index += 1) {
          if (".!?\n".includes(fullText[index])) {
            sentenceEnd = index + 1;
            break;
          }
        }

        return normalizeText(fullText.slice(sentenceStart, sentenceEnd));
      } catch {
        return normalizeText(selectedText);
      }
    },
    [containerRef, getBlockElement]
  );

  const getParagraphFromRange = useCallback(
    (range: Range): string => {
      const selectedText = range.toString().trim();
      if (!selectedText) return "";

      const startBlock = getBlockElement(range.startContainer);
      const endBlock = getBlockElement(range.endContainer);

      if (startBlock && endBlock && startBlock === endBlock) {
        return normalizeText(startBlock.textContent || selectedText);
      }

      return normalizeText(selectedText);
    },
    [getBlockElement]
  );

  const handleSelectionChange = useCallback(() => {
    if (isProcessing.current) return;

    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.isCollapsed || !browserSelection.rangeCount) {
      setSelection(null);
      setSelectionNotice(null);
      return;
    }

    const range = browserSelection.getRangeAt(0);
    const text = normalizeText(browserSelection.toString());

    if (!text || text.length > maxLength) {
      setSelection(null);
      setSelectionNotice(
        text.length > maxLength
          ? `Select a shorter section (up to ${maxLength} characters).`
          : null
      );
      return;
    }

    setSelectionNotice(null);

    if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const sentence = getSentenceFromRange(range);
    const paragraph = getParagraphFromRange(range);
    const kind = inferSelectionKind(text, sentence, paragraph);

    setSelection({
      text,
      sentence,
      paragraph,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      },
      wordCount: countWords(text),
      kind,
    });
  }, [containerRef, getParagraphFromRange, getSentenceFromRange, maxLength]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setSelectionNotice(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    const handlePointerUp = () => {
      window.setTimeout(handleSelectionChange, 10);
    };

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseup", handlePointerUp);
    container.addEventListener("touchend", handlePointerUp);

    return () => {
      container.removeEventListener("mouseup", handlePointerUp);
      container.removeEventListener("touchend", handlePointerUp);
    };
  }, [containerRef, handleSelectionChange]);

  return { selection, clearSelection, isProcessing, selectionNotice };
}


