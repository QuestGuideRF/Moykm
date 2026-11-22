import {calendarField, categories, esc, fmtDate, fuelRate, fuelRateText, fuels, fuelUnits, icon, money, nowLocal, num, today, types} from './ui.js';
import {btn, drives, entryTitle, iconBtn} from './views.js';
import {custom, engines, legacy, makes, modelOptions, transmissions} from './car-catalog.js';
import {averageSpeed, durationInput, durationLabel, durationUnits} from './model.js';
const markup = (...args) => args.join('');
const input = (label, name, value = '', attributes = '') =>
  `<label class="field">${esc(label)}<input name="${name}" value="${esc(value)}" ${attributes}></label>`;
const numeric = (label, name, value, min, max, {step = '0.01', required = true} = {}) =>
  input(label, name, value, `type="number" inputmode="${step === '1' ? 'numeric' : 'decimal'}" min="${min}" max="${max}" step="${step}" ${required ? 'required' : ''}`);
const select = (label, name, options, value, extra = '') =>
  `<label class="field">${esc(label)}<select name="${name}" ${extra}>${options.map(item => {
    const [key, title] = Array.isArray(item) ? item : [item, item];
    return `<option value="${esc(key)}" ${String(value ?? '') === String(key) ? 'selected' : ''}>${esc(title)}</option>`;
  }).join('')}</select></label>`;
const check = (label, name, checked = false, value = '1') =>
  `<label class="checkbox"><input type="checkbox" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}>${esc(label)}</label>`;
