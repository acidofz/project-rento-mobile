export function formatPriceSom(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} сум`;
}
