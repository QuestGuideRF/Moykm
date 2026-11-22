const paths = {
  garage: '<path d="m3 10 9-6 9 6v10H3z"/><path d="M7 20v-7h10v7M7 16.5h10"/>',
  car: '<path d="m5 11 1.5-4.2A2.5 2.5 0 0 1 8.8 5h6.4a2.5 2.5 0 0 1 2.3 1.8L19 11M5 11h14a2 2 0 0 1 2 2v4H3v-4a2 2 0 0 1 2-2ZM5 17v2m14-2v2M7 14h1m8 0h1"/>',
  journal: '<rect x="5" y="3.5" width="15" height="17" rx="2.5"/><path d="M9 3.5v17m3.5-12h4m-4 4h4M3 8h3m-3 5h3m-3 5h3"/>',
  analytics: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 16v-3m4 3V8m4 8v-5"/>',
  parts: '<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z"/><path d="m3.5 7.5 8.5 4.7 8.5-4.7M12 12.2V21M8 5.1l8.5 4.6v3"/>',
  settings: '<path d="m9.5 4 .5-1h4l.5 2.3 1.8.9 2.1-.8 2 3.5-1.7 1.5v2.2l1.7 1.5-2 3.5-2.1-.8-1.8.9L14 20h-4l-.5-2.3-1.8-.9-2.1.8-2-3.5 1.7-1.5v-2.2L3.6 8.9l2-3.5 2.1.8 1.8-.9z"/><circle cx="12" cy="11.5" r="3"/>',
  route: '<circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="6.5" r="2.5"/><path d="M8 17.5h7.5a2.75 2.75 0 0 0 0-5.5h-7a2.75 2.75 0 0 1 0-5.5H16"/>',
  pin: '<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  fuel: '<path d="M4 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15m-11 0h13M4 10h10m0 3h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V9l-3-3m3 5h-1a2 2 0 0 1-2-2V7"/>',
  service: '<path d="M20.3 4.3a5.8 5.8 0 0 1-7.2 7.6L6 19a2.1 2.1 0 0 1-3-3l7.1-7.1A5.8 5.8 0 0 1 17.7 1.7l-3.5 3.5.6 3 3 .6z" transform="translate(.5 1)"/>',
  other: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18m-14 6h3m5 0h2"/>',
  range: '<path d="m20.5 3.5-6.6 17-3.2-7.2-7.2-3.2 17-6.6Z"/>',
  odometer: '<path d="M4.2 18a9 9 0 1 1 15.6 0H4.2ZM12 7v1m-5 3 .7.7m9.3-.7-.7.7M12 15l2.6-3"/><circle cx="12" cy="15" r="1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/>',
  drop: '<path d="M12 2.8C9.8 6.8 5.8 10.1 5.8 14.4a6.2 6.2 0 0 0 12.4 0c0-4.3-4-7.6-6.2-11.6ZM9 15c.2 1.2.8 1.8 1.6 2.1"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4m8-4v4m-8 7h2m4 0h2"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/>',
  edit: '<path d="m14.5 5.5 4 4M4 20l1-5 11-11a2.8 2.8 0 0 1 4 4L9 19l-5 1Z"/>',
  trash: '<path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6m4-6v6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="1.4"/><path d="m4 17 5-4 4 3 3-5 4 5"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  logout: '<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m-1-8h12m-4-4 4 4-4 4"/>',
  signal: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  warning: '<path d="M12 8v5m0 3v.1M10.5 4.5l-7.6 13a1.7 1.7 0 0 0 1.5 2.5h15.2a1.7 1.7 0 0 0 1.5-2.5l-7.6-13a1.7 1.7 0 0 0-3 0Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20v-1a4 4 0 0 1 4-4h7a4 4 0 0 1 4 4v1"/>',
};
export function icon(name, size = 22) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
}
const escapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => escapes[char]);
export const num = (value, digits = 0) => new Intl.NumberFormat('ru-RU', {maximumFractionDigits: digits}).format(value);
export const money = value => num(value, 2) + ' ₽';
export const calendarField = (label, name, value, {time = false, required = false} = {}) =>
  `<label class="field calendar-field"><span>${esc(label)}</span><input type="${time ? 'time' : 'date'}" name="${esc(name)}" value="${esc(value)}" ${time ? '' : 'min="1900-01-01" max="2199-12-31"'} ${required ? 'required' : ''}></label>`;
export const fuelUnits = {l100: 'л/100 км', kml: 'км/л', lkm: 'л/км'};
export function fuelRate(value, unit) {
  if (unit === 'kml') return value > 0 ? 100 / value : Infinity;
  if (unit === 'lkm') return value / 100;
  return Number(value);
}
export function canonicalFuelRate(value, unit) {
  const rate = unit === 'lkm' ? Number(value) * 100 : fuelRate(value, unit);
  return Math.round(rate * 1e6) / 1e6;
}
export function fuelRateText(value, unit) {
  return num(fuelRate(value, unit), unit === 'lkm' ? 4 : 2) + ' ' + fuelUnits[unit];
}
export const logo = () => '<span class="brand"><img src="assets/moykm-icon.svg" alt="" width="36" height="36"><span>Moykm</span></span>';
const moscow = 'Europe/Moscow';
export function nowLocal(shiftDays = 0) {
  const time = new Date(Date.now() + shiftDays * 86400000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', {
    timeZone: moscow, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(time).map(part => [part.type, part.value]));
  return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
}
export const today = () => nowLocal().slice(0, 10);
export const monthStart = () => today().slice(0, 7) + '-01';
export function fmtDate(value, options = {day: 'numeric', month: 'long'}) {
  if (!value) return '—';
  const date = new Date(String(value).slice(0, 10) + 'T12:00:00Z');
  return new Intl.DateTimeFormat('ru-RU', {...options, timeZone: moscow}).format(date);
}
export const sessionDate = value => new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: moscow,
}).format(new Date(value.replace(' ', 'T')));
export const types = {
  trip: ['Поездка', 'Поездки', 'route'],
  fuel: ['Заправка', 'Заправки', 'fuel'],
  service: ['Сервис', 'Сервис', 'service'],
  other: ['Прочее', 'Прочее', 'other'],
  fuel_level: ['Уточнить топливо', 'Уровень топлива', 'fuel'],
  odometer: ['Уточнить пробег', 'Корректировки пробега', 'odometer'],
};
export const fuels = ['АИ-92', 'АИ-95', 'АИ-98', 'АИ-100', 'Дизель', 'Газ', 'Другое'];
export const categories = ['Страховка', 'Парковка', 'Мойка', 'Платная дорога', 'Штраф', 'Налог', 'Аксессуары', 'Другое'];
export const accents = {
  orange: ['Оранжевый', '#c44d17'],
  teal: ['Бирюзовый', '#0b8277'], blue: ['Синий', '#336fe3'], violet: ['Фиолетовый', '#7655cd'],
  rose: ['Розовый', '#bc4275'], amber: ['Янтарный', '#ad6530'], emerald: ['Зелёный', '#328254'],
};
export const readLocal = (key, fallback = null) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
export function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
