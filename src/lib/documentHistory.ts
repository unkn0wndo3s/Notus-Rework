import { prisma } from "./prisma";

/**
 * Debounce system to reduce history insertions in the database.
 * An entry is only created after a timeout period of inactivity (10 seconds).
 */
interface PendingHistoryEntry {
  documentId: number;
  userId?: number;
  userEmail?: string | null;
  previousContent: string | null;
  nextContent: string;
  timeout: NodeJS.Timeout;
  lastUpdate: number;
}

const pendingHistoryEntries = new Map<string, PendingHistoryEntry>();

const HISTORY_DEBOUNCE_MS = 10000; // 10 seconds of inactivity before saving

function getHistoryKey(documentId: number, userId?: number, userEmail?: string | null): string {
  return `${documentId}:${userId ?? 'null'}:${userEmail ?? 'null'}`;
}

/**
 * Extracts the text stored in a document's `content` field.
 * Content can be either raw string, or a JSON string
 * containing an object { text: string; timestamp?: number }.
 */
function tryParseJsonText(raw: string): string | null {
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw) as { text?: unknown };
      if (typeof parsed?.text === "string") {
        return parsed.text;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

export function extractTextFromStoredContent(stored: unknown): string {
  if (!stored) return "";

  if (typeof stored === "string") {
    const raw = stored.trim();
    if (!raw) return "";
    return tryParseJsonText(raw) ?? raw;
  }

  if (stored !== null && typeof stored === "object") {
    try {
      return JSON.stringify(stored);
    } catch {
      return "";
    }
  }

  return String(stored as any);
}

export interface TextDiff {
  added: string;
  removed: string;
}

/**
 * Computes a very simple diff between two texts:
 * - find common prefix
 * - then common suffix
 * - everything that differs in between is considered added/removed
 *
 * The goal is to summarize a complete "send", not to produce an exhaustive diff.
 */
export function computeTextDiff(previous: string, next: string): TextDiff {
  if (previous === next) {
    return { added: "", removed: "" };
  }

  const prevLen = previous.length;
  const nextLen = next.length;
  const minLen = Math.min(prevLen, nextLen);

  let start = 0;
  while (start < minLen && previous[start] === next[start]) {
    start++;
  }

  let endPrev = prevLen;
  let endNext = nextLen;

  while (
    endPrev > start &&
    endNext > start &&
    previous[endPrev - 1] === next[endNext - 1]
  ) {
    endPrev--;
    endNext--;
  }

  const removed = previous.slice(start, endPrev);
  const added = next.slice(start, endNext);

  return { added, removed };
}

interface RecordHistoryParams {
  documentId: number;
  userId?: number;
  userEmail?: string | null;
  previousContent?: string | null;
  nextContent: string;
}

/**
 * Actually records a history entry in the database.
 */
async function commitHistoryEntry({
  documentId,
  userId,
  userEmail,
  previousContent,
  nextContent,
}: RecordHistoryParams): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  // Normaliser les textes pour le diff
  const prevText = extractTextFromStoredContent(previousContent ?? "");
  const nextText = extractTextFromStoredContent(nextContent);

  if (prevText === nextText) {
    // Nothing changed, no need for history entry
    return;
  }

  const { added, removed } = computeTextDiff(prevText, nextText);

  try {
    await prisma.documentHistory.create({
      data: {
        document_id: documentId,
        user_id: typeof userId === "number" ? userId : null,
        user_email: userEmail ?? null,
        snapshot_before: previousContent ?? null,
        snapshot_after: nextContent,
        diff_added: added || null,
        diff_removed: removed || null,
      },
    } as any);
  } catch (error) {
    console.error("❌ Error recording document history:", error);
  }
}

/**
 * Records a history entry for a document with debounce.
 * - Uses a debounce system to group rapid modifications.
 * - Only creates an entry after 10 seconds of inactivity.
 * - If a new modification arrives before the timeout, cancels previous timeout and restarts.
 */
export async function recordDocumentHistory({
  documentId,
  userId,
  userEmail,
  previousContent,
  nextContent,
}: RecordHistoryParams): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  const key = getHistoryKey(documentId, userId, userEmail);
  const now = Date.now();

  // If a pending entry already exists, cancel its timeout
  const existing = pendingHistoryEntries.get(key);
  if (existing) {
    clearTimeout(existing.timeout);
    // Update with new content, but keep original previousContent
    existing.nextContent = nextContent;
    existing.lastUpdate = now;
  } else {
    // Create a new pending entry
    const entry: PendingHistoryEntry = {
      documentId,
      userId,
      userEmail,
      previousContent: previousContent ?? null,
      nextContent,
      timeout: setTimeout(() => {}, 0), // Will be replaced below
      lastUpdate: now,
    };
    pendingHistoryEntries.set(key, entry);
  }

  // Create a new timeout that will record history after inactivity delay
  const entry = pendingHistoryEntries.get(key)!;
  entry.timeout = setTimeout(async () => {
    // Check that entry hasn't been modified in the meantime
    const current = pendingHistoryEntries.get(key);
    if (current && current.lastUpdate === entry.lastUpdate) {
      // Record history
      await commitHistoryEntry({
        documentId: entry.documentId,
        userId: entry.userId,
        userEmail: entry.userEmail,
        previousContent: entry.previousContent,
        nextContent: entry.nextContent,
      });
      // Remove from Map
      pendingHistoryEntries.delete(key);
    }
  }, HISTORY_DEBOUNCE_MS);
}

/**
 * Forces immediate recording of history (no debounce).
 * Useful for explicit HTTP saves where we want to record immediately.
 */
export async function recordDocumentHistoryImmediate({
  documentId,
  userId,
  userEmail,
  previousContent,
  nextContent,
}: RecordHistoryParams): Promise<void> {
  // Cancel any pending entry for this key
  const key = getHistoryKey(documentId, userId, userEmail);
  const existing = pendingHistoryEntries.get(key);
  if (existing) {
    clearTimeout(existing.timeout);
    pendingHistoryEntries.delete(key);
    // Use previousContent from pending entry if available
    previousContent = existing.previousContent ?? previousContent ?? null;
    nextContent = existing.nextContent;
  }

  // Record immediately
  await commitHistoryEntry({
    documentId,
    userId,
    userEmail,
    previousContent,
    nextContent,
  });
}


