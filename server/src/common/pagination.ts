type ParsePaginationInput = {
  limit?: string;
  offset?: string;
  defaultLimit?: number;
  maxLimit?: number;
  maxOffset?: number;
};

type ParsedPagination = {
  limit?: number;
  offset?: number;
};

const toFiniteNumber = (value?: string) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parsePagination = ({
  limit,
  offset,
  defaultLimit,
  maxLimit = 200,
  maxOffset = 50000
}: ParsePaginationInput): ParsedPagination => {
  const rawLimit = toFiniteNumber(limit);
  const rawOffset = toFiniteNumber(offset);
  const normalizedDefaultLimit = Number.isFinite(defaultLimit)
    ? Math.min(Math.max(Math.trunc(defaultLimit as number), 1), maxLimit)
    : undefined;

  const parsedLimit =
    rawLimit !== undefined
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), maxLimit)
      : normalizedDefaultLimit;

  const parsedOffset =
    rawOffset !== undefined
      ? Math.min(Math.max(Math.trunc(rawOffset), 0), maxOffset)
      : undefined;

  return {
    limit: parsedLimit,
    offset: parsedOffset
  };
};
