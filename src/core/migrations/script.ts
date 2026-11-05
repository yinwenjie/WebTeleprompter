import type { Migration } from './runner';

/** Script 迁移链（当前为 v1，无迁移）。新增版本时追加，并同步递增 IndexedDB 版本号。 */
export const scriptMigrations: readonly Migration[] = [];
