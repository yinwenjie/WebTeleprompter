import type { Migration } from './runner';

/** ExportBundle 外壳的迁移链（当前为 v1，无迁移）。内部的稿件走 scriptMigrations。 */
export const bundleMigrations: readonly Migration[] = [];
