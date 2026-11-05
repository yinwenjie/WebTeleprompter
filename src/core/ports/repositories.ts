import type { Script } from '../models/script';
import type { Settings } from '../models/settings';

export type StorageErrorKind = 'quota' | 'unavailable' | 'corrupt' | 'unknown';

/** Repository 把浏览器的各种异常归一化为此错误；是否提示用户由 state/ui 决定。 */
export class StorageError extends Error {
  readonly kind: StorageErrorKind;

  constructor(kind: StorageErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
    this.kind = kind;
  }
}

export interface RepositoryOpenResult {
  /** true 表示 IndexedDB 不可用，已降级为内存 + localStorage，需要常驻提示。 */
  degraded: boolean;
  /** 本次打开时被隔离的损坏稿件数量。 */
  quarantinedCount: number;
}

export interface QuarantinedRecord {
  key: string;
  raw: unknown;
  reason: string;
}

export type MetaKey = 'activeScriptId' | 'seededSample';

/** 稿件仓储。所有方法只抛 StorageError。 */
export interface ScriptRepository {
  open(): Promise<RepositoryOpenResult>;
  list(): Promise<Script[]>;
  get(id: string): Promise<Script | undefined>;
  put(script: Script): Promise<void>;
  remove(id: string): Promise<void>;
  getMeta<T>(key: MetaKey): Promise<T | undefined>;
  setMeta<T>(key: MetaKey, value: T): Promise<void>;
  listQuarantined(): Promise<QuarantinedRecord[]>;
}

/** 设置仓储。同步接口：首屏前必须读到设置，防止闪烁。 */
export interface SettingsRepository {
  /** 读取并迁移；损坏时返回默认值。永不抛错。 */
  load(): Settings;
  /** 配额超限等情况抛 StorageError。 */
  save(settings: Settings): void;
}

export interface ProgressPoint {
  progress: number;
  positionPx: number;
  savedAt: number;
}

/**
 * 同步暂存区（localStorage）。承接“来不及写 IndexedDB”的两类数据：
 * - 草稿：编辑中崩溃保护（架构 §5.2 的 wtp.draft.*）
 * - 播放位置：pagehide 时 IndexedDB 事务不保证完成（D-09 新增 wtp.progress.*）
 */
export interface ScratchStore {
  readDraft(scriptId: string): string | null;
  writeDraft(scriptId: string, text: string): void;
  removeDraft(scriptId: string): void;
  readProgress(scriptId: string): ProgressPoint | null;
  writeProgress(scriptId: string, point: ProgressPoint): void;
  removeProgress(scriptId: string): void;
}
