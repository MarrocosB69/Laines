import { toDate } from "./dateUtils";

const normalizeCpf = (value = "") => String(value).replace(/\D/g, "");

const isValidCpf = (value) => {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcCheckDigit = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (base.length + 1 - i);
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calcCheckDigit(digits.slice(0, 9));
  const secondDigit = calcCheckDigit(digits.slice(0, 9) + firstDigit);

  return digits === `${digits.slice(0, 9)}${firstDigit}${secondDigit}`;
};

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isPastDate = (value) => {
  const date = toDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
};

export { normalizeCpf, isValidCpf, isValidEmail, isPastDate };
