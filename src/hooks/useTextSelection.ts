"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TapBehavior } from "@/types";

type SelectionKind = "short" | "sentence" | "paragraph";
type SelectionTrigger = "selection" | "tap" | "doubleTap";

interface TextSelection {
  text: string;
  sentence: string;
  paragraph: string;
  position: { x: number; y: number };
  wordCount: number;
  kind: SelectionKind;
  trigger: SelectionTrigger;
}

interface UseTextSelectionOptions {
  maxLength?: number;
  tapBehavior?: TapBehavior;
}

interface TextSegment {
  index: number;
  segment: string;
  isWordLike: boolean;
}

interface TapPoint {
  x: number;
  y: number;
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
  return getSentenceSegments(normalizeText(value)).length;
}

function normalizeBoundaryText(value: string) {
  return normalizeText(value).replace(/^[("'“”‘’\s]+|[)"'“”‘’\s.!?,;:]+$/g, "");
}

function shouldIgnoreSelectionTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'a, button, input, textarea, select, summary, [role="button"], [data-reader-ignore-selection="true"], mark[data-word], .idiom-highlight'
    )
  );
}

function getSentenceSegments(value: string) {
  if (!value) return [];

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return Array.from(segmenter.segment(value)).map((segment) => ({
      index: segment.index,
      segment: segment.segment,
      isWordLike: true,
    }));
  }

  const segments: TextSegment[] = [];
  const regex = /[^.!?\n]+[.!?"]*|\S+/g;
  let match = regex.exec(value);

  while (match) {
    segments.push({
      index: match.index,
      segment: match[0],
      isWordLike: true,
    });
    match = regex.exec(value);
  }

  return segments;
}

function getWordSegments(value: string) {
  if (!value) return [];

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "word" });
    return Array.from(segmenter.segment(value)).map((segment) => ({
      index: segment.index,
      segment: segment.segment,
      isWordLike: segment.isWordLike ?? /[A-Za-z0-9]/.test(segment.segment),
    }));
  }

  const segments: TextSegment[] = [];
  const regex = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
  let match = regex.exec(value);

  while (match) {
    segments.push({
      index: match.index,
      segment: match[0],
      isWordLike: true,
    });
    match = regex.exec(value);
  }

  return segments;
}

function findContainingSegment(segments: TextSegment[], offset: number) {
  return (
    segments.find(
      (segment) => offset >= segment.index && offset <= segment.index + segment.segment.length
    ) ?? null
  );
}

function findWordSegmentAtOffset(value: string, offset: number) {
  const segments = getWordSegments(value);
  if (segments.length === 0) return null;

  const containingIndex = segments.findIndex(
    (segment) => offset >= segment.index && offset <= segment.index + segment.segment.length
  );

  if (containingIndex >= 0 && segments[containingIndex]?.isWordLike) {
    return segments[containingIndex];
  }

  for (let distance = 1; distance <= 2; distance += 1) {
    const next = segments[containingIndex + distance];
    if (next?.isWordLike) return next;

    const previous = segments[containingIndex - distance];
    if (previous?.isWordLike) return previous;
  }

  return segments.find((segment) => segment.isWordLike) ?? null;
}

function findSentenceSegmentAtOffset(value: string, offset: number) {
  const segments = getSentenceSegments(value);
  return findContainingSegment(segments, offset) ?? segments[0] ?? null;
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

function getEventPoint(event: MouseEvent | TouchEvent): TapPoint | null {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }

  const touch = event.changedTouches[0] ?? event.touches[0];
  if (!touch) return null;

  return { x: touch.clientX, y: touch.clientY };
}

