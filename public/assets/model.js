const rounded = (value, digits = 2) => {
  const multiplier = 10 ** digits;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};
export function averageSpeed(km, seconds) {
  const distance = Number(km);
  const duration = Number(seconds);
  return Number.isFinite(distance) && distance > 0 && Number.isFinite(duration) && duration > 0
    ? rounded(distance * 3600 / duration, 1) : null;
}
export function durationLabel(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = seconds % 60;
  return [hours && `${hours} ч`, minutes && `${minutes} мин`, rest && `${rest} с`].filter(Boolean).join(' ');
}
export const MAX_TRIP_SECONDS = 2592000;
export const durationUnits = {seconds: ['Секунды', 1], minutes: ['Минуты', 60], hours: ['Часы', 3600]};
export function durationInput(seconds) {
  const elapsed = Math.min(Number(seconds) || 0, MAX_TRIP_SECONDS);
  const unit = elapsed >= 3600 ? 'hours' : elapsed >= 60 ? 'minutes' : 'seconds';
  return {unit, value: elapsed ? Number((elapsed / durationUnits[unit][1]).toFixed(6)) : ''};
}
export function fuelCalculation(values, fields) {
  if (fields.length !== 2) return null;
  const numbers = Object.fromEntries(fields.map(key => [key, Number(String(values[key]).replace(',', '.'))]));
  if (fields.some(key => !Number.isFinite(numbers[key]) || numbers[key] <= 0)) return null;
  const missing = ['liters', 'price', 'cost'].find(key => !fields.includes(key));
  if (missing === 'liters') numbers.liters = rounded(numbers.cost / numbers.price);
  if (missing === 'price') numbers.price = rounded(numbers.cost / numbers.liters);
  if (missing === 'cost') numbers.cost = rounded(numbers.liters * numbers.price);
  if (numbers.liters <= 0 || numbers.liters > 500 || numbers.price <= 0 || numbers.price > 100000
      || numbers.cost <= 0 || numbers.cost > 50000000) return null;
  return {missing, ...numbers};
}
