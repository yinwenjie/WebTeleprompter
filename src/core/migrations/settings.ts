import type { Migration } from './runner';

/** Settings 迁移链（当前为 v1，无迁移）。读取时迁移并回写。 */
export const settingsMigrations: readonly Migration[] = [];
