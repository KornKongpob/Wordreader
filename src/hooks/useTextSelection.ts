"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TextSelection {
  text: string;
  sentence: string;
  position: { x: number; y: number };
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const isProcessing = useRef(false);

  // Extract the full sentence containing the selected text
  const getSentenceFromRange = useCallback((range: Range): string => {
    // Get the text node and expand to find sentence boundaries
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      return range.toString().trim();
    }

    const fullText = node.textContent || "";
    const offset = range.startOffset;

    // Find sentence start (look backward for . ! ? or start of text)
    let sentenceStart = 0;
    for (let i = offset - 1; i >= 0; i--) {
      if (".!?".includes(fullText[i])) {
        sentenceStart = i + 1;
        break;
      }
    }

    // Find sentence end (look forward for . ! ? or end of text)
    let sentenceEnd = fullText.length;
    for (let i = offset; i < fullText.length; i++) {
      if (".!?".includes(fullText[i])) {
        sentenceEnd = i + 1;
        break;
      }
    }

    return fullText.slice(sentenceStart, sentenceEnd).trim();
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (isProcessing.current) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      return;
    }

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();

    // Ignore empty or very long selections
    if (!text || text.length > 100) {
      return;
    }

    // Only handle selections within our container
    if (containerRef.current && !containerRef.current.contains(range.commonAncestorContainer)) {
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
  }, [containerRef, getSentenceFromRange]);

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
