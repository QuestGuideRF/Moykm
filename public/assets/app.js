import {canonicalFuelRate, esc, fuelUnits, monthStart, nowLocal, num, readLocal, today, types, writeLocal} from './ui.js';
import {averageSpeed, durationInput, durationLabel, durationUnits, fuelCalculation, MAX_TRIP_SECONDS} from './model.js';
import {preparePhoto} from './photo.js';
import {applyCarPreset, applyVinCar, custom, engines, legacy, resetPresetFields, syncCarSelection} from './car-catalog.js';
import {blankTrack, drawRoute, recorder, stringifyRoute} from './gps.js';
import {deleteAccountDrafts, deleteTripDraft, readTripDraft, writeTripDraft} from './trip-drafts.js';
import {
  analysisView, authView, dashboard, emptyCar, entryTitle, garageView, journalResults, journalView,
  menuView, pages, partsView, plansView, sessionRows, settingsView, shell,
} from './views.js';
import {canRepeat, carForm, deleteAccountForm, entryChooser, entryDetail, entryForm, entryTemplates,
  panel, partForm, planForm, routeStats} from './forms.js';
const app = document.querySelector('#app');
const garage = document.querySelector('#garage-dialog');
const sheet = document.querySelector('#panel-dialog');
const confirmation = document.querySelector('#confirm-dialog');
const notice = document.querySelector('#toast');
const state = {
  user: null, cars: [], archived: [], detail: null, shops: [], register: false, page: 'dashboard', search: '',
  filter: 'all', from: monthStart(), to: today(), sessions: null, photoVersion: new Map(),
  journalEntries: [], journalNext: null, journalRequest: 0,
};
const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/i;
let currentForm = null;
let toastTimer;
let searchTimer;
let preferenceQueue = Promise.resolve();
let confirmedPreferences = {};
const preferenceVersions = {};
let unmountNavigation;
let pointer = null;
let viewedEntry = null;
let mapTrack = null;
const fuelUnitKey = () => 'moykm-fuel-unit:' + state.user.id;
function fuelUnit() {
  const unit = readLocal(fuelUnitKey());
  return Object.hasOwn(fuelUnits, unit) ? unit : 'l100';
}
async function api(action, input, method = input ? 'POST' : 'GET') {
  const url = new URL('api.php', location.href);
  url.searchParams.set('action', action);
  const options = {method, headers: {'Accept': 'application/json'}, credentials: 'same-origin', cache: 'no-store'};
  if (method === 'POST') {
    options.headers['X-Moykm'] = '1';
    if (input instanceof FormData) options.body = input;
    else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(input || {});
    }
  } else {
    for (const [key, value] of Object.entries(input || {})) url.searchParams.set(key, value);
  }
  const response = await fetch(url, options).catch(() => { throw new Error('Нет связи с сервером. Проверьте подключение.'); });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.user && action !== 'register' && action !== 'login') {
      closePrivateViews();
      renderAuth('Сессия завершена. Войдите снова.');
    }
    throw new Error(data.error || 'Не удалось выполнить запрос. Повторите ещё раз.');
  }
  return data;
}
function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = state.user?.theme || 'system';
  root.dataset.accent = state.user?.accent || 'orange';
  root.dataset.mode = Number(state.user?.neon) ? 'neon' : 'normal';
  const dark = root.dataset.theme === 'dark' || (root.dataset.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#151412' : '#f6f5f3';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function toast(message) {
  clearTimeout(toastTimer);
  notice.textContent = message;
  toastTimer = setTimeout(() => { notice.textContent = ''; }, 3600);
}
function error(form, message = '') {
  const output = form?.isConnected && form.querySelector('.form-error');
  if (output) {
    output.textContent = message;
    if (message && form.closest('dialog')) output.scrollIntoView({block: 'nearest'});
  }
  else if (message) toast(message);
}
function renderAuth(message = '') {
  unmountNavigation?.();
  unmountNavigation = null;
  state.user = null;
  state.detail = null;
  state.cars = [];
  state.sessions = null;
  state.page = 'dashboard';
  state.filter = 'all';
  state.search = '';
  window.scrollTo(0, 0);
  applyTheme();
  app.innerHTML = authView(state.register, message);
}
function activeCarId() {
  const selected = state.cars.find(car => Number(car.id) === Number(state.user.last_car_id));
  return Number((selected ?? state.cars[0])?.id || 0);
}
async function refreshCar() {
  const id = activeCarId();
  const detail = id ? await api('detail', {car_id: id}, 'GET') : null;
  if (detail) detail.car.photo_version = state.photoVersion.get(id);
  state.detail = detail;
}
async function refreshGarage() {
  const payload = await api('bootstrap');
  state.user = payload.user;
  confirmedPreferences = {...state.user};
  state.cars = payload.cars.filter(car => !car.archived_at)
    .map(car => ({...car, photo_version: state.photoVersion.get(Number(car.id))}));
  state.archived = payload.cars.filter(car => car.archived_at);
  state.shops = payload.shops;
  if (state.user) await refreshCar();
}
async function applyJournal(append = false) {
  const target = document.querySelector('#journal-results');
  if (!target || !state.detail) return;
  const request = ++state.journalRequest;
  const params = {car_id: activeCarId(), type: state.filter, search: state.search};
  if (append) params.before = state.journalNext;
  else {
    state.journalEntries = [];
    state.journalNext = null;
    target.innerHTML = '<p class="muted" role="status">Загрузка…</p>';
  }
  try {
    const data = await api('journal', params, 'GET');
    if (!target.isConnected || request !== state.journalRequest) return;
    const firstNew = state.journalEntries.length;
    state.journalEntries = [...state.journalEntries, ...data.items];
    state.journalNext = data.next;
    target.innerHTML = journalResults(state.journalEntries, state.journalNext, fuelUnit());
    if (append) target.querySelectorAll('.entry-block')[firstNew]?.focus({preventScroll: true});
  } catch (failure) {
    if (!target.isConnected || request !== state.journalRequest) return;
    if (append) {
      target.querySelector('[data-action="journal-more"]').disabled = false;
      toast(failure.message);
    } else target.textContent = failure.message;
  }
}
async function loadAnalytics(target) {
  const {from, to} = state;
  const carId = activeCarId();
  target.innerHTML = analysisView(null, from, to, fuelUnit());
  const loading = target.querySelector('[role="status"]');
  try {
    const stats = await api('analytics', {car_id: carId, from, to}, 'GET');
    if (loading.isConnected) target.innerHTML = analysisView(stats, from, to, fuelUnit());
  } catch (failure) {
    if (loading.isConnected) loading.textContent = failure.message;
  }
}
function renderView() {
  unmountNavigation?.();
  unmountNavigation = null;
  const target = document.querySelector('#view');
  const {page, user, detail, shops, sessions} = state;
  if (page === 'settings') {
    target.innerHTML = settingsView(user, detail, sessions, fuelUnit(), state.archived);
  } else if (page === 'map') {
    target.innerHTML = '<p class="muted" role="status">Открываем карту…</p>';
    import('./navigation.js').then(({mountNavigation}) => {
      if (target.isConnected && state.page === 'map' && state.user === user) unmountNavigation = mountNavigation(target, api, ask, mapTrack);
    }).catch(() => {
      if (target.isConnected && state.page === 'map') target.textContent = 'Не удалось открыть карту. Обновите страницу.';
    });
  } else if (!detail) {
    target.innerHTML = emptyCar();
  } else if (page === 'dashboard') {
    target.innerHTML = dashboard(detail, detail.month, fuelUnit());
    void showDraftNotice(target, draftKey());
  } else if (page === 'journal') {
    target.innerHTML = journalView(state.filter, state.search, detail.has_pending);
    void applyJournal();
  } else if (page === 'analytics') {
    void loadAnalytics(target);
  } else if (page === 'parts') {
    target.innerHTML = partsView(detail.parts, shops);
  }
}
function renderShell() {
  if (!state.user) return;
  applyTheme();
  app.innerHTML = shell(state.page, state.user, state.cars, state.detail);
  renderView();
}
async function loadSessions() {
  if (state.page !== 'settings' || !state.user) return;
  try {
    state.sessions = (await api('sessions')).sessions;
    const target = document.querySelector('#session-results');
    if (target) target.innerHTML = sessionRows(state.sessions);
  } catch (failure) {
    const target = document.querySelector('#session-results');
    if (target) target.textContent = failure.message;
  }
}
function navigate() {
  if (!state.user) return;
  const route = location.hash.slice(1);
  state.page = Object.hasOwn(pages, route) ? route : 'dashboard';
  if (state.page !== 'map') mapTrack = null;
  renderShell();
  window.scrollTo(0, 0);
  void loadSessions();
}
function goto(page) {
  if (location.hash === '#' + page) navigate();
  else location.hash = page;
}
function openGarage() {
  if (garage.open || sheet.open || confirmation.open || !state.user || !state.cars.length) return;
  garage.innerHTML = garageView(state.cars, activeCarId());
  garage.showModal();
}
function showPanel(title, content, subtitle = '') {
  sheet.innerHTML = panel(title, content, subtitle);
  if (!sheet.open) sheet.showModal();
  else sheet.querySelector('[autofocus]')?.focus({preventScroll: true});
  sheet.scrollTop = 0;
}
function stopAndForgetForm() {
  if (!currentForm) return;
  const ctx = currentForm;
  ctx.gpsControl?.stop();
  stopTripTimer(ctx);
  if (ctx.type === 'trip') {
    persistDraft(ctx, true);
    const target = document.querySelector('#view');
    if (target) void ctx.draftWrite.then(() => showDraftNotice(target, ctx.key));
  }
  clearTimeout(currentForm.timer);
  currentForm = null;
}
function closePanel(force = false) {
  if (!force && sheet.querySelector('form[data-busy]')) return;
  if (currentForm?.active) toast('GPS-запись остановлена.');
  stopAndForgetForm();
  if (sheet.open) sheet.close();
}
function closePrivateViews() {
  closePanel(true);
  for (const dialog of [confirmation, garage]) {
    if (dialog.open) dialog.close();
  }
}
function ask(title, text, button) {
  return new Promise(resolve => {
    confirmation.innerHTML = `<h2 id="confirm-title">${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <form method="dialog" class="form-actions"><button value="cancel" class="button" autofocus>Отмена</button>
      <button value="confirm" class="button primary">${esc(button)}</button></form>`;
    confirmation.returnValue = '';
    confirmation.addEventListener('close', () => resolve(confirmation.returnValue === 'confirm'), {once: true});
    confirmation.showModal();
  });
}
const draftKey = (entry = null) => 'moykm-trip:' + state.user.id + ':' + state.detail.car.id + ':' + (entry?.id ?? 'new');
function readLegacyDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? null; }
  catch { return null; }
}
function removeLegacyDraft(key) {
  try { sessionStorage.removeItem(key); }
  catch { /* Storage is optional for recording. */ }
}
async function readDraft(key, withPoints = true) {
  try { return await readTripDraft(key, withPoints) ?? readLegacyDraft(key); }
  catch { return readLegacyDraft(key); }
}
async function removeDraft(key) {
  removeLegacyDraft(key);
  try { await deleteTripDraft(key); }
  catch { toast('Не удалось удалить локальный черновик.'); }
}
async function showDraftNotice(target, key) {
  const notice = target.querySelector('#unfinished-trip');
  if (!notice || !key.endsWith(':new')) return;
  const draft = await readDraft(key, false);
  if (notice.isConnected && state.user && state.detail && key === draftKey()) notice.hidden = !draft;
}
async function clearAccountDrafts() {
  if (!state.user) return;
  const prefix = 'moykm-trip:' + state.user.id + ':';
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage is optional for recording. */ }
  try { await deleteAccountDrafts(prefix); }
  catch { toast('Не удалось очистить черновики в браузере.'); }
}
function persistDraft(ctx, force = false) {
  const fields = ctx.form.elements;
  if (!ctx.dirty || ctx.discardDraft || (!force && Date.now() - ctx.persisted < 2000)) return;
  ctx.persisted = Date.now();
  const track = ctx.track;
  const count = track.points.length;
  const metadata = {partial: track.partial || ctx.active, distance: fields.distance.value,
    duration: tripDuration(ctx.form), manualDuration: ctx.manualDuration, manualDistance: ctx.manualDistance,
    consumption: fields.consumption.value, unit: ctx.unit, routeChange: ctx.routeChange, requestKey: ctx.requestKey,
    date: fields.occurred_at.value, time: fields.occurred_time.value, note: fields.note.value};
  ctx.draftWrite = ctx.draftWrite.then(async () => {
    const from = ctx.savedTrack === track ? ctx.savedCount : 0;
    ctx.revision = await writeTripDraft(ctx.key, metadata, from, track.points.slice(from, count), ctx.revision);
    ctx.savedTrack = track;
    ctx.savedCount = count;
    removeLegacyDraft(ctx.key);
  }).catch(failure => {
    ctx.gpsWarning = failure.message === 'Черновик изменён в другой вкладке.' ? failure.message
      : 'Память браузера недоступна. Сохраните поездку перед закрытием страницы.';
    const warning = ctx.form.querySelector('#draft-warning');
    if (warning) warning.textContent = ctx.gpsWarning;
  });
}
function tripDuration(form) {
  const {duration_value: field, duration_unit: unit} = form.elements;
  const seconds = Math.round(Number(field.value) * (durationUnits[unit.value]?.[1] ?? 0));
  return seconds >= 1 && seconds <= MAX_TRIP_SECONDS && field.validity.valid ? seconds : null;
}
function setDuration(form, seconds) {
  const {unit, value} = durationInput(seconds);
  form.elements.duration_value.value = value;
  form.elements.duration_unit.value = unit;
}
function updateTimerLabel(ctx) {
  const duration = tripDuration(ctx.form);
  ctx.form.querySelector('#trip-timer span').textContent = ctx.clockStarted !== null
    ? (duration ? 'Стоп · ' + durationLabel(duration) : 'Стоп')
    : duration ? 'Продолжить таймер' : 'Запустить таймер';
}
function tickTripTimer(ctx) {
  ctx.dirty = true;
  const seconds = Math.min(MAX_TRIP_SECONDS, ctx.clockOffset + Math.max(0, Math.floor((Date.now() - ctx.clockStarted) / 1000)));
  setDuration(ctx.form, seconds);
  ctx.manualDuration = true;
  updateTimerLabel(ctx);
  previewEntry(ctx);
  persistDraft(ctx);
}
function stopTripTimer(ctx) {
  if (ctx.clockStarted == null) return;
  clearInterval(ctx.clockInterval);
  tickTripTimer(ctx);
  ctx.clockStarted = null;
  ctx.form.elements.duration_value.readOnly = false;
  ctx.form.elements.duration_unit.disabled = false;
  updateTimerLabel(ctx);
  persistDraft(ctx, true);
}
function updateGps(ctx, {active = false, track = ctx.track, message = ''} = {}) {
  ctx.active = active;
  ctx.track = track;
  if (track.points.length) ctx.dirty = true;
  const status = ctx.form.querySelector('#gps-status');
  const route = stringifyRoute(track);
  ctx.form.querySelector('#gps-start').hidden = active;
  ctx.form.querySelector('#gps-stop').hidden = !active;
  ctx.form.querySelector('#gps-clear').hidden = active || (!track.points.length && (!ctx.entry?.data.route || !!ctx.routeChange));
  const field = ctx.form.elements.distance;
  if (route.distance > 0 && (!ctx.manualDistance || field.value === '')) field.value = route.distance;
  if (!ctx.manualDuration) {
    if (!route.partial && route.duration_seconds) setDuration(ctx.form, route.duration_seconds);
    else setDuration(ctx.form, null);
  }
  updateTimerLabel(ctx);
  persistDraft(ctx, !active || track.partial && Boolean(message));
  status.innerHTML = `${track.points.length ? `<p class="help">${num(route.distance, 2)} км по GPS · ${num(route.points_count)} точек</p>` : ''}
    ${track.points.length > 1 ? routeStats(route) : ''}
    ${!active && track.points.length && route.partial ? '<p class="alert-note">Трек частичный. Уточните расстояние и время в пути.</p>' : ''}
    ${message ? `<p class="help">${esc(message)}</p>` : ''}<p class="help" id="draft-warning">${esc(ctx.gpsWarning)}</p>`;
  if (ctx.routeChange && ctx.entry?.data.route) ctx.form.querySelector('#saved-route-label').hidden = true;
  previewEntry(ctx);
}
function tripFuelRate(form, unit) {
  const value = form.elements.consumption.value;
  return value === '' ? null : canonicalFuelRate(value, unit);
}
async function openEntry(type, {entry = null, planId = null, historical = Boolean(entry?.data.historical),
  resume = false, template = null} = {}) {
  if (!Object.hasOwn(types, type) || !state.detail || confirmation.open) return;
  const previous = currentForm;
  stopAndForgetForm();
  const user = state.user;
  const carId = activeCarId();
  const key = draftKey(entry);
  if (previous?.type === 'trip') await previous.draftWrite;
  const draft = type === 'trip' ? await readDraft(key) : null;
  if (state.user !== user || activeCarId() !== carId) return;
  if (draft && !resume && (confirmation.open
      || !await ask('Есть незавершённая поездка', 'Восстановить черновик?', 'Восстановить'))) return;
  if (state.user !== user || activeCarId() !== carId) return;
  const unit = Object.hasOwn(fuelUnits, draft?.unit) ? draft.unit : fuelUnit();
  showPanel(entry ? 'Изменить запись' : historical ? 'Указать прошлое ТО' : types[type][0],
    entryForm(type, state.detail, entry, planId, draft, unit, historical), entry ? types[type][0] : '');
  const form = sheet.querySelector('#entry-form');
  currentForm = {
    form, type, entry, key, unit, historical, track: blankTrack(draft?.points, draft?.partial),
    routeChange: draft?.routeChange ?? (draft?.points?.length ? 'replace' : null), gpsControl: null, active: false,
    persisted: 0, manualDistance: draft?.manualDistance ?? (!!entry || !!draft?.distance),
    fuelInput: [...(entry?.data.fuel_fields || [])],
    manualDuration: draft?.manualDuration ?? !!entry?.data.duration_seconds, clockStarted: null,
    derived: null, timer: null, requestKey: draft?.requestKey
      ?? (!entry && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null),
    dirty: Boolean(draft), revision: draft?.revision ?? 0,
    savedCount: draft?.revision ? draft.points.length : 0, draftWrite: Promise.resolve(),
  };
  if (draft?.revision) currentForm.savedTrack = currentForm.track;
  if (type === 'trip') updateGps(currentForm);
  if (type === 'fuel') previewEntry(currentForm);
  if (template) fillEntryTemplate(currentForm, template);
  void loadEntryTemplates(currentForm, carId);
}
async function loadEntryTemplates(ctx, carId) {
  const drawer = ctx.form.querySelector('#entry-templates');
  if (!drawer) return;
  try {
    const {items} = await api('journal', {car_id: carId, type: ctx.type}, 'GET');
    if (currentForm !== ctx || !drawer.isConnected) return;
    const recent = new Map();
    for (const entry of items.filter(canRepeat)) {
      const key = entry.data.plan_id ?? entryTitle(entry).toLowerCase();
      if (!recent.has(key)) recent.set(key, entry);
      if (recent.size === 4) break;
    }
    const templates = [...recent.values()];
    if (!templates.length) return;
    ctx.templates = templates;
    drawer.querySelector('div').innerHTML = entryTemplates(templates);
    drawer.hidden = false;
  } catch { /* Optional shortcuts. */ }
}
function fillEntryTemplate(ctx, template) {
  if (!canRepeat(template) || ctx.entry || ctx.type !== template.type) return;
  const {form} = ctx;
  const fields = form.elements;
  const data = template.data;
  if (ctx.type === 'other') fields.category.value = data.category;
  else {
    fields.plan_id.value = data.plan_id ?? '';
    if (!fields.plan_id.value) fields.plan_id.value = '';
    fields.work.value = data.work;
    form.querySelector('#custom-work').hidden = Boolean(fields.plan_id.value);
    const ids = new Set((data.parts || []).map(part => Number(part.id)));
    for (const part of form.querySelectorAll('[name="part_ids"]')) part.checked = ids.has(Number(part.value));
  }
  fields.cost.value = template.cost;
  fields.note.value = template.note;
  const drawer = form.querySelector('#entry-templates');
  if (drawer) drawer.open = false;
  error(form);
}
function inferFuel(ctx) {
  const form = ctx.form;
  const keys = ['liters', 'price', 'cost'];
  const values = Object.fromEntries(keys.map(key => [key, form.elements[key].value]));
  const valid = key => values[key] !== '' && Number(values[key]) > 0 && form.elements[key].validity.valid;
  const manual = ctx.fuelInput.filter(valid).slice(0, 2);
  const fields = [...manual];
  if (fields.length < 2) {
    for (const key of keys) {
      if (fields.length === 2) break;
      if (!fields.includes(key) && key !== ctx.derived && valid(key)) fields.push(key);
    }
  }
  const validFields = fields.filter(valid);
  const result = fuelCalculation(values, validFields);
  if (ctx.derived && (!result || ctx.derived !== result.missing) && !manual.includes(ctx.derived)) {
    form.elements[ctx.derived].value = '';
  }
  ctx.derived = result?.missing ?? null;
  for (const key of keys) form.elements[key].toggleAttribute('data-calculated', key === ctx.derived);
  if (!result) return null;
  form.elements[result.missing].value = result[result.missing];
  return {...result, fields: validFields};
}
function previewEntry(ctx) {
  const output = ctx.form.querySelector('#entry-preview');
  if (!output || !state.detail) return;
  if (ctx.type === 'fuel') {
    const result = inferFuel(ctx);
    if (!result) {
      output.textContent = '';
      return;
    }
    output.textContent = {
      liters: 'Объём · ' + num(result.liters, 2) + ' л',
      price: 'Цена · ' + num(result.price, 2) + ' ₽/л',
      cost: 'Сумма · ' + num(result.cost, 2) + ' ₽',
    }[result.missing];
    return;
  }
  const distance = ctx.form.elements.distance;
  const speedOutput = ctx.form.querySelector('#speed-preview');
  const speed = distance.validity.valid ? averageSpeed(distance.value, tripDuration(ctx.form)) : null;
  speedOutput.textContent = speed === null ? '' : 'Средняя скорость · ' + num(speed, 1) + ' км/ч';
  if (distance.value === '' || !distance.validity.valid) {
    output.textContent = '';
    return;
  }
  const model = state.detail.state;
  const entered = tripFuelRate(ctx.form, ctx.unit);
  if (entered !== null && (!Number.isFinite(entered) || entered <= 0 || entered > 1000)) {
    output.textContent = 'Проверьте значение расхода.';
    return;
  }
  const historicalRate = ctx.entry?.metrics?.fuel_used != null && ctx.entry.data.consumption == null
    ? ctx.entry.metrics.fuel_used * 100 / ctx.entry.data.distance : null;
  const rate = entered ?? historicalRate ?? model.consumption;
  const fuel = rate == null ? null : Number(distance.value) * rate / 100;
  const date = `${ctx.form.elements.occurred_at.value} ${ctx.form.elements.occurred_time.value}`;
  const latest = state.detail.entries[0]?.occurred_at.slice(0, 16) || '';
  const projected = date >= latest && !ctx.entry ? 'Пробег ' + num(model.odometer + Number(distance.value), 2) + ' км' : '';
  output.textContent = [fuel == null ? '' : (entered === null ? 'Оценка · ' : '') + 'израсходовано ' + num(fuel, 2) + ' л',
    projected].filter(Boolean).join(' · ');
}
async function openEntryDetail(entry) {
  if (!entry) return;
  stopAndForgetForm();
  viewedEntry = entry;
  showPanel(entryTitle(entry), entryDetail(entry, fuelUnit()), types[entry.type][0]);
  if (!entry.data.route) return;
  const canvas = sheet.querySelector('#route-canvas');
  try {
    const {points} = await api('route', {car_id: activeCarId(), id: entry.id}, 'GET');
    if (canvas.isConnected && points.length) {
      canvas.hidden = false;
      drawRoute(canvas, points, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
      if (!Object.hasOwn(entry.data.route, 'average_speed')) {
        sheet.querySelector('#route-stats').innerHTML = routeStats(stringifyRoute(blankTrack(points, entry.data.route.partial)));
      }
    }
  } catch (failure) {
    if (canvas.isConnected) sheet.querySelector('#route-error').textContent = failure.message;
  }
}
async function working(form, task) {
  if (form.dataset.busy) return;
  form.dataset.busy = 'true';
  const button = form.querySelector('[type="submit"]');
  if (button) button.disabled = true;
  error(form);
  try {
    await task();
  } catch (failure) {
    error(form, failure.message);
  } finally {
    delete form.dataset.busy;
    if (button) button.disabled = false;
  }
}
function valuesOf(form) {
  return Object.fromEntries(new FormData(form));
}
function openCarForm(car) {
  if (garage.open) garage.close();
  showPanel(car ? 'Параметры машины' : 'Добавить машину', carForm(car));
  const form = sheet.querySelector('#car-form');
  syncCarSelection(form);
  if (!car) form.elements.vin.focus();
}
function carStep(form, step) {
  for (const id of ['car-vin-step', 'car-identification', 'car-confirmation']) {
    form.querySelector('#' + id).hidden = id !== step;
  }
  error(form);
  const fields = form.elements;
  const focus = { 'car-vin-step': fields.vin, 'car-identification': fields.brand_choice, 'car-confirmation': fields.initial_odometer };
  focus[step].focus();
}
function confirmCarSelection(form) {
  const identification = form.querySelector('#car-identification');
  for (const field of identification.querySelectorAll('input, select')) {
    if (field.checkValidity()) continue;
    if (identification.hidden) carStep(form, 'car-identification');
    field.reportValidity();
    return;
  }
  const fields = form.elements;
  const brand = fields.brand_choice.value;
  const model = fields.model_choice.value;
  const name = brand === legacy ? fields.name.value
    : [brand === custom ? fields.brand_custom.value : brand,
      brand === custom || model === custom ? fields.model_custom.value : model, fields.trim.value].filter(Boolean).join(' ');
  form.querySelector('#car-selection-summary').textContent = [name, fields.generation.value, fields.year.value,
    engines[fields.engine.value], fields.displacement.value && fields.displacement.value + ' л'].filter(Boolean).join(' · ');
  carStep(form, 'car-confirmation');
}
async function saveCar(form) {
  const data = valuesOf(form);
  const id = Number(form.dataset.id);
  if (data.tank_capacity && Number(data.initial_fuel) > Number(data.tank_capacity)) {
    throw new Error('Начальный остаток превышает объём бака.');
  }
  if (data.vin && !vinPattern.test(data.vin.trim())) throw new Error('Проверьте VIN. Нужны 17 букв и цифр без I, O и Q.');
  const photo = data.photo;
  const brand = data.brand_choice === custom ? data.brand_custom : data.brand_choice;
  const model = data.brand_choice === custom || data.model_choice === custom ? data.model_custom : data.model_choice;
  const specs = Object.fromEntries(['trim', 'generation', 'transmission', 'engine', 'displacement', 'power', 'custom_power']
    .map(field => [field, data[field]]));
  if (brand !== legacy) {
    if (!brand?.trim() || !model?.trim()) throw new Error('Укажите марку и модель.');
    Object.assign(specs, {brand: brand.trim(), model: model.trim()});
    data.name = [specs.brand, specs.model, specs.trim.trim()].filter(Boolean).join(' ');
  }
  data.specs = specs;
  for (const name of [...Object.keys(specs), 'brand_choice', 'model_choice', 'brand_custom', 'model_custom', 'generation_choice', 'variant']) {
    delete data[name];
  }
  delete data.photo;
  data.vin = data.vin.trim().toUpperCase();
  data.id = id;
  data.haldex = data.drive === 'awd' && data.haldex === '1';
  data.remove_photo = data.remove_photo === '1';
  let payload = data;
  if (photo.size) {
    const prepared = await preparePhoto(photo);
    payload = new FormData();
    payload.set('data', JSON.stringify(data));
    payload.set('photo', prepared, 'car.jpg');
  }
  const result = await api('save_car', payload);
  state.photoVersion.set(Number(result.id), Date.now());
  closePanel(true);
  await refreshGarage();
  if (!id) goto('dashboard');
  renderShell();
  toast('Машина сохранена');
}
async function saveEntry(form) {
  const ctx = currentForm;
  if (!ctx || ctx.form !== form) return;
  if (ctx.active) throw new Error('Остановите GPS-запись перед сохранением.');
  stopTripTimer(ctx);
  const input = valuesOf(form);
  input.occurred_at += `T${input.occurred_time}`;
  delete input.occurred_time;
  if (input.occurred_at > nowLocal()) throw new Error('Дата записи не может быть в будущем.');
  const type = ctx.type;
  Object.assign(input, {id: Number(form.dataset.id), type, car_id: activeCarId()});
  if (ctx.requestKey) input.request_key = ctx.requestKey;
  if (type === 'fuel') {
    const result = inferFuel(ctx);
    if (!result) throw new Error('Заполните два корректных значения заправки.');
    Object.assign(input, {liters: result.liters, price: result.price, cost: result.cost, fuel_fields: result.fields, full: input.full === '1'});
  } else if (type === 'service') {
    if (!input.plan_id && !input.work.trim()) throw new Error('Введите название работы.');
    input.part_ids = new FormData(form).getAll('part_ids');
    input.historical = ctx.historical;
  } else if (type === 'trip') {
    const consumption = tripFuelRate(form, ctx.unit);
    if (consumption !== null && (!Number.isFinite(consumption) || consumption <= 0 || consumption > 1000)) {
      throw new Error('Проверьте значение расхода.');
    }
    input.consumption = consumption;
    input.duration_seconds = tripDuration(form);
    if (input.duration_value !== '' && input.duration_seconds === null) throw new Error('Укажите длительность от секунды до 30 суток.');
    delete input.duration_value;
    delete input.duration_unit;
    if (ctx.routeChange) {
      input.points = ctx.track.points;
      input.partial = ctx.track.partial;
    }
  }
  await api('save_entry', input);
  if (type === 'trip') {
    ctx.discardDraft = true;
    await ctx.draftWrite;
    await removeDraft(ctx.key);
  }
  closePanel(true);
  await refreshCar();
  renderView();
  toast('Запись сохранена');
}
async function saveCatalog(form, kind) {
  const data = {...valuesOf(form), car_id: activeCarId(), id: Number(form.dataset.id)};
  await api('save_' + kind, data);
  await refreshCar();
  renderView();
  if (kind === 'plan') showPanel('План обслуживания', plansView(state.detail.plans));
  else closePanel(true);
  toast(kind === 'plan' ? 'Интервал сохранён' : 'Запчасть сохранена');
}
document.addEventListener('submit', event => {
  const form = event.target;
  const action = {
    'auth-form': async () => {
      const register = form.dataset.register === '1';
      await api(register ? 'register' : 'login', valuesOf(form));
      await refreshGarage();
      if (!state.user) throw new Error('Разрешите cookies, чтобы войти.');
      state.register = false;
      goto('dashboard');
      if (register && !state.cars.length) openCarForm();
    },
    'car-form': () => saveCar(form),
    'entry-form': () => saveEntry(form),
    'part-form': () => saveCatalog(form, 'part'),
    'plan-form': () => saveCatalog(form, 'plan'),
    'delete-account-form': async () => {
      await api('delete_account', valuesOf(form));
      closePrivateViews();
      await clearAccountDrafts();
      try { localStorage.removeItem(fuelUnitKey()); } catch { /* Optional browser preference. */ }
      history.replaceState(null, '', location.pathname);
      renderAuth();
    },
    'period-form': () => {
      const {from, to} = valuesOf(form);
      if (from && to && from > to) throw new Error('Дата начала должна быть не позже даты окончания.');
      state.from = from;
      state.to = to;
      renderView();
    },
  }[form.id];
  if (!action) return;
  event.preventDefault();
  if (form.id === 'car-form' && form.querySelector('#car-confirmation').hidden) return;
  if (!form.checkValidity()) {
    const invalid = form.querySelector(':invalid');
    if (invalid?.closest('details')) invalid.closest('details').open = true;
    form.reportValidity();
    return;
  }
  void working(form, action);
});
document.addEventListener('invalid', event => {
  const details = event.target.closest('details');
  if (details) details.open = true;
}, true);
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing || event.target.form?.id !== 'car-form') return;
  const field = event.target;
  if (field.name === 'vin') {
    event.preventDefault();
    field.form.querySelector('[data-action="lookup-vin"]').click();
  }
});
document.addEventListener('input', event => {
  const field = event.target;
  if (field.id === 'journal-search') {
    state.search = field.value;
    state.journalRequest++;
    const more = document.querySelector('[data-action="journal-more"]');
    if (more) more.disabled = true;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyJournal, 180);
  }
  const ctx = currentForm;
  if (!ctx || field.form !== ctx.form) return;
  if (ctx.type === 'trip') ctx.dirty = true;
  if (ctx.type === 'fuel' && ['liters', 'price', 'cost'].includes(field.name)) {
    if (ctx.derived === field.name) ctx.derived = null;
    const previous = ctx.fuelInput.filter(key => key !== field.name);
    ctx.fuelInput = field.value === '' ? previous : [field.name, ...previous].slice(0, 2);
  }
  if (ctx.type === 'trip' && field.name === 'distance') {
    ctx.manualDistance = true;
    persistDraft(ctx);
  }
  if (ctx.type === 'trip' && ['duration_value', 'duration_unit'].includes(field.name)) {
    ctx.manualDuration = true;
    updateTimerLabel(ctx);
    persistDraft(ctx, true);
  }
  if (ctx.type === 'trip' && ['consumption', 'note', 'occurred_at', 'occurred_time'].includes(field.name)) persistDraft(ctx, true);
  clearTimeout(ctx.timer);
  ctx.timer = setTimeout(() => previewEntry(ctx), 270);
});
document.addEventListener('change', event => {
  const field = event.target;
  if (field.form?.id === 'car-form') {
    const form = field.form;
    if (['brand_choice', 'model_choice', 'generation_choice'].includes(field.name)) {
      resetPresetFields(form);
      form.elements.variant.value = '';
      if (field.name !== 'generation_choice') form.elements.generation_choice.value = '';
    } else if (field.name === 'variant') {
      resetPresetFields(form);
    }
    syncCarSelection(form, field.name === 'brand_choice');
    if (['generation_choice', 'variant'].includes(field.name)) applyCarPreset(form);
  }
  if (field.form?.id === 'entry-form' && field.name === 'plan_id') {
    sheet.querySelector('#custom-work').hidden = Boolean(field.value);
  }
  if (field.form?.id !== 'settings-form' || !state.user) return;
  if (field.name === 'fuel_unit') {
    if (!Object.hasOwn(fuelUnits, field.value)) return;
    if (!writeLocal(fuelUnitKey(), field.value)) {
      field.form.querySelector(`[name="fuel_unit"][value="${fuelUnit()}"]`).checked = true;
      error(field.form, 'Не удалось сохранить единицы расхода в браузере.');
    } else error(field.form);
    return;
  }
  const user = state.user;
  const name = field.name;
  const value = name === 'neon' ? field.checked : field.value;
  const version = preferenceVersions[name] = (preferenceVersions[name] || 0) + 1;
  user[name] = value;
  applyTheme();
  preferenceQueue = preferenceQueue.then(async () => {
    if (state.user !== user) return;
    try {
      await api('preferences', {[name]: value});
      if (state.user !== user) return;
      confirmedPreferences[name] = value;
      if (version === preferenceVersions[name] && field.form) error(field.form);
    } catch (failure) {
      if (state.user !== user || version !== preferenceVersions[name]) return;
      user[name] = confirmedPreferences[name];
      applyTheme();
      if (state.page === 'settings') {
        const form = document.querySelector('#settings-form');
        for (const option of form.querySelectorAll(`[name="${name}"]`)) {
          option.checked = name === 'neon' ? Boolean(Number(user[name])) : option.value === user[name];
        }
        error(form, failure.message);
      }
    }
  });
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled || button.closest('form')?.dataset.busy) return;
  const id = Number(button.dataset.id);
  const entry = Number(viewedEntry?.id) === id ? viewedEntry : null;
  const part = state.detail?.parts.find(item => Number(item.id) === id);
  const plan = state.detail?.plans.find(item => Number(item.id) === id);
  const actions = {
    'open-garage': openGarage,
    'close-garage': () => garage.close(),
    'close-panel': closePanel,
    'auth-toggle': () => { state.register = !state.register; renderAuth(); },
    'open-settings': () => goto('settings'),
    'open-menu': () => showPanel('Меню', menuView()),
    'menu-page': () => { closePanel(); goto(button.dataset.page); },
    'new-car': () => openCarForm(),
    'edit-car': () => openCarForm(state.detail.car),
    'note-preset': () => applyCarPreset(button.form, true),
    'car-next': () => confirmCarSelection(button.form),
    'car-back': () => carStep(button.form, 'car-identification'),
    'car-vin': () => carStep(button.form, 'car-vin-step'),
    'car-manual': () => {
      const vin = button.form.elements.vin;
      vin.value = vinPattern.test(vin.value.trim()) ? vin.value.trim().toUpperCase() : '';
      carStep(button.form, 'car-identification');
    },
    'fuel-level': () => {
      const {tank_capacity: tank, initial_fuel: fuel} = button.form.elements;
      if (!tank.value || !tank.validity.valid) { tank.focus(); return; }
      fuel.value = Number((Number(tank.value) * Number(button.dataset.level)).toFixed(2));
    },
    'lookup-vin': () => working(button.form, async () => {
      const form = button.form;
      const vin = form.elements.vin.value.trim().toUpperCase();
      if (!vinPattern.test(vin)) throw new Error('Проверьте VIN. Нужны 17 букв и цифр без I, O и Q.');
      form.elements.vin.value = vin;
      const result = await api('vin', {vin});
      if (!form.isConnected) return;
      form.querySelector('#vin-result').textContent = result.message;
      if (result.car) {
        const newCar = !Number(form.dataset.id);
        if (newCar) {
          resetPresetFields(form);
          form.elements.generation_choice.value = '';
          form.elements.variant.value = '';
        }
        applyVinCar(form, result.car, newCar);
        if (newCar && form.elements.brand_choice.value) confirmCarSelection(form);
      }
    }),
    'select-car': async () => {
      for (const card of garage.querySelectorAll('button[data-action="select-car"]')) card.disabled = true;
      try {
        await api('select_car', {car_id: id});
        state.user.last_car_id = id;
        await refreshCar();
        state.search = '';
        state.filter = 'all';
        if (garage.open) garage.close();
        goto('dashboard');
      } finally {
        for (const card of garage.querySelectorAll('button[data-action="select-car"]')) card.disabled = false;
      }
    },
    'entry-chooser': () => showPanel('Добавить запись', entryChooser()),
    'new-entry': () => openEntry(button.dataset.type),
    'entry-detail': async () => {
      const carId = activeCarId();
      const item = await api('entry', {car_id: carId, id}, 'GET');
      if (button.isConnected && state.user && activeCarId() === carId) await openEntryDetail(item);
    },
    'edit-entry': () => entry && openEntry(entry.type, {entry}),
    'repeat-entry': () => canRepeat(entry) && openEntry(entry.type, {template: entry}),
    'use-entry-template': () => {
      const ctx = currentForm;
      const template = ctx?.templates?.find(item => Number(item.id) === id);
      if (template && ctx.form === button.form) fillEntryTemplate(ctx, template);
    },
    'delete-entry': async () => {
      if (!entry || !await ask('Удалить запись?', 'Пробег, остаток топлива и сроки обслуживания пересчитаются.', 'Удалить')) return;
      await api('delete_entry', {id, car_id: activeCarId()});
      if (entry.type === 'trip') await removeDraft('moykm-trip:' + state.user.id + ':' + state.detail.car.id + ':' + id);
      closePanel();
      await refreshCar();
      renderView();
      toast('Запись удалена');
    },
    'journal-filter': () => {
      state.filter = button.dataset.type;
      for (const filter of app.querySelectorAll('.filter')) {
        const selected = filter === button;
        filter.classList.toggle('selected', selected);
        filter.setAttribute('aria-pressed', selected);
      }
      applyJournal();
    },
    'journal-more': () => { button.disabled = true; return applyJournal(true); },
    'all-period': () => { state.from = ''; state.to = ''; renderView(); },
    'plans': () => showPanel('План обслуживания', plansView(state.detail.plans)),
    'new-plan': () => showPanel('Новая работа', planForm()),
    'edit-plan': () => { if (plan) showPanel('Интервал обслуживания', planForm(plan)); },
    'perform-plan': () => plan && openEntry('service', {planId: id}),
    'past-service': () => plan && openEntry('service', {planId: id, historical: true}),
    'resume-trip': () => openEntry('trip', {resume: true}),
    'discard-trip': async () => {
      const key = draftKey();
      if (!await ask('Удалить черновик поездки?', 'Записанные точки будут удалены.', 'Удалить')) return;
      await removeDraft(key);
      renderView();
    },
    'actual-fuel': () => {
      button.form.elements.liters.value = (state.detail.car.tank_capacity * Number(button.dataset.level)).toFixed(2);
    },
    'archive-car': async () => {
      const car = state.detail.car;
      if (!await ask('Архивировать машину?', car.name, 'В архив')) return;
      await api('archive_car', {car_id: car.id, archived: true});
      await refreshGarage();
      renderShell();
    },
    'restore-car': async () => {
      await api('archive_car', {car_id: id, archived: false});
      await refreshGarage();
      renderShell();
    },
    'delete-account': () => showPanel('Удалить аккаунт', deleteAccountForm()),
    'map-track': async () => {
      const carId = activeCarId();
      const {points} = await api('route', {car_id: carId, id}, 'GET');
      if (!button.isConnected || !state.user || activeCarId() !== carId) return;
      mapTrack = points;
      closePanel();
      goto('map');
    },
    'new-part': () => showPanel('Новая запчасть', partForm()),
    'edit-part': () => { if (part) showPanel('Изменить запчасть', partForm(part)); },
    'copy-part': async () => {
      if (!part) return;
      await navigator.clipboard.writeText(part.article);
      toast('Артикул скопирован');
    },
    'delete-part': async () => {
      if (!part || !await ask('Удалить запчасть?', 'Артикул останется в записях о выполненных работах.', 'Удалить')) return;
      await api('delete_part', {id, car_id: activeCarId()});
      closePanel();
      await refreshCar();
      renderView();
      toast('Запчасть удалена');
    },
    'gps-start': () => {
      const ctx = currentForm;
      if (!ctx || ctx.active) return;
      ctx.gpsControl = recorder(ctx.track, update => {
        if (ctx !== currentForm) return;
        if (update.track.points.length) ctx.routeChange = 'replace';
        updateGps(ctx, update);
      });
    },
    'trip-timer': () => {
      const ctx = currentForm;
      if (!ctx || ctx.type !== 'trip') return;
      if (ctx.clockStarted !== null) { stopTripTimer(ctx); return; }
      ctx.clockOffset = tripDuration(ctx.form) ?? 0;
      if (ctx.clockOffset >= MAX_TRIP_SECONDS) {
        toast('Достигнута максимальная длительность поездки.');
        return;
      }
      ctx.clockStarted = Date.now();
      ctx.form.elements.duration_value.readOnly = true;
      ctx.form.elements.duration_unit.disabled = true;
      tickTripTimer(ctx);
      ctx.clockInterval = setInterval(() => tickTripTimer(ctx), 1000);
    },
    'gps-stop': () => currentForm?.gpsControl?.stop(),
    'gps-clear': () => {
      const ctx = currentForm;
      if (!ctx) return;
      ctx.track = blankTrack();
      ctx.routeChange = 'remove';
      ctx.dirty = true;
      updateGps(ctx);
    },
    'logout': async () => {
      await preferenceQueue;
      await api('logout', {});
      closePrivateViews();
      await clearAccountDrafts();
      history.replaceState(null, '', location.pathname);
      renderAuth();
    },
    'revoke-session': async () => {
      if (!await ask('Отозвать сессию?', 'На этом устройстве потребуется войти снова.', 'Отозвать')) return;
      await api('revoke', {id: button.dataset.id});
      await loadSessions();
      toast('Сессия отозвана');
    },
  };
  if (Object.hasOwn(actions, button.dataset.action)) {
    Promise.resolve().then(actions[button.dataset.action]).catch(failure => toast(failure.message));
  }
});
window.addEventListener('hashchange', navigate);
sheet.addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
garage.addEventListener('click', event => { if (event.target === garage) garage.close(); });
sheet.addEventListener('click', event => { if (event.target === sheet) closePanel(); });
window.addEventListener('pagehide', () => { if (currentForm?.type === 'trip') persistDraft(currentForm, true); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentForm?.type === 'trip') persistDraft(currentForm, true);
});
app.addEventListener('touchstart', event => {
  const y = event.touches[0]?.clientY ?? 0;
  if (window.scrollY > 2 || state.page !== 'dashboard' || y < 14 || y > 350 || event.touches.length !== 1
      || !event.target.closest('#page-header, #car-hero')) return;
  pointer = {x: event.touches[0].clientX, y};
}, {passive: true});
app.addEventListener('touchmove', event => {
  if (!pointer) return;
  const point = event.touches[0];
  if (Math.abs(point.clientX - pointer.x) > 45 || point.clientY - pointer.y < -12) {
    pointer = null;
    return;
  }
  if (point.clientY - pointer.y > 64) {
    pointer = null;
    if (event.cancelable) event.preventDefault();
    openGarage();
  }
}, {passive: false});
app.addEventListener('touchend', () => { pointer = null; }, {passive: true});
app.addEventListener('touchcancel', () => { pointer = null; }, {passive: true});
try {
  await refreshGarage();
  if (state.user) navigate();
  else renderAuth();
} catch (failure) {
  renderAuth(failure.message);
}
