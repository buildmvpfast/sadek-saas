/**
 * Lots MetaAPI / MT5 : forex 0.01 ; indices (DJ30.s, NAS100.s…) souvent pas 0.01 — step 0.1 / min 0.1 sur VT ECN.
 */

const INDEX_STANDARDS = new Set([
  "US30",
  "NAS100",
  "GER40",
  "UK100",
  "SPX500",
]);

export function isIndexStandard(standardSymbol: string): boolean {
  return INDEX_STANDARDS.has(standardSymbol);
}

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
    return { step: 0.1, min: 0.1 };
  }
  return { step: 0.01, min: 0.01 };
}

export function roundLotToStep(volume: number, step: number): number {
  if (!Number.isFinite(volume) || !Number.isFinite(step) || step <= 0) return volume;
  return Math.round(volume / step) * step;
}

/**
 * Volume total minimal si on répartit sur plusieurs TP (forex / index en mode multi-ordres).
 * Ne gonfle le total que si une répartition égale passerait sous le lot mini par jambe.
 */
export function effectiveUserVolumeForIndexSplit(
  standardSymbol: string,
  userVolume: number,
  tpCount: number,
): number {
  const { min } = lotStepForStandard(standardSymbol);
  if (tpCount <= 1) return userVolume;
  const per = userVolume / tpCount;
  if (per + 1e-9 >= min) return userVolume;
  return min * tpCount;
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
    const step = 0.1;
    const minV = 0.1;
    const snapped = Math.round(volume / step) * step;
    return Math.max(minV, snapped);
  }
  return Math.round(volume * 100) / 100;
}
