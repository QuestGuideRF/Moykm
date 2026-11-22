import {accents, calendarField, esc, fmtDate, fuelRate, fuelRateText, fuelUnits, icon, logo, money, num, sessionDate, today, types} from './ui.js';
import {averageSpeed, durationLabel} from './model.js';
import {engines, notePhoto, transmissions} from './car-catalog.js';
export const pages = {
  dashboard: ['Гараж', 'garage', 'Гараж'],
  map: ['Карта', 'pin', 'Карта'],
  journal: ['Журнал', 'journal', 'Журнал'],
  analytics: ['Аналитика', 'analytics', 'Аналитика'],
  parts: ['Запчасти', 'parts', 'Запчасти'],
  settings: ['Настройки', 'settings', 'Настройки'],
};
export const drives = {front: 'Передний привод', rear: 'Задний привод', awd: 'Полный привод'};
export const typeIcon = (type, size = 19) => icon(types[type][2], size);
export function carImage(car, classes = '') {
  if (!Number(car.has_photo)) return '';
  return `<img class="${classes}" src="api.php?action=photo&car_id=${Number(car.id)}&v=${Number(car.photo_version || 0)}" alt="${esc(car.name)}">`;
}
export function btn(label, action, glyph, cls = 'button', extra = '') {
  return `<button type="button" class="${cls}" data-action="${esc(action)}" ${extra}>${glyph ? icon(glyph, 18) : ''}<span>${esc(label)}</span></button>`;
}
export function iconBtn(label, action, glyph, extra = '') {
  return `<button type="button" class="icon-button" data-action="${esc(action)}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(glyph, 20)}</button>`;
}
export function authView(register, problem) {
  return `<div class="auth-wrap">
    <section class="auth-panel" aria-label="Аккаунт Moykm">
      <div class="auth-brand">${logo()}</div>
      <div class="auth-content">
        <h1>${register ? 'Создать аккаунт' : 'Войти в Moykm'}</h1>
        <form id="auth-form" data-register="${register ? 1 : 0}">
          <label class="field">Ник<input required name="nickname" autocomplete="username" minlength="3" maxlength="24" spellcheck="false"></label>
          <label class="field">Пароль<input required name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" ${register ? 'minlength="8" placeholder="От 8 символов"' : ''}></label>
          <p class="form-error" role="alert">${esc(problem)}</p>
          <button class="button primary wide" type="submit">${register ? 'Зарегистрироваться' : 'Войти'}</button>
        </form>
        <div class="auth-actions">${btn(register ? 'Уже есть аккаунт' : 'Создать аккаунт', 'auth-toggle', '', 'text-button')}</div>
      </div>
    </section>
    <div class="auth-visual"><img src="${notePhoto}" alt="Белый Nissan Note e-POWER NISMO"></div>
  </div>`;
}
export function shell(page, user, cars, detail) {
  const navLink = id => {
    const [label, glyph] = pages[id];
    return `<a class="navigation-link ${page === id ? 'is-active' : ''}" href="#${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph, 21)}<span>${label}</span></a>`;
  };
  const mobilePages = ['dashboard', 'journal', 'map'];
  const initial = esc(user.nickname.slice(0, 1).toLocaleUpperCase('ru'));
  return `<div class="layout">
    <aside class="sidebar">
      <a class="brand-link" href="#dashboard" aria-label="Moykm, гараж">${logo()}</a>
      <nav class="navigation" aria-label="Разделы Moykm">${Object.keys(pages).map(navLink).join('')}</nav>
      <nav class="mobile-navigation" aria-label="Разделы Moykm">${mobilePages.map(navLink).join('')}
        ${btn('Меню', 'open-menu', 'more', `navigation-link ${mobilePages.includes(page) ? '' : 'is-active'}`, 'aria-haspopup="dialog"')}</nav>
      <div class="side-footer">
        <button class="account" data-action="open-settings" aria-label="Настройки аккаунта">
          <span class="avatar">${initial}</span><strong class="account-label">${esc(user.nickname)}</strong>${icon('right', 15)}
        </button>
      </div>
    </aside>
    <main class="main${page === 'map' ? ' map-main' : ''}" id="main">
      <header class="page-header" id="page-header">
        <div><h1>${pages[page][2]}</h1>${page === 'dashboard' ? `<p class="today">${fmtDate(today(), {weekday: 'long', day: 'numeric', month: 'long'})}</p>` : ''}</div>
        <div class="header-actions">
          ${cars.length && page !== 'map' ? `<button class="button garage-toggle" data-action="open-garage" aria-haspopup="dialog">${icon('car', 19)}<span>${page === 'dashboard' || !detail ? 'Машины' : esc(detail.car.name)}</span>${icon('down', 16)}</button>` : ''}
        </div>
      </header>
      <div id="view"></div>
    </main>
  </div>`;
}
export function menuView() {
  return `<div class="sheet-menu">${['analytics', 'parts', 'settings'].map(id => {
    const [label, glyph] = pages[id];
    return btn(label, 'menu-page', glyph, 'button', `data-page="${id}"`);
  }).join('')}</div>`;
}
function plate(value) {
  if (!value) return '';
  const match = value.match(/^(.*?)\s+(\d{2,3})$/);
  return match ? `<span class="plate">${esc(match[1])}<span>${esc(match[2])}</span></span>`
    : `<span class="plate">${esc(value)}</span>`;
}
function statusFor(plan) {
  if (!plan) return 'Добавьте работу';
  if (plan.overdue) return 'Просрочено';
  if (plan.due) return 'Пора выполнить';
  const km = plan.remaining_km == null ? '' : 'через ' + num(plan.remaining_km, 1) + ' км';
  const date = plan.due_date ? 'до ' + fmtDate(plan.due_date, {day: 'numeric', month: 'short', year: 'numeric'}) : '';
  return [km, date].filter(Boolean).join(' · ')
    || (plan.interval_km || plan.interval_months ? 'Срок неизвестен' : 'Без интервала');
}
const consumptionNote = state => state.consumption_source === 'base' ? 'Базовый расход' : 'По полным бакам';
function expenseChart(stats, caption = '', brief = false) {
  const total = stats.cost;
  const palette = ['var(--accent)', 'var(--chart-two)', 'var(--chart-three)', 'var(--chart-four)', 'var(--chart-five)'];
  const source = brief ? stats.categories.slice(0, 5) : stats.categories;
  if (brief && stats.categories.length > 5) {
    source.splice(4, 1, ['Остальное', stats.categories.slice(4).reduce((sum, value) => sum + value[1], 0)]);
  }
  const color = index => palette[index % palette.length];
  return `<div class="expense-total"><strong>${money(total)}</strong>${caption ? `<span>${esc(caption)}</span>` : ''}</div>
    ${total ? `<div class="expense-bar" aria-hidden="true">${source.map(([, value], i) => `<i style="flex-grow:${value};background:${color(i)}"></i>`).join('')}</div>
    <ul class="expense-legend">${source.map(([name, value], i) => `<li><i style="background:${color(i)}"></i><span>${esc(name)}</span><strong>${money(value)}</strong></li>`).join('')}</ul>`
    : '<p class="muted">За этот период расходов ещё нет.</p>'}`;
}
export function dashboard(detail, month, unit = 'l100') {
  const {car, state, entries, plans} = detail;
  const next = plans[0];
  const level = car.tank_capacity && state.fuel != null ? Math.min(100, 100 * state.fuel / car.tank_capacity) : null;
  const specs = car.specs || {};
  const power = specs.custom_power || specs.power;
  const engine = [specs.displacement && `${num(specs.displacement, 2)} л`, engines[specs.engine]?.toLocaleLowerCase('ru')].filter(Boolean).join(' ');
  const props = [[specs.generation, car.year].filter(Boolean).join(' · '), engine,
    power && `${specs.engine === 'hybrid' ? 'ДВС ' : ''}${num(power)} л. с.`,
    transmissions[specs.transmission], drives[car.drive]].filter(Boolean);
  const photo = carImage(car, 'car-photo');
  const odometer = num(state.odometer, 1);
  return `<section class="hero ${photo ? 'has-car-image' : ''}" id="car-hero" aria-label="${esc(car.name)}">
    ${photo ? `<div class="hero-image">${photo}</div><div class="hero-shade"></div>` : ''}
    <div class="hero-details">
      ${plate(car.plate)}
      <h2><button class="car-select" type="button" data-action="open-garage" aria-haspopup="dialog">${esc(car.name)}${icon('down', 22)}</button></h2>
      <p class="car-meta">${(props.length ? props : [car.fuel_type]).map(value => `<span>${esc(value)}</span>`).join('')}</p>
      ${!photo ? btn('Добавить фото', 'edit-car', 'image', 'button hero-upload') : ''}
    </div>
    <div class="hero-controls">${iconBtn('Параметры машины', 'edit-car', 'more')}</div>
  </section>
  <section class="quick-actions" aria-label="Добавить запись">
    ${['trip', 'fuel', 'service'].map(type =>
      `<button class="quick-action" data-action="new-entry" data-type="${type}"><span class="quick-icon ${type}">${icon(types[type][2], 22)}</span><span>${types[type][0]}</span></button>`).join('')}
    ${btn('Ещё', 'entry-chooser', 'more', 'quick-action')}
  </section>
  <section id="unfinished-trip" class="card section-card draft-notice" hidden>
    <strong>Есть незавершённая поездка</strong>
    <div class="settings-actions">${btn('Восстановить', 'resume-trip', 'route')}${btn('Удалить черновик', 'discard-trip', 'trash')}</div>
  </section>
  <section class="card fuel-card vehicle-stats" aria-label="Пробег и запас топлива">
    <div class="vehicle-stat">
      <span class="metric-label">Топливо</span>
      <strong class="vehicle-stat-value">${state.fuel == null ? '—' : '≈ ' + num(state.fuel, 1) + ' <small>л</small>'}</strong>
      ${level == null ? '' : `<div class="tank-bar" role="meter" aria-label="Остаток топлива" aria-valuemin="0" aria-valuemax="${Number(car.tank_capacity)}" aria-valuenow="${Number(state.fuel)}"><i style="width:${level}%"></i></div>`}
    </div>
    <div class="vehicle-stat vehicle-range">
      <span class="metric-label">Запас хода</span>
      <strong class="vehicle-stat-value">${state.range == null ? '—' : '≈ ' + num(state.range) + ' <small>км</small>'}</strong>
    </div>
    <div class="vehicle-stat">
      <span class="metric-label">Пробег</span>
      <strong class="vehicle-stat-value vehicle-odometer" title="${odometer} км"><span>${odometer}</span> <small>км</small></strong>
    </div>
  </section>
  <section class="minor-metrics" aria-label="Показатели машины">
    <article class="card small-metric consumption-metric"><span class="small-metric-icon">${icon('drop', 20)}</span><div class="consumption-content"><div class="metric-label">Средний расход</div><div class="small-value" title="${state.consumption == null ? '' : consumptionNote(state)}">${state.consumption == null ? '—' : '≈ ' + fuelRateText(state.consumption, unit)}</div></div></article>
    <button class="card small-metric service-metric" data-action="plans"><span class="small-metric-icon">${icon('calendar', 20)}</span><span class="service-data"><span class="metric-label">Ближайшее ТО</span><strong>${esc(next?.name || 'План обслуживания')}</strong><small class="${next?.overdue ? 'danger-text' : ''}">${next?.booking && !next.overdue && !next.due ? 'Запись · ' + fmtDate(next.booking) : statusFor(next)}</small></span>${icon('right', 17)}</button>
  </section>
  <section class="dashboard-lower">
    <article class="card section-card dashboard-expenses"><div class="section-heading"><h2>Расходы за месяц</h2><a href="#analytics" class="text-button" aria-label="Открыть аналитику">${icon('analytics', 20)}</a></div>
      ${expenseChart(month, fmtDate(today(), {month: 'long'}), true)}</article>
    <article class="card section-card dashboard-journal"><div class="section-heading"><h2>Последние записи</h2><a href="#journal" class="text-button">Весь журнал${icon('right', 16)}</a></div>
      ${entries.length ? entryRows(entries.slice(0, 4)) : '<p class="muted">Записей пока нет.</p>'}</article>
  </section>`;
}
export function emptyCar() {
  return `<section class="card empty-car"><div class="empty-icon">${icon('car', 40)}</div><h2>Гараж пуст</h2>
  ${btn('Добавить машину', 'new-car', 'plus', 'button primary')}</section>`;
}
export function garageView(cars, activeId) {
  return `<div class="garage-grab" aria-hidden="true"></div><header class="panel-header"><h2 id="garage-title">Мои машины</h2>${iconBtn('Закрыть гараж', 'close-garage', 'close')}</header>
    <div class="garage-cards" tabindex="0" aria-label="Список машин">
      ${cars.map(car => {
        const active = Number(car.id) === Number(activeId);
        return `<button class="garage-card ${active ? 'selected' : ''}" data-action="select-car" data-id="${Number(car.id)}" aria-pressed="${active}">
          <span class="garage-car-photo">${carImage(car) || icon('car', 42)}</span>
          <strong>${esc(car.name)}</strong><small>${esc(car.plate || car.year || 'Без номера')}</small>
          ${active ? `<span class="selected-check">${icon('check', 15)}</span>` : ''}</button>`;
      }).join('')}
      <button class="garage-card add-car" data-action="new-car">${icon('plus', 27)}<strong>Новая машина</strong></button>
    </div>`;
}
export function entryTitle(entry) {
  if (entry.type === 'trip') return entry.note || 'Поездка';
  if (entry.type === 'fuel') return entry.data.station ? 'Заправка · ' + entry.data.station : 'Заправка';
  return entry.type === 'service' ? entry.data.work : entry.data.category ?? types[entry.type][1];
}
function entryAmount(entry) {
  if (entry.type === 'trip') return num(entry.data.distance, 2) + ' км';
  if (entry.type === 'fuel_level') return num(entry.data.liters, 2) + ' л';
  if (entry.type === 'odometer') return num(entry.odometer, 2) + ' км';
  return money(entry.cost);
}
export function entryRows(entries) {
  return `<div class="entry-list">${entries.map(entry => {
    const trip = entry.type === 'trip';
    const secondary = entry.type === 'fuel' ? [num(entry.data.liters, 2) + ' л', entry.data.fuel_type].filter(Boolean).join(' · ')
      : entry.type === 'service' && entry.odometer != null ? num(entry.odometer, 1) + ' км' : types[entry.type][0];
    return `<button class="entry-row" data-action="entry-detail" data-id="${Number(entry.id)}">
      <span class="quick-icon ${entry.type}">${typeIcon(entry.type, 19)}</span>
      <span class="entry-description"><strong>${esc(entryTitle(entry))}</strong><small>${fmtDate(entry.occurred_at, {day: 'numeric', month: 'short'})} · ${esc(secondary)}</small></span>
      <strong class="entry-amount">${entryAmount(entry)}</strong>${icon('right', 15)}
    </button>`;
  }).join('')}</div>`;
}
export function journalView(type, search, pending) {
  return `<section class="journal-toolbar">
    <div class="search-box">${icon('search', 19)}<input id="journal-search" type="search" maxlength="160" aria-label="Поиск по журналу" placeholder="Поиск по журналу" value="${esc(search)}"></div>
    ${btn('Добавить запись', 'entry-chooser', 'plus', 'button primary')}
  </section>
  <div class="filters" aria-label="Тип записи">${[['all', 'Все записи'], ...Object.entries(types).map(([key, [, label]]) => [key, label]),
    ...(pending || type === 'pending' ? [['pending', 'Не подтверждены']] : [])]
    .map(([key, label]) => `<button class="filter ${key === type ? 'selected' : ''}" data-action="journal-filter" data-type="${key}" aria-pressed="${key === type}">${label}</button>`).join('')}</div>
  <section id="journal-results" aria-label="Записи" aria-live="polite"></section>`;
}
export function journalResults(entries, next, unit = 'l100') {
  if (!entries.length) return '<p class="muted empty-message">Подходящих записей пока нет.</p>';
  const blocks = entries.map(entry => {
    const {type, data} = entry;
    const title = entryTitle(entry);
    const speed = type === 'trip' ? averageSpeed(data.distance, data.duration_seconds) : null;
    const main = entryAmount(entry);
    const secondary = type === 'trip' ? [speed === null ? '' : `${durationLabel(data.duration_seconds)} · ${num(speed, 1)} км/ч`,
      data.consumption == null ? '' : fuelRateText(data.consumption, unit)].filter(Boolean).join(' · ')
      : type === 'fuel' ? [num(data.liters, 2) + ' л', data.fuel_type].filter(Boolean).join(' · ')
        : type === 'service' && entry.odometer != null ? `${num(entry.odometer, 2)} км` : '';
    return `<button type="button" class="card entry-block" data-action="entry-detail" data-id="${Number(entry.id)}">
      <span class="entry-block-top"><span>${typeIcon(type, 19)}${types[type][0]}</span><time datetime="${esc(entry.occurred_at.replace(' ', 'T'))}">${fmtDate(entry.occurred_at, {day: 'numeric', month: 'short'})}</time></span>
      ${title === types[type][0] ? '' : `<strong class="entry-block-title">${esc(title)}</strong>`}
      <span class="entry-block-data"><strong>${main}</strong>${secondary ? `<small>${esc(secondary)}</small>` : ''}</span>
    </button>`;
  }).join('');
  const more = next ? btn('Показать ещё', 'journal-more', '', 'button journal-more') : '';
  return `<div class="journal-blocks">${blocks}</div>${more}`;
}
export function analysisView(stats, from, to, unit = 'l100') {
  const numberOrDash = (value, formatter) => value == null ? '—' : formatter(value);
  const speed = value => numberOrDash(value, n => num(n, 1) + ' <small>км/ч</small>');
  return `<form class="analysis-period" id="period-form"><div class="calendar-pair period-dates">${calendarField('С', 'from', from)}${calendarField('По', 'to', to)}</div>
    <div class="period-actions"><button class="button primary" type="submit">Показать</button>
    ${btn('Вся история', 'all-period', '', 'button')}</div><p class="form-error" role="alert"></p></form>
    ${stats ? `<div class="analytics-metrics">
      <article class="card section-card"><span class="metric-label">Пробег</span><strong>${num(stats.distance, 2)} <small>км</small></strong>
        ${stats.inferred ? '<p>Оценка включает показания одометра.</p>' : !stats.distance ? '<p>Добавьте поездку или показание одометра.</p>' : ''}</article>
      <article class="card section-card"><span class="metric-label">Расход топлива</span><strong>${numberOrDash(stats.consumption, value => num(fuelRate(value, unit), unit === 'lkm' ? 4 : 2) + ` <small>${fuelUnits[unit]}</small>`)}</strong>
        <p>${stats.consumptionMeasured ? 'По полным бакам' : stats.consumption != null ? 'Оценка по истории' : 'Нужны данные о пробеге.'}</p></article>
      <article class="card section-card"><span class="metric-label">Стоимость километра</span><strong>${numberOrDash(stats.perKm, value => money(value) + ' <small>/ км</small>')}</strong>
        <p>${stats.perKm == null ? 'Нужны пробег и расходы за один период.' : 'Оценка по всем расходам периода'}</p></article>
    </div>
    <section class="card section-card analytics-motion">
      <h2>Движение</h2>
      <dl>
        <div><dt>Средняя по времени в пути</dt><dd>${speed(stats.averageSpeed)}</dd></div>
        <div><dt>Средняя по GPS</dt><dd>${speed(stats.gpsAverageSpeed)}</dd>
        ${stats.gpsTracks ? `<small>По записанным участкам · ${num(stats.gpsTracks)}</small>` : ''}</div>
        <div><dt>Резкие разгоны</dt><dd>${numberOrDash(stats.accelerations, num)}</dd></div>
        <div><dt>Резкие торможения</dt><dd>${numberOrDash(stats.brakings, num)}</dd></div>
      </dl>
    </section>
    <article class="card section-card analytics-expenses"><h2>Расходы по категориям</h2>${expenseChart(stats)}</article>`
    : '<p class="muted" role="status">Загрузка…</p>'}`;
}
export function partsView(parts, shops) {
  return `<div class="page-toolbar">${btn('Добавить запчасть', 'new-part', 'plus', 'button primary')}</div>
    ${parts.length ? `<div class="part-grid">${parts.map(part => `<article class="card section-card part-card">
    <div class="section-heading"><span class="small-metric-icon">${icon('parts', 22)}</span>${iconBtn('Изменить запчасть', 'edit-part', 'edit', 'data-id="' + Number(part.id) + '"')}</div>
    <h2>${esc(part.name)}</h2>${part.maker ? `<p class="muted">${esc(part.maker)}</p>` : ''}
    <div class="part-article"><code>${esc(part.article)}</code>${iconBtn('Скопировать артикул', 'copy-part', 'copy', 'data-id="' + Number(part.id) + '"')}</div>
    ${part.price !== '' && part.price != null ? `<strong>${money(part.price)}</strong>` : ''}
    ${shops.length ? `<div class="shop-links">${shops.map(shop => `<a class="button" href="${esc(shop.url.replaceAll('{article}', encodeURIComponent(part.article)))}" target="_blank" rel="noopener noreferrer">${esc(shop.name)}</a>`).join('')}</div>` : ''}
    </article>`).join('')}</div>` : '<section class="card section-card"><p class="muted empty-message">Запчастей пока нет.</p></section>'}`;
}
export function settingsView(user, detail, sessions, unit = 'l100', archived = []) {
  const themes = {light: 'Светлая', dark: 'Тёмная', system: 'Системная'};
  const option = (name, key, label, checked, style = '') =>
    `<label class="setting-option" ${style}><input type="radio" name="${name}" value="${key}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
  return `<div class="settings-grid">
    <section class="card section-card"><h2>Внешний вид</h2>
      <form id="settings-form">
        <fieldset><legend>Тема</legend><div class="segmented">${Object.entries(themes).map(([key, label]) => option('theme', key, label, user.theme === key)).join('')}</div></fieldset>
        <label class="neon-setting"><strong>Неоновый режим</strong>
          <input type="checkbox" role="switch" name="neon" ${Number(user.neon) ? 'checked' : ''}><i class="switch-track" aria-hidden="true"></i></label>
        <fieldset><legend>Акцентный цвет</legend><div class="swatches">${Object.entries(accents).map(([key, [label, color]]) => option('accent', key, label, user.accent === key, `style="--swatch:${color}"`)).join('')}</div></fieldset>
        <fieldset><legend>Единицы расхода</legend><div class="segmented">${Object.entries(fuelUnits).map(([key, label]) => option('fuel_unit', key, label, key === unit)).join('')}</div></fieldset>
        <p class="form-error" role="alert"></p>
      </form>
    </section>
    <div class="settings-stack">
      ${detail ? `<section class="card section-card"><h2>Машина</h2><div class="settings-actions">${btn('Параметры машины', 'edit-car', 'car')}${btn('План обслуживания', 'plans', 'calendar')}${btn('В архив', 'archive-car')}</div></section>` : ''}
      ${archived.length ? `<section class="card section-card"><h2>Архив</h2>${archived.map(car =>
        `<div class="session-row"><strong>${esc(car.name)}</strong>${btn('Вернуть', 'restore-car', '', 'button', 'data-id="' + Number(car.id) + '"')}</div>`).join('')}</section>` : ''}
      <section class="card section-card"><h2>Аккаунт</h2>
        <p class="muted">${esc(user.nickname)}</p>
        <div class="settings-actions"><a class="button" href="api.php?action=export" download="moykm.json">Выгрузить JSON</a>
        ${btn('Выйти', 'logout', 'logout')}${btn('Удалить аккаунт', 'delete-account', 'trash', 'button danger')}</div>
      </section>
      <section class="card section-card"><h2>Активные сессии</h2><div id="session-results">${sessionRows(sessions)}</div></section>
    </div>
  </div>`;
}
export function sessionRows(sessions) {
  if (!sessions) return '<p class="muted">Загрузка…</p>';
  if (!sessions.length) return '<p class="muted">Активных сессий нет.</p>';
  return sessions.map(session => `<div class="session-row"><div><strong>${session.current ? 'Текущий браузер' : 'Другой браузер'}</strong>
    <small>До ${esc(sessionDate(session.expires_at))}</small></div>
    ${session.current ? '' : btn('Отозвать', 'revoke-session', '', 'text-button', 'data-id="' + esc(session.id) + '"')}</div>`).join('');
}
export function plansView(plans) {
  return `<div class="plan-list">${plans.map(plan => `<article class="plan-row"><div><strong>${esc(plan.name)}</strong>
    <small class="${plan.overdue ? 'danger-text' : ''}">${statusFor(plan)}</small>
    ${plan.booking ? `<small>Запись в сервис · ${fmtDate(plan.booking)}</small>` : ''}</div><div class="plan-actions">
    ${iconBtn('Изменить интервал', 'edit-plan', 'edit', 'data-id="' + Number(plan.id) + '"')}
    ${iconBtn('Указать прошлое ТО', 'past-service', 'calendar', 'data-id="' + Number(plan.id) + '"')}
    ${iconBtn('Отметить выполнение', 'perform-plan', 'check', 'data-id="' + Number(plan.id) + '"')}</div></article>`).join('')}</div>
    ${btn('Добавить работу', 'new-plan', 'plus', 'button primary')}`;
}
