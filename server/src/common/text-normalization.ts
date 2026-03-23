type JsonLike = Record<string, unknown> | Array<unknown>;

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Object.prototype.toString.call(value) === '[object Object]'
);

export const normalizeUnicodeText = (value: string) => (
  String(value || '')
    .replace(/^\uFEFF/, '')
    .normalize('NFC')
);

export const normalizeDeepUnicode = <T = unknown>(input: T, seen = new WeakSet<JsonLike>()): T => {
  if (typeof input === 'string') {
    return normalizeUnicodeText(input) as T;
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  if (input instanceof Date || Buffer.isBuffer(input) || input instanceof Uint8Array) {
    return input;
  }

  if (Array.isArray(input)) {
    if (seen.has(input)) return input;
    seen.add(input);
    for (let index = 0; index < input.length; index += 1) {
      input[index] = normalizeDeepUnicode(input[index], seen);
    }
    return input as T;
  }

  if (!isPlainObject(input)) {
    return input;
  }

  if (seen.has(input)) return input;
  seen.add(input);

  const mutableInput = input as Record<string, unknown>;
  Object.keys(mutableInput).forEach((key) => {
    mutableInput[key] = normalizeDeepUnicode(mutableInput[key], seen);
  });

  return input;
};