const note = value => `<label class="field">Заметка<textarea name="note" maxlength="1000" rows="2">${esc(value)}</textarea></label>`;
const extraFields = content => `<details class="form-more"><summary>Дополнительно</summary><div class="form-details">${content}</div></details>`;
export const errorMarkup = '<p class="form-error" role="alert"></p>';
function formActions(remove = '') {
  return `<div class="form-actions">${remove}${btn('Отмена', 'close-panel')}<button class="button primary" type="submit">Сохранить</button></div>`;
}
export function panel(title, content, subtitle = '') {
  return `<header class="panel-header"><div><h2 id="panel-title">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${iconBtn('Закрыть форму', 'close-panel', 'close', 'autofocus')}</header>${content}`;
}
export function carForm(car = {}) {
  const yearMax = Number(today().slice(0, 4)) + 1;
  const specs = car.specs || {};
  const brand = specs.brand ? (Object.hasOwn(makes, specs.brand) ? specs.brand : custom) : car.name ? legacy : '';
  const model = brand && makes[brand] ? (makes[brand].includes(specs.model) ? specs.model : custom) : '';
  const optional = {required: false};
  const whole = {...optional, step: '1'};
  const vinFields = `
    ${input('VIN', 'vin', car.vin, 'minlength="17" maxlength="17" spellcheck="false" autocomplete="off" autocapitalize="characters"')}
    ${btn('Найти по VIN', 'lookup-vin', 'search', car.id ? 'button' : 'button primary')}
    <p class="form-result" id="vin-result" role="status"></p>`;
  return `<form id="car-form" class="form-stack" data-id="${Number(car.id || 0)}">
    ${car.id ? '' : `<div id="car-vin-step" class="form-stack">${vinFields}${btn('Ввести вручную', 'car-manual', '', 'button')}</div>`}
    <div id="car-identification" class="form-stack" ${car.id ? '' : 'hidden'}>
    ${car.id ? '' : btn('Выбрать Nissan Note NISMO', 'note-preset', 'car', 'preset-button button')}
    <div class="form-grid-2">
      ${select('Марка', 'brand_choice', [['', 'Выберите марку'], ...Object.keys(makes), [custom, 'Другая марка'], [legacy, 'Своё название']], brand, 'required')}
      <label class="field">Модель<select name="model_choice" required>${modelOptions(brand, model)}</select></label>
    </div>
    ${input('Другая марка', 'brand_custom', specs.brand, 'required maxlength="28"')}
    ${input('Другая модель', 'model_custom', specs.model, 'required maxlength="28"')}
    ${input('Название', 'name', car.name, 'required maxlength="80"')}
    ${select('Поколение', 'generation_choice', [['', 'Другое или неизвестно']], '')}
    ${select('Двигатель и версия', 'variant', [['', 'Другой или неизвестен']], '')}
    ${car.id ? `<details class="form-more"><summary>Поиск по VIN</summary><div class="form-details">${vinFields}</div></details>`
    : `<div class="form-actions">${btn('Назад', 'car-vin', '', 'text-button')}${btn('Далее', 'car-next', 'right', 'button primary')}</div>`}
    </div>
    ${errorMarkup}
    <div id="car-confirmation" class="form-stack" ${car.id ? '' : 'hidden'}>
    ${car.id ? '' : '<strong id="car-selection-summary"></strong>'}
    <div class="form-grid-2">${numeric('Год выпуска', 'year', car.year, 1900, yearMax, whole)}
      ${input('Госномер', 'plate', car.plate, 'maxlength="20"')}</div>
    ${numeric('Начальный пробег, км', 'initial_odometer', car.initial_odometer, 0, 99999999.99)}
    <details class="form-more" id="car-fuel"><summary>Топливо</summary><div class="form-details">
      ${select('Вид топлива', 'fuel_type', [['', 'Не указано'], ...fuels], car.fuel_type)}
      <div class="form-grid-2">${numeric('Объём бака, л', 'tank_capacity', car.tank_capacity, 1, 500, optional)}
        ${numeric('Расход, л/100 км', 'base_consumption', car.base_consumption, 0.5, 100, optional)}</div>
      ${numeric('Начальный остаток, л', 'initial_fuel', car.initial_fuel, 0, 500, optional)}
      <div class="fuel-shortcuts">${[['¼ бака', .25], ['½ бака', .5], ['Полный бак', 1]].map(([label, value]) => btn(label, 'fuel-level', '', 'button', `data-level="${value}"`)).join('')}</div>
    </div></details>
    <details class="form-more"><summary>Двигатель и характеристики</summary><div class="form-details">
      <div class="form-grid-2">${input('Комплектация', 'trim', specs.trim, 'maxlength="22"')}${input('Поколение', 'generation', specs.generation, 'maxlength="18"')}</div>
      <div class="form-grid-2">${select('Двигатель', 'engine', [['', 'Не указан'], ...Object.entries(engines)], specs.engine)}
        ${numeric('Объём двигателя, л', 'displacement', specs.displacement, 0.1, 20, optional)}</div>
      <div class="form-grid-2"><label class="field"><span id="car-power-label">Мощность, л. с.</span><input type="number" inputmode="numeric" name="power" min="1" max="3000" value="${esc(specs.power)}"></label>
        ${numeric('После доработки, л. с.', 'custom_power', specs.custom_power, 1, 3000, whole)}</div>
      <div class="form-grid-2">${select('Коробка передач', 'transmission', [['', 'Не указана'], ...Object.entries(transmissions)], specs.transmission)}
        ${select('Привод', 'drive', [['', 'Не указан'], ...Object.entries(drives)], car.drive)}</div>
      <div id="haldex-choice" ${car.drive === 'awd' ? '' : 'hidden'}>${check('Установлена муфта Haldex', 'haldex', !!Number(car.haldex))}</div>
    </div></details>
    <details class="form-more"><summary>Фото машины</summary><div class="form-details">
      ${input('Фото машины', 'photo', '', 'type="file" accept="image/*"')}
      ${Number(car.has_photo) ? check('Удалить текущее фото', 'remove_photo') : ''}
    </div></details>
    ${car.id ? '' : btn('Назад', 'car-back', '', 'text-button')}${formActions()}</div></form>`;
}
export function entryChooser() {
  return `<div class="chooser">${Object.entries(types).map(([type, [title, , glyph]]) =>
    btn(title, 'new-entry', glyph, 'button', `data-type="${type}"`)).join('')}</div>`;
}
export function canRepeat(entry) {
  return entry && ['service', 'other'].includes(entry.type) && !entry.pending && !entry.data.historical;
}
export function entryTemplates(entries) {
  return entries.map(entry => btn(entryTitle(entry), 'use-entry-template', '', 'button',
    `data-id="${Number(entry.id)}"`)).join('');
}
function tripFields(entry, date, savedDraft, unit) {
  const route = entry?.data.route;
  const seconds = savedDraft ? savedDraft.duration : entry?.data.duration_seconds;
  const duration = durationInput(seconds);
  const consumption = savedDraft?.consumption ?? (entry?.data.consumption == null
    ? '' : Number(fuelRate(entry.data.consumption, unit).toPrecision(12)));
  return `${numeric('Расстояние, км', 'distance', savedDraft?.distance ?? entry?.data.distance, 0.01, 100000)}
    <div class="form-grid-2 duration-fields">${input('Время в пути', 'duration_value', duration.value, 'type="number" inputmode="decimal" min="0" step="any"')}
    ${select('Единицы времени', 'duration_unit', Object.entries(durationUnits).map(([key, [title]]) => [key, title]), duration.unit)}</div>
    ${input(`Расход, ${fuelUnits[unit]}`, 'consumption', consumption, 'type="number" inputmode="decimal" min="0" step="any" placeholder="Необязательно"')}
    <p class="speed-preview" id="speed-preview" aria-live="polite"></p>
    <p class="form-result" id="entry-preview" aria-live="polite"></p>
    <div class="trip-tools">
      ${btn(seconds ? 'Продолжить таймер' : 'Запустить таймер', 'trip-timer', 'clock', 'button', 'id="trip-timer"')}
      ${btn('Записать с GPS', 'gps-start', 'signal', 'button', 'id="gps-start"')}
      ${btn('Остановить GPS', 'gps-stop', '', 'button gps-recording', 'id="gps-stop" hidden')}
    </div>
    <div id="gps-status" role="status"></div>
    ${route ? `<p class="help" id="saved-route-label">Сохранено ${num(route.points_count)} точек маршрута.</p>` : ''}
    ${btn('Удалить трек', 'gps-clear', 'trash', 'text-button', `id="gps-clear" ${route || savedDraft?.points?.length ? '' : 'hidden'}`)}
    ${extraFields(markup(date, note(savedDraft?.note ?? entry?.note)))}`;
}
function fuelEntryFields(detail, entry, date) {
  const previous = detail.last_fuel;
  const data = entry?.data;
  const optional = {required: false};
  return `<div class="form-grid-3 fuel-fields">${numeric('Литры', 'liters', data?.liters, 0.01, 500, optional)}
    ${numeric('Цена, ₽/л', 'price', data?.price ?? previous?.price, 0.01, 100000, optional)}
    ${numeric('Сумма, ₽', 'cost', entry?.cost, 0.01, 50000000, optional)}</div>
    <p class="form-result" id="entry-preview" aria-live="polite"></p>
    ${check('Полный бак', 'full', data?.full)}
    ${extraFields(markup(
      date, select('Вид топлива', 'fuel_type', [['', 'Не указано'], ...fuels], data?.fuel_type ?? previous?.fuel_type ?? detail.car.fuel_type),
      input('АЗС', 'station', data?.station ?? previous?.station, 'maxlength="80"'),
      numeric('Пробег, км', 'odometer', entry?.odometer, 0, 99999999.99, optional),
      input('Присадка', 'additive', data?.additive, 'maxlength="80"'), note(entry?.note),
    ))}`;
}
function serviceFields(detail, entry, date, planId, historical) {
  const data = entry?.data;
  const selected = planId || data?.plan_id || '';
  const plans = detail.plans.map(plan => [plan.id, plan.name]);
  if (selected && !plans.some(([id]) => Number(id) === Number(selected))) plans.push([selected, data?.work || 'Работа']);
  const linked = new Map((data?.parts || []).map(part => [Number(part.id), part]));
  const options = new Map(detail.parts.map(part => [Number(part.id), part]));
  for (const [id, part] of linked) if (!options.has(id)) options.set(id, part);
  const checks = [...options].map(([id, part]) => check(part.name + ' · ' + part.article, 'part_ids', linked.has(id), id)).join('');
  return `${select('Работа', 'plan_id', [...plans, ['', 'Другая работа']], selected)}
    <div id="custom-work" ${selected ? 'hidden' : ''}>${input('Название работы', 'work', data?.work, 'maxlength="80"')}</div>
    ${date}<div class="form-grid-2">${numeric('Пробег, км', 'odometer', entry?.odometer ?? (historical ? '' : detail.state.odometer), 0, 99999999.99, {required: !historical})}
    ${numeric('Стоимость, ₽', 'cost', entry?.cost ?? '', 0, 9999999999.99, {required: !historical})}</div>
    ${extraFields(markup(checks ? '<h3>Запчасти</h3><div class="parts-checks">' + checks + '</div>' : '', note(entry?.note)))}`;
}
export function entryForm(type, detail, entry = null, planId = null, draft = null, unit = 'l100', historical = false) {
  const defaultDate = (entry?.occurred_at ?? '').slice(0, 16).replace(' ', 'T') || nowLocal();
  const date = `<div class="calendar-pair">${calendarField('Дата', 'occurred_at', draft?.date || defaultDate.slice(0, 10), {required: true})}
    ${calendarField('Время', 'occurred_time', draft?.time || defaultDate.slice(11, 16), {required: true, time: true})}</div>`;
  const fields = {
    trip: tripFields,
    fuel: () => fuelEntryFields(detail, entry, date),
    service: () => serviceFields(detail, entry, date, planId, historical),
    fuel_level: () => markup(
      numeric('Остаток, л', 'liters', entry?.data.liters, 0, detail.car.tank_capacity ?? 500),
      detail.car.tank_capacity ? '<div class="fuel-shortcuts">' + [
        ['Пусто', 0], ['¼ бака', .25], ['½ бака', .5], ['¾ бака', .75], ['Полный бак', 1],
      ].map(([label, level]) => btn(label, 'actual-fuel', '', 'button', `data-level="${level}"`)).join('') + '</div>' : '',
      extraFields(markup(date, note(entry?.note))),
    ),
    odometer: () => markup(numeric('Показание одометра, км', 'odometer', entry?.odometer, 0, 99999999.99),
      extraFields(markup(date, note(entry?.note)))),
    other: () => markup(select('Категория', 'category', categories, entry?.data.category ?? categories[0]), date,
      numeric('Сумма, ₽', 'cost', entry?.cost, 0.01, 9999999999.99), note(entry?.note)),
  };
  return `<form class="form-stack" id="entry-form" data-type="${type}" data-id="${Number(entry?.id || 0)}">
    ${!entry && !historical && !planId && ['service', 'other'].includes(type)
      ? '<details class="form-more" id="entry-templates" hidden><summary>Недавние шаблоны</summary><div class="fuel-shortcuts"></div></details>' : ''}
    ${fields[type](entry, date, draft, unit)}
    ${errorMarkup}
    ${formActions(entry ? btn('Удалить', 'delete-entry', 'trash', 'button danger', `data-id="${Number(entry.id)}"`) : '')}</form>`;
}
export function entryDetail(entry, unit = 'l100') {
  const {data, metrics} = entry;
  const fields = [['Дата', fmtDate(entry.occurred_at, {day: 'numeric', month: 'long', year: 'numeric'}) + ' · ' + entry.occurred_at.slice(11, 16)]];
  if (entry.type === 'trip') {
    fields.push(['Расстояние', num(data.distance, 2) + ' км']);
    const speed = averageSpeed(data.distance, data.duration_seconds);
    if (speed !== null) fields.push(['Время в пути', durationLabel(data.duration_seconds)], ['Средняя по времени в пути', num(speed, 1) + ' км/ч']);
    if (data.consumption != null) fields.push(['Введённый расход', fuelRateText(data.consumption, unit)]);
    if (metrics.odometer != null) fields.push(['Пробег после поездки', num(metrics.odometer, 2) + ' км']);
    if (metrics.fuel_used != null) fields.push(
      [data.consumption == null ? 'Израсходовано по оценке' : 'Израсходовано', num(metrics.fuel_used, 2) + ' л']);
  } else if (!['fuel_level', 'odometer'].includes(entry.type)) {
    fields.push(['Стоимость', money(entry.cost)]);
  }
  if (entry.type === 'fuel_level') fields.push(['Фактический остаток', num(data.liters, 2) + ' л']);
  if (entry.type === 'fuel') {
    if (data.fuel_type) fields.push(['Топливо', data.fuel_type]);
    fields.push(['Заправлено', num(data.liters, 2) + ' л' + (data.full ? ' · полный бак' : '')],
      ['Цена за литр', money(data.price)]);
    if (data.additive) fields.push(['Присадка', data.additive]);
  }
  if (entry.odometer != null) fields.push(['Показание одометра', num(entry.odometer, 2) + ' км']);
  if (data.parts?.length) fields.push(['Запчасти', data.parts.map(part => part.name + ' (' + part.article + ')').join(', ')]);
  const route = data.route;
  return `<div class="form-stack">
    ${entry.pending ? '<p class="alert-note">Не подтверждено. Укажите фактические дату и время и сохраните запись.</p>' : ''}
    <dl class="entry-facts">${fields.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    ${metrics.odometer_conflict ? '<p class="alert-note">Показание меньше расчётного пробега в этой точке журнала. Проверьте предыдущие записи.</p>' : ''}
    ${route ? `<section class="route-details"><strong>GPS-трек</strong><canvas id="route-canvas" class="route-canvas" width="500" height="236" aria-label="Схема GPS-трека" role="img" hidden></canvas>
      <p class="help" id="route-error"></p><p class="help">${num(route.distance, 2)} км по GPS · ${num(route.points_count)} точек</p>
      <div id="route-stats">${routeStats(route)}</div>
      ${btn('Показать на карте', 'map-track', 'pin', 'button', `data-id="${Number(entry.id)}"`)}
      ${route.partial ? '<p class="alert-note">Трек частичный. Расстояние можно уточнить при редактировании.</p>' : ''}</section>` : ''}
    ${entry.note && entry.note !== entryTitle(entry) ? `<p class="entry-note">${esc(entry.note)}</p>` : ''}
    <div class="form-actions">${btn('Удалить', 'delete-entry', 'trash', 'button danger', `data-id="${Number(entry.id)}"`)}
    ${canRepeat(entry) ? btn('Повторить', 'repeat-entry', 'copy', 'button', `data-id="${Number(entry.id)}"`) : ''}
    ${btn('Изменить', 'edit-entry', 'edit', 'button primary', `data-id="${Number(entry.id)}"`)}</div>
  </div>`;
}
export function routeStats(route) {
  const knownMotion = route.speed_samples > 0 || route.accelerations > 0 || route.brakings > 0;
  return `${route.average_speed != null ? `<p class="help">${route.partial === true ? 'Средняя по записанному участку GPS' : 'Средняя по GPS'} · ${num(route.average_speed, 1)} км/ч</p>` : ''}
    ${knownMotion ? `<p class="help">Резкие разгоны · ${num(route.accelerations)}</p>
    <p class="help">Резкие торможения · ${num(route.brakings)}</p>` : ''}
    ${route.peak_acceleration > 0 ? `<p class="help">Наибольшее ускорение · ${num(route.peak_acceleration, 1)} м/с²</p>` : ''}`;
}
export function planForm(plan) {
  const optional = {step: '1', required: false};
  return `<form class="form-stack" id="plan-form" data-id="${Number(plan?.id || 0)}">
    ${input('Название работы', 'name', plan?.name, 'maxlength="80" required')}
    <div class="form-grid-2">${numeric('Интервал, км', 'interval_km', plan?.interval_km, 1, 500000, optional)}
    ${numeric('Интервал, мес.', 'interval_months', plan?.interval_months, 1, 120, optional)}</div>
    ${calendarField('Дата записи в сервис', 'planned_date', plan?.planned_date)}
    ${errorMarkup}${formActions()}</form>`;
}
export function deleteAccountForm() {
  return `<form class="form-stack" id="delete-account-form">
    <p>Будут удалены машины, журнал, фото, маршруты и места.</p>
    ${input('Пароль аккаунта', 'password', '', 'type="password" autocomplete="current-password" required')}
    ${errorMarkup}
    <div class="form-actions">${btn('Отмена', 'close-panel')}<button class="button danger" type="submit">Удалить аккаунт</button></div>
  </form>`;
}
export function partForm(part) {
  return `<form class="form-stack" id="part-form" data-id="${Number(part?.id || 0)}">
    ${input('Название', 'name', part?.name, 'maxlength="100" required')}
    ${input('Оригинальный артикул', 'article', part?.article, 'maxlength="80" required')}
    ${input('Производитель', 'maker', part?.maker, 'maxlength="80"')}
    ${numeric('Цена, ₽', 'price', part?.price, 0, 9999999999.99, {required: false})}
    ${errorMarkup}${formActions(part ? btn('Удалить', 'delete-part', 'trash', 'button danger', `data-id="${Number(part.id)}"`) : '')}</form>`;
}
