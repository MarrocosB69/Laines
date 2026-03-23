import type { Request } from 'express';

const splitCookieHeader = (cookieHeader: string) => {
  return cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean);
};

export const readCookie = (request: Request, cookieName: string) => {
  const normalizedName = String(cookieName || '').trim();
  if (!normalizedName) return '';
  const cookieHeader = String(request.headers.cookie || '').trim();
  if (!cookieHeader) return '';

  const entry = splitCookieHeader(cookieHeader).find((chunk) => chunk.startsWith(`${normalizedName}=`));
  if (!entry) return '';
  const [, ...valueParts] = entry.split('=');
  if (valueParts.length === 0) return '';
  try {
    return decodeURIComponent(valueParts.join('='));
  } catch {
    return valueParts.join('=');
  }
};
