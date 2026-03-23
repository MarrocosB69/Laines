import type { Request } from 'express';

const normalizeForwardedFor = (value: string) => {
  const first = (value || '').split(',')[0]?.trim();
  if (!first) return '';
  if (first.startsWith('::ffff:')) {
    return first.slice(7);
  }
  return first;
};

export const extractClientIp = (req: Request) => {
  const rawIp = String(req.ip || '');
  if (rawIp) {
    if (rawIp.startsWith('::ffff:')) {
      return rawIp.slice(7);
    }
    return rawIp;
  }

  const forwarded = req.headers['x-forwarded-for'];
  const rawForwarded = Array.isArray(forwarded)
    ? String(forwarded[0] || '')
    : String(forwarded || '');
  const forwardedIp = normalizeForwardedFor(rawForwarded);
  if (forwardedIp) return forwardedIp;
  return 'unknown';
};
