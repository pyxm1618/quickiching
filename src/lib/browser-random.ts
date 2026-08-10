export type BrowserRandomBit = () => boolean;
export type BrowserRandomInt = (maxExclusive: number) => number;

function requireWebCrypto(): Crypto {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("WEB_CRYPTO_UNAVAILABLE");
  }
  return globalThis.crypto;
}

export const browserRandomBit: BrowserRandomBit = () => {
  const bytes = new Uint8Array(1);
  requireWebCrypto().getRandomValues(bytes);
  return (bytes[0] & 1) === 1;
};

export const browserRandomInt: BrowserRandomInt = (maxExclusive) => {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("RANDOM_INVALID_RANGE");
  }

  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const values = new Uint32Array(1);
  let value = 0;
  do {
    requireWebCrypto().getRandomValues(values);
    value = values[0];
  } while (value >= limit);

  return value % maxExclusive;
};