function getCaretAtPoint(x: number, y: number) {
  const documentWithCaret = document as Document & {
    caretPositionFromPoint?: (
      pointX: number,
      pointY: number
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (pointX: number, pointY: number) => Range | null;
  };

  if (documentWithCaret.caretPositionFromPoint) {
    const caret = documentWithCaret.caretPositionFromPoint(x, y);
    if (caret?.offsetNode) {
      return { node: caret.offsetNode, offset: caret.offset };
    }
  }

  if (documentWithCaret.caretRangeFromPoint) {
    const range = documentWithCaret.caretRangeFromPoint(x, y);
    if (range) {
      return { node: range.startContainer, offset: range.startOffset };
    }
  }

  return null;
}

export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseTextSelectionOptions = {}
) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const isProcessing = useRef(false);
  const tapTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef<(TapPoint & { time: number }) | null>(null);
  const maxLength = options.maxLength ?? 100;
  const tapBehavior = options.tapBehavior ?? "off";

  const getBlockElement = useCallback(
    (node: Node): HTMLElement | null => {
      const container = containerRef.current;
      let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;

      while (current && current !== container) {
        if (current instanceof HTMLElement) {
          const tag = current.tagName.toLowerCase();
          if (["p", "li", "blockquote", "figcaption", "div"].includes(tag) || /^h[1-6]$/.test(tag)) {
            return current;
          }
        }

        current = current.parentNode;
      }

      return container;
    },
    [containerRef]
  );

  const getOffsetWithinScope = useCallback((scope: Node, node: Node, offset: number) => {
    const range = document.createRange();
    range.selectNodeContents(scope);

    try {
      range.setEnd(node, offset);
      return range.toString().length;
    } catch {
      return 0;
    }
  }, []);

  const buildSelection = useCallback(
    ({
      scope,
      startIndex,
      endIndex,
      point,
      trigger,
      forcedKind,
    }: {
      scope: Node;
      startIndex: number;
      endIndex: number;
      point: TapPoint;
      trigger: SelectionTrigger;
      forcedKind?: SelectionKind;
    }) => {
      const fullText = scope.textContent || "";
      const paragraph = normalizeText(fullText);
      if (!paragraph) return null;

      const boundedStart = Math.max(0, Math.min(startIndex, fullText.length));
      const boundedEnd = Math.max(boundedStart, Math.min(endIndex, fullText.length));
      const rawText = fullText.slice(boundedStart, boundedEnd);
      const text = normalizeText(rawText);
      if (!text) return null;

      const sentenceOffset = Math.min(fullText.length, Math.floor((boundedStart + boundedEnd) / 2));
      const sentenceSegment = findSentenceSegmentAtOffset(fullText, sentenceOffset);
      const sentence = normalizeText(sentenceSegment?.segment || text);
      const kind = forcedKind ?? inferSelectionKind(text, sentence, paragraph);

      if (text.length > maxLength) {
        setSelectionNotice(`Select a shorter section (up to ${maxLength} characters).`);
        return null;
      }

      setSelectionNotice(null);

      return {
        text,
        sentence,
        paragraph,
        position: {
          x: point.x,
          y: point.y + 8,
        },
        wordCount: countWords(text),
        kind,
        trigger,
      } satisfies TextSelection;
    },
    [maxLength]
  );

  const getSelectionFromRange = useCallback(
    (range: Range) => {
      const container = containerRef.current;
      if (container && !container.contains(range.commonAncestorContainer)) {
        return null;
      }

      const text = normalizeText(range.toString());
      if (!text) return null;

      const scope = getBlockElement(range.startContainer) ?? range.commonAncestorContainer;
      const startIndex = getOffsetWithinScope(scope, range.startContainer, range.startOffset);
      const endIndex = getOffsetWithinScope(scope, range.endContainer, range.endOffset);
      const rect = range.getBoundingClientRect();

      return buildSelection({
        scope,
        startIndex,
        endIndex,
        point: {
          x: rect.left + rect.width / 2,
          y: rect.bottom,
        },
        trigger: "selection",
      });
    },
    [buildSelection, containerRef, getBlockElement, getOffsetWithinScope]
  );

  const getSelectionFromPoint = useCallback(
    (point: TapPoint, trigger: SelectionTrigger) => {
      const caret = getCaretAtPoint(point.x, point.y);
      if (!caret) return null;

      const container = containerRef.current;
      if (container && !container.contains(caret.node)) {
        return null;
      }

      const scope = getBlockElement(caret.node);
      if (!scope) return null;

      const offset = getOffsetWithinScope(scope, caret.node, caret.offset);
      const fullText = scope.textContent || "";
      if (!fullText.trim()) return null;

      if (trigger === "doubleTap" || tapBehavior === "sentence") {
        const sentenceSegment = findSentenceSegmentAtOffset(fullText, offset);
        if (!sentenceSegment) return null;

        return buildSelection({
          scope,
          startIndex: sentenceSegment.index,
          endIndex: sentenceSegment.index + sentenceSegment.segment.length,
          point,
          trigger,
          forcedKind: "sentence",
        });
      }

      const wordSegment = findWordSegmentAtOffset(fullText, offset);
      if (!wordSegment) return null;

      return buildSelection({
        scope,
        startIndex: wordSegment.index,
        endIndex: wordSegment.index + wordSegment.segment.length,
        point,
        trigger,
      });
    },
    [buildSelection, containerRef, getBlockElement, getOffsetWithinScope, tapBehavior]
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
    const nextSelection = getSelectionFromRange(range);

    if (!nextSelection) {
      setSelection(null);
      return;
    }

    setSelection(nextSelection);
  }, [getSelectionFromRange]);

  const clearPendingTap = useCallback(() => {
    if (tapTimeoutRef.current !== null) {
      window.clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
  }, []);

  const clearSelection = useCallback(() => {
    clearPendingTap();
    lastTapRef.current = null;
    setSelection(null);
    setSelectionNotice(null);
    window.getSelection()?.removeAllRanges();
  }, [clearPendingTap]);

  useEffect(() => {
    const handlePointerUp = (event: MouseEvent | TouchEvent) => {
      if (shouldIgnoreSelectionTarget(event.target)) {
        clearSelection();
        return;
      }

      const point = getEventPoint(event);

      window.setTimeout(() => {
        const browserSelection = window.getSelection();
        const hasSelection = Boolean(normalizeText(browserSelection?.toString() || ""));

        if (hasSelection) {
          handleSelectionChange();
          return;
        }

        if (!point || tapBehavior === "off") {
          setSelection(null);
          setSelectionNotice(null);
          return;
        }

        const now = Date.now();
        const lastTap = lastTapRef.current;
        const isDoubleTap =
          lastTap !== null &&
          now - lastTap.time < 320 &&
          Math.hypot(lastTap.x - point.x, lastTap.y - point.y) < 24;

        clearPendingTap();

        if (isDoubleTap) {
          lastTapRef.current = null;
          const doubleTapSelection = getSelectionFromPoint(point, "doubleTap");
          if (doubleTapSelection) {
            setSelectionNotice(null);
            setSelection(doubleTapSelection);
          }
          return;
        }

        lastTapRef.current = { ...point, time: now };
        tapTimeoutRef.current = window.setTimeout(() => {
          const tapSelection = getSelectionFromPoint(point, "tap");
          if (tapSelection) {
            setSelectionNotice(null);
            setSelection(tapSelection);
          }
        }, 220);
      }, 10);
    };

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseup", handlePointerUp);
    container.addEventListener("touchend", handlePointerUp);

    return () => {
      clearPendingTap();
      container.removeEventListener("mouseup", handlePointerUp);
      container.removeEventListener("touchend", handlePointerUp);
    };
  }, [clearPendingTap, clearSelection, containerRef, getSelectionFromPoint, handleSelectionChange, tapBehavior]);

  return { selection, clearSelection, isProcessing, selectionNotice };
}
