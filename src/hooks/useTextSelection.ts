"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TextSelection {
  text: string;
  sentence: string;
  position: { x: number; y: number };
}

interface UseTextSelectionOptions {
  maxLength?: number;
}

export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseTextSelectionOptions = {}
) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const isProcessing = useRef(false);
  const maxLength = options.maxLength ?? 100;

  const getSentenceFromRange = useCallback((range: Range): string => {
    const selectedText = range.toString().trim();
    if (!selectedText) return "";

    const container = containerRef.current;
    let scope: Node = range.commonAncestorContainer;

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
      for (let i = startIndex - 1; i >= 0; i--) {
        if (".!?\n".includes(fullText[i])) {
          sentenceStart = i + 1;
          break;
        }
      }

      let sentenceEnd = fullText.length;
      for (let i = endIndex; i < fullText.length; i++) {
        if (".!?\n".includes(fullText[i])) {
          sentenceEnd = i + 1;
          break;
        }
      }

      return fullText.slice(sentenceStart, sentenceEnd).replace(/\s+/g, " ").trim();
    } catch {
      return selectedText;
    }
  }, [containerRef]);

  const handleSelectionChange = useCallback(() => {
    if (isProcessing.current) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();

    // Ignore empty or very long selections
    if (!text || text.length > maxLength) {
      setSelection(null);
      return;
    }

    // Only handle selections within our container
    if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    // Get position for the popup
    const rect = range.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    };

    // Get the sentence
    const sentence = getSentenceFromRange(range);

    setSelection({ text, sentence, position });
  }, [containerRef, getSentenceFromRange, maxLength]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    // Use mouseup/touchend to detect selection (more reliable on mobile Safari)
    const handleMouseUp = () => {
      // Small delay to let the browser finalize the selection
      setTimeout(handleSelectionChange, 10);
    };

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("touchend", handleMouseUp);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("touchend", handleMouseUp);
    };
  }, [containerRef, handleSelectionChange]);

  return { selection, clearSelection, isProcessing };
}
