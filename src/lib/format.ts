const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function formatBig(n: number, digits = 2): string {
  if (!isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 1000) return sign + abs.toFixed(abs < 10 ? digits : 1);
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(abs) / 3));
  const scaled = abs / Math.pow(10, tier * 3);
  return sign + scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0) + SUFFIXES[tier];
}

export function formatDecimal(n: number, digits = 2): string {
  if (!isFinite(n)) return '∞';
  return n.toFixed(digits);
}
