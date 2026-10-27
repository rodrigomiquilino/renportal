export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): { score: PasswordScore; label: string } {
  if (!password) return { score: 0, label: 'Digite uma senha' };
  if (password.length < 8) return { score: 1, label: 'Use pelo menos 8 caracteres' };

  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  else if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  const capped = Math.min(4, score) as PasswordScore;
  const labels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'] as const;
  return { score: capped, label: labels[capped] };
}

export function passwordAcceptable(password: string): boolean {
  return password.length >= 8 && passwordStrength(password).score >= 2;
}
