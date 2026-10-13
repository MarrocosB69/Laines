export function normalizeCpf(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidCpf(value: unknown): boolean {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (base: string) => {
    const sum = base.split('').reduce((acc, d, i) => acc + Number(d) * (base.length + 1 - i), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calcDigit(digits.slice(0, 9));
  const second = calcDigit(digits.slice(0, 9) + first);
  return digits === `${digits.slice(0, 9)}${first}${second}`;
}
