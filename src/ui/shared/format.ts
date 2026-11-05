const twoDigits = new Intl.NumberFormat('zh-CN', { minimumIntegerDigits: 2, useGrouping: false });
const plain = new Intl.NumberFormat('zh-CN', { useGrouping: false });

/** 毫秒 → m:ss 或 h:mm:ss。非有限值返回 --:--。 */
export function formatClock(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '--:--';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${plain.format(h)}:${twoDigits.format(m)}:${twoDigits.format(s)}`
    : `${plain.format(m)}:${twoDigits.format(s)}`;
}

export const numberFormat = new Intl.NumberFormat('zh-CN');
