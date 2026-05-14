/**
 * Lots MetaAPI / MT5 : le forex utilise souvent 0.01, les indices (DJ30, US30…) souvent 1 contrat entier.
 */

const INDEX_STANDARDS = new Set([
  "US30",
  "NAS100",
  "GER40",
  "UK100",
  "SPX500",
]);

/** Symbole tel qu’envoyé au broker (ex. DJ30, US30.cash-ECN). */
export function isLikelyIndexMt5Symbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  const needles = [
    "DJ30",
    "US30",
    "NAS100",
    "GER40",
    "UK100",
    "SPX500",
    "WS30",
    "USTEC",
    "DE40",
  ];
  if (needles.some((n) => s.includes(n))) return true;
  if (/\.CASH/i.test(s) && /US30|NAS|GER40|UK100|SPX|DOW/i.test(s)) return true;
  return false;
}

export function lotStepForStandard(standardSymbol: string): {
  step: number;
  min: number;
} {
  if (INDEX_STANDARDS.has(standardSymbol)) {
    return { step: 1, min: 1 };
  }
  return { step: 0.01, min: 0.01 };
}

export function roundLotToStep(volume: number, step: number): number {
  if (!Number.isFinite(volume) || !Number.isFinite(step) || step <= 0) return volume;
  return Math.round(volume / step) * step;
}

/** Volume minimal total si plusieurs TP sur indice (chaque jambe ≥ 1 lot). */
export function effectiveUserVolumeForIndexSplit(
  standardSymbol: string,
  userVolume: number,
  tpCount: number,
): number {
  const { min } = lotStepForStandard(standardSymbol);
  if (!INDEX_STANDARDS.has(standardSymbol) || tpCount <= 1) return userVolume;
  return Math.max(userVolume, min * tpCount);
}

export function volumePerTpForStandard(
  standardSymbol: string,
  effectiveUserVolume: number,
  tpCount: number,
  tpIndex: number,
): number {
  const { step, min } = lotStepForStandard(standardSymbol);
  const roundLot = (v: number) => Math.max(min, roundLotToStep(v, step));

  if (tpCount <= 1) {
    return roundLot(effectiveUserVolume);
  }

  const slice = roundLot(effectiveUserVolume / tpCount);
  if (tpIndex < tpCount - 1) {
    return slice;
  }
  const assigned = slice * (tpCount - 1);
  return roundLot(effectiveUserVolume - assigned);
}

/** Dernière passe avant envoi MetaAPI (symbole broker déjà résolu). */
export function snapVolumeForMetaApiSymbol(mt5Symbol: string, volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return volume;
  if (isLikelyIndexMt5Symbol(mt5Symbol)) {
    const v = Math.max(1, Math.round(volume));
    return v;
  }
  return Math.round(volume * 100) / 100;
}
