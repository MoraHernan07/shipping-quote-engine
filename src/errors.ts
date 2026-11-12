export type QuoteErrorCode =
  | 'EMPTY_CART'
  | 'INVALID_QUANTITY'
  | 'INVALID_PRODUCT'
  | 'INVALID_POSTAL_CODE'
  | 'UNKNOWN_POSTAL_CODE'
  | 'UNKNOWN_MANUFACTURER'
  | 'NO_CARRIER_AVAILABLE';

/** A request that cannot be quoted automatically. Callers can fall back to a manual quote. */
export class QuoteError extends Error {
  constructor(
    readonly code: QuoteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'QuoteError';
  }
}

/** The engine configuration is inconsistent. Raised once, when the engine is created. */
export class ConfigError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid engine config:\n- ${issues.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}
