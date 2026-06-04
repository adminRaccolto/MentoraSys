/**
 * Converte string "YYYY-MM-DD" de input type="date" para Date.
 * Usa meio-dia (T12:00:00) para evitar que a conversão UTC-3 → UTC
 * desloque a data para o dia anterior.
 */
export function parseLocalDate(s: string): Date {
  return new Date(`${s}T12:00:00`);
}
