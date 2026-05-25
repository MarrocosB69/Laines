const EMAIL_DOMAIN = 'laines.ufrn.br';

const removeDiacritics = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeTokens = (fullName) => removeDiacritics(String(fullName || ''))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

export const generateInstitutionalEmail = (fullName, domain = EMAIL_DOMAIN) => {
  const tokens = normalizeTokens(fullName);
  if (tokens.length === 0) return '';

  const firstName = tokens[0];
  const lastName = tokens.length > 1 ? tokens[tokens.length - 1] : '';
  const localPart = lastName && lastName !== firstName
    ? `${firstName}.${lastName}`
    : firstName;

  return `${localPart}@${domain}`;
};
