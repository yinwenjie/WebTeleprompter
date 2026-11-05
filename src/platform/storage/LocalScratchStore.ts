import type { ProgressPoint, ScratchStore } from '@/core/ports/repositories';
import { readItem, removeItem, writeItem } from './safeStorage';
import { lsKeyDraft, lsKeyProgress } from './schema';

function parseProgress(raw: string | null): ProgressPoint | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<ProgressPoint> | null;
    if (typeof value !== 'object' || value === null) return null;
    const { progress, positionPx, savedAt } = value;
    if (
      ![progress, positionPx, savedAt].every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      return null;
    }
    if (progress! < 0 || progress! > 1 || positionPx! < 0) return null;
    return { progress: progress!, positionPx: positionPx!, savedAt: savedAt! };
  } catch {
    return null;
  }
}

export class LocalScratchStore implements ScratchStore {
  readDraft(scriptId: string): string | null {
    return readItem(lsKeyDraft(scriptId));
  }

  writeDraft(scriptId: string, text: string): void {
    writeItem(lsKeyDraft(scriptId), text);
  }

  removeDraft(scriptId: string): void {
    removeItem(lsKeyDraft(scriptId));
  }

  readProgress(scriptId: string): ProgressPoint | null {
    return parseProgress(readItem(lsKeyProgress(scriptId)));
  }

  writeProgress(scriptId: string, point: ProgressPoint): void {
    writeItem(lsKeyProgress(scriptId), JSON.stringify(point));
  }

  removeProgress(scriptId: string): void {
    removeItem(lsKeyProgress(scriptId));
  }
}
