// T1 [F5] — runtime config: quality tiers, feature flags, ?dev parse (R5.2).

export enum QualityTier {
  Low = 'low',
  Mid = 'mid',
  High = 'high',
}

export interface AppConfig {
  /** ?dev in the URL -> expose the accuracy harness + overlays. */
  dev: boolean;
  /** Forced tier via ?tier=low|mid|high (testing / degrade proofs); undefined = auto-detect. */
  forcedTier?: QualityTier;
  /** Low-confidence threshold (design §4 / R1.2). */
  confidenceThreshold: number;
}

function parseTier(v: string | null): QualityTier | undefined {
  switch (v) {
    case 'low':
      return QualityTier.Low;
    case 'mid':
      return QualityTier.Mid;
    case 'high':
      return QualityTier.High;
    default:
      return undefined;
  }
}

/** Parse config from a URL search string (default: window.location.search). */
export function parseConfig(search = typeof window !== 'undefined' ? window.location.search : ''): AppConfig {
  const params = new URLSearchParams(search);
  return {
    dev: params.has('dev'),
    forcedTier: parseTier(params.get('tier')),
    confidenceThreshold: 0.2,
  };
}
