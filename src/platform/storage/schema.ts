/** 本地存储 schema（架构 §5.2 + D-09）。键名只在此处定义。 */
export const IDB_NAME = 'wtp';
/** 与 Script.schemaVersion 同步递增。 */
export const IDB_VERSION = 1;
export const IDB_STORE_SCRIPTS = 'scripts';
export const IDB_STORE_META = 'meta';
export const IDB_INDEX_UPDATED_AT = 'updatedAt';
export const META_KEY_QUARANTINE = 'quarantine';

export const LS_KEY_SETTINGS = 'wtp.settings';
/** FallbackScriptRepository 的尽力镜像。 */
export const LS_KEY_FALLBACK_SCRIPTS = 'wtp.fallback.scripts';
export const lsKeyDraft = (scriptId: string) => `wtp.draft.${scriptId}`;
export const lsKeyProgress = (scriptId: string) => `wtp.progress.${scriptId}`;
