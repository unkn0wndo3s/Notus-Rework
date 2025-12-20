"use client";

import DiffMatchPatch from "diff-match-patch";

// Common utility to adjust a cursor position (offset) when text changes.
// Used for both local cursor (in EditorEffects) and remote cursors (CursorOverlay).
export function adjustCursorPositionForTextChange(
  oldText: string,
  newText: string,
  cursorPos: number
): number {
  const normalize = (text: string) =>
    text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  const oldNorm = normalize(oldText);
  const newNorm = normalize(newText);

  if (oldNorm === newNorm) {
    return cursorPos;
  }

  const clampedPos = Math.max(0, Math.min(cursorPos, oldNorm.length));

  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldNorm, newNorm, false);
  dmp.diff_cleanupEfficiency(diffs);

  const mappedOffset = dmp.diff_xIndex(diffs, clampedPos);
  const boundedOffset = Math.max(0, Math.min(mappedOffset, newNorm.length));

  return boundedOffset;
}

