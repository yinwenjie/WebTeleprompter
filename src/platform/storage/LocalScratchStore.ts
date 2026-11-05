import { notImplemented } from '@/core/not-implemented';
import type { ProgressPoint, ScratchStore } from '@/core/ports/repositories';

export class LocalScratchStore implements ScratchStore {
  readDraft(_scriptId: string): string | null {
    return notImplemented('LocalScratchStore.readDraft');
  }

  writeDraft(_scriptId: string, _text: string): void {
    notImplemented('LocalScratchStore.writeDraft');
  }

  removeDraft(_scriptId: string): void {
    notImplemented('LocalScratchStore.removeDraft');
  }

  readProgress(_scriptId: string): ProgressPoint | null {
    return notImplemented('LocalScratchStore.readProgress');
  }

  writeProgress(_scriptId: string, _point: ProgressPoint): void {
    notImplemented('LocalScratchStore.writeProgress');
  }

  removeProgress(_scriptId: string): void {
    notImplemented('LocalScratchStore.removeProgress');
  }
}
