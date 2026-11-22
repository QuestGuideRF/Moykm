import {esc, icon, num} from './ui.js';
import {metersBetween} from './gps.js';
import {isPoint, matchRoute, routeProgressModel} from './guidance.js';
const gpsOptions = {enableHighAccuracy: true, timeout: 15000, maximumAge: 3000};
const gpsError = error => error.code === 1 ? 'Разрешите доступ к геопозиции в браузере.' : 'GPS недоступен. Проверьте геолокацию и попробуйте ещё раз.';
const distance = meters => meters < 1000 ? `${num(Math.max(0, Math.round(meters / 10) * 10))} м` : `${num(meters / 1000, 1)} км`;
const duration = seconds => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};
const coordinates = point => point.map(value => Number(value.toFixed(6))).join(', ');
const parsePoint = value => {
  if (!/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(value)) return null;
  const point = value.split(',').map(Number);
  return isPoint(point) ? point : null;
};
function getPosition() {
  if (!navigator.geolocation || !window.isSecureContext) return Promise.reject(new Error('Для доступа к GPS откройте сайт по HTTPS.'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, error => reject(new Error(gpsError(error))), gpsOptions));
}
function view() {
  return `<div class="maps-layout">
    <section class="map-card" aria-label="Яндекс Карты">
      <div class="map-stage"><div class="map-placeholder" role="status">${icon('pin', 30)}<p id="map-state">Загружаем карту…</p></div></div>
    </section>
    <div class="navigator-tools">
      <button type="button" class="button" data-map="places" aria-controls="places-panel" aria-expanded="false">${icon('pin', 18)} Мои места</button>
      <button class="icon-button" type="button" data-map="locate" aria-label="Моё местоположение" title="Моё местоположение">${icon('signal', 21)}</button>
    </div>
    <p id="map-hint" class="navigator-notice" role="status"></p>
    <section class="route-live" aria-label="Подсказки по маршруту" hidden>
      ${icon('range', 25)}<div><strong id="route-instruction"></strong><span id="route-live-data"></span></div>
    </section>
    <section class="card section-card navigator-sheet route-panel" id="route-panel" aria-labelledby="route-heading">
      <h2 id="route-heading">Куда поедем?</h2>
      <form id="map-route-form">
        <fieldset class="route-inputs">
          <div class="navigator-search"><label class="field"><span class="sr-only">Куда</span><input name="to" type="search" maxlength="180" placeholder="Адрес или место" autocomplete="off" required></label>
            <button type="submit" value="search" class="icon-button" aria-label="Найти адрес или место" disabled>${icon('search', 20)}</button></div>
          <ul class="navigator-results" id="map-results" aria-label="Результаты поиска" hidden></ul>
          <details class="map-origin"><summary>Откуда</summary><label class="field"><span class="sr-only">Точка старта</span><input name="from" maxlength="180" placeholder="Моё местоположение" autocomplete="off"></label></details>
          <div class="navigator-actions"><button class="button primary" type="submit" value="route" disabled hidden>Построить маршрут</button>
            <button class="button" type="button" data-map="new" id="save-map-point" hidden>${icon('plus', 17)} Сохранить точку</button></div>
        </fieldset>
      </form>
      <p class="map-message" id="route-status" role="status"></p>
      <div class="route-controls" hidden>
        <button class="button primary" type="button" data-map="start">Поехали</button>
        <button class="button wide" type="button" data-map="stop" hidden>Завершить навигацию</button>
        <label class="voice-option" hidden><input type="checkbox" id="route-voice"> Голосовые подсказки</label>
      </div>
      <details class="route-steps" hidden><summary>Все манёвры</summary><ol></ol></details>
    </section>
    <section class="card section-card navigator-sheet places-panel" id="places-panel" aria-labelledby="places-heading" hidden>
      <div class="section-heading"><h2 id="places-heading">Мои места</h2><div class="place-actions">
        <button class="icon-button" type="button" data-map="new" aria-label="Добавить место" title="Добавить место">${icon('plus', 19)}</button>
        <button class="icon-button" type="button" data-map="close-places" aria-label="Закрыть мои места">${icon('close', 19)}</button></div></div>
      <p class="map-message" id="places-status" role="status"></p>
      <form id="map-place-form" hidden>
        <label class="field">Название<input name="name" maxlength="80" required></label>
        <div class="form-grid-2"><label class="field">Широта<input name="latitude" type="number" min="-90" max="90" step="any" inputmode="decimal" required></label>
          <label class="field">Долгота<input name="longitude" type="number" min="-180" max="180" step="any" inputmode="decimal" required></label></div>
        <div class="place-actions"><button class="button primary" type="submit">Сохранить</button><button class="button" type="button" data-map="cancel">Отмена</button></div>
      </form>
      <div id="places-list"></div>
    </section>
  </div>`;
}
export function mountNavigation(root, api, ask, savedTrack = null) {
  root.innerHTML = view();
  const $ = selector => root.querySelector(selector);
  const requests = new AbortController();
  const options = {signal: requests.signal};
  const layout = $('.maps-layout');
  const mapStage = $('.map-stage');
  const mapHint = $('#map-hint');
  const routeForm = $('#map-route-form');
  const placeForm = $('#map-place-form');
  const fields = routeForm.elements;
  const summary = $('#route-status');
  const live = $('.route-live');
  const instruction = $('#route-instruction');
  const liveData = $('#route-live-data');
  const controls = $('.route-controls');
  const steps = $('.route-steps');
  const submitRoute = routeForm.querySelector('[value="route"]');
  const submitSearch = routeForm.querySelector('[value="search"]');
  const resultsList = $('#map-results');
  const startButton = $('[data-map="start"]');
  const stopButton = $('[data-map="stop"]');
  const voice = $('#route-voice');
  voice.closest('label').hidden = !('speechSynthesis' in window);
  let frame, mapConfig, frameTimer, routeTimer, searchTimer, activeSearch, activeRequest, route, watchId, wakeLock, lastPosition;
  let results = [];
  let ready = false;
  let sequence = 0;
  let places = [];
  let selectedPoint = null;
  let destinationPoint = null;
  let progress = null;
  let away = 0;
  let arrived = 0;
  let lastReroute = 0;
  let lastSpeech = '';
  let speech;
  const mounted = () => !requests.signal.aborted;
  const guiding = () => watchId !== undefined;
  const send = (type, data = {}) => frame?.contentWindow?.postMessage({channel: 'moykm-map', type, ...data}, '*');
  const fromValue = () => parsePoint(fields.from.value.trim()) || fields.from.value.trim();
  const toValue = () => destinationPoint || parsePoint(fields.to.value.trim()) || fields.to.value.trim();
  function setPane(pane) {
    $('.route-panel').hidden = pane !== 'route';
    $('.places-panel').hidden = pane !== 'places';
    $('[data-map="places"]').setAttribute('aria-expanded', pane === 'places');
  }
  function refreshRouteButtons() {
    submitRoute.disabled = !ready || !!activeRequest;
    submitRoute.hidden = !fields.to.value.trim() || Boolean(route);
    submitSearch.disabled = !ready || !!activeSearch || Boolean(activeRequest);
    routeForm.hidden = guiding();
    routeForm.closest('section').classList.toggle('is-guiding', guiding());
    controls.hidden = !route?.model.edges.length;
    startButton.hidden = guiding();
    stopButton.hidden = !guiding();
    live.hidden = !guiding();
    layout.classList.toggle('is-navigating', guiding());
    $('[data-map="places"]').hidden = guiding();
    $('#route-heading').textContent = guiding() ? 'В пути' : route ? 'Маршрут' : 'Куда поедем?';
  }
  function clearSearch() {
    clearTimeout(searchTimer);
    activeSearch = null;
    results = [];
    resultsList.hidden = true;
    resultsList.replaceChildren();
  }
  function searchPlaces(query) {
    clearSearch();
    clearRoute();
    const id = ++sequence;
    activeSearch = id;
    summary.textContent = 'Ищем места…';
    refreshRouteButtons();
    searchTimer = setTimeout(() => finishSearch({id, type: 'search-error'}), 12000);
    send('search', {id, query});
  }
  function finishSearch(message) {
    if (activeSearch == null || message.id !== activeSearch) return;
    clearSearch();
    refreshRouteButtons();
    if (message.type === 'search-error' || !Array.isArray(message.results)) {
      summary.textContent = 'Поиск недоступен. Попробуйте ещё раз или отметьте точку на карте.';
      return;
    }
    results = message.results.slice(0, 5).filter(item => item && isPoint(item.point) && typeof item.label === 'string');
    if (!results.length) {
      summary.textContent = 'Ничего не найдено. Уточните адрес.';
      return;
    }
    summary.textContent = '';
    resultsList.innerHTML = results.map((item, index) => `<li><button type="button" data-map="result" data-index="${index}">
      ${icon('pin', 18)}<span>${esc(item.label)}</span></button></li>`).join('');
    resultsList.hidden = false;
  }
  function clearRoute() {
    sequence++;
    activeRequest = null;
    route = null;
    summary.textContent = '';
    clearTimeout(routeTimer);
    if (ready) send('clear-route');
    steps.hidden = true;
    refreshRouteButtons();
  }
  function mapUnavailable(message) {
    ready = false;
    clearTimeout(frameTimer);
    frame?.remove();
    frame = null;
    mapStage.classList.add('is-unavailable');
    $('.map-placeholder').hidden = false;
    $('#map-state').textContent = message;
    mapHint.textContent = '';
    refreshRouteButtons();
  }
  function requestRoute(from, to, follow = false) {
    if (!ready) return;
    const id = ++sequence;
    activeRequest = {id, follow};
    lastReroute = Date.now();
    clearTimeout(routeTimer);
    routeTimer = setTimeout(() => {
      send('cancel-route');
      finishRoute({id, type: 'route-error'});
    }, 18000);
    summary.textContent = follow ? 'Перестраиваем маршрут…' : 'Строим маршрут…';
    refreshRouteButtons();
    send('route', {id, from, to, follow, inset: $('.route-panel').offsetHeight});
  }
  function finishRoute(message) {
    if (!activeRequest || message.id !== activeRequest.id) return;
    clearTimeout(routeTimer);
    activeRequest = null;
    if (message.type === 'route-error' || !isPoint(message.finish) || !Number.isFinite(message.meters) || !Number.isFinite(message.seconds)) {
      summary.textContent = 'Маршрут недоступен. Проверьте адреса и попробуйте снова.';
      refreshRouteButtons();
      return;
    }
    const segments = Array.isArray(message.segments) ? message.segments.slice(0, 6000) : [];
    const model = routeProgressModel(segments);
    route = {model, finish: message.finish};
    progress = null;
    away = 0;
    arrived = 0;
    lastSpeech = '';
    summary.textContent = `${distance(message.meters)} · около ${duration(message.seconds)}`;
    steps.hidden = !segments.length;
    const maneuvers = segments.filter(segment => Number.isFinite(segment?.meters));
    steps.querySelector('ol').innerHTML = maneuvers.map((segment, index) =>
      `<li><span>${esc(segment.street || 'По маршруту')}<small>${index < maneuvers.length - 1 ? esc(segment.action) : 'Прибытие'}</small></span><span>${distance(segment.meters)}</span></li>`).join('');
    refreshRouteButtons();
    if (guiding() && lastPosition) handlePosition(lastPosition);
  }
  function chooseDestination(point, label = '', personal = false, center = false) {
    if (guiding() || !isPoint(point)) return;
    selectedPoint = personal ? point : null;
    $('#save-map-point').hidden = !personal;
    destinationPoint = point;
    fields.to.value = label || coordinates(point);
    clearSearch();
    clearRoute();
    if (ready) send('pick', {point, center});
    if (personal && !placeForm.hidden && !placeForm.dataset.id) setPlacePoint(point);
    mapHint.textContent = '';
  }
  function onFrameMessage(event) {
    const message = event.data;
    if (!frame || event.source !== frame.contentWindow || event.origin !== 'null' || message?.channel !== 'moykm-map') return;
    if (message.type === 'boot') send('init', {key: mapConfig.key, enterprise: mapConfig.enterprise});
    if (message.type === 'ready') {
      clearTimeout(frameTimer);
      if (destinationPoint) send('pick', {point: destinationPoint, center: true});
      ready = true;
      frame.classList.add('is-ready');
      $('.map-placeholder').hidden = true;
      refreshRouteButtons();
      if (savedTrack?.length) {
        send('saved-track', {points: savedTrack});
        mapHint.textContent = 'Трек поездки';
      }
    }
    if (message.type === 'track-error') mapHint.textContent = 'Не удалось показать трек.';
    if (message.type === 'unavailable') mapUnavailable('Яндекс Карты недоступны. Проверьте подключение и настройки ключа.');
    if (message.type === 'search-error' || message.type === 'search-results') finishSearch(message);
    if (message.type === 'pick') chooseDestination(message.point, '', true);
    if (message.type === 'route' || message.type === 'route-error') finishRoute(message);
  }
  function speak(text) {
    if (!voice.checked || !('speechSynthesis' in window)) return;
    speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'ru-RU';
    window.speechSynthesis.speak(speech);
  }
  async function keepScreenOn() {
    if (wakeLock && !wakeLock.released || !guiding() || document.hidden || !navigator.wakeLock) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (guiding() && mounted()) wakeLock = lock;
      else await lock.release();
    } catch { /* Some browsers and battery modes do not grant a wake lock. */ }
  }
  function stopGuidance() {
    if (!guiding()) return;
    navigator.geolocation.clearWatch(watchId);
    watchId = undefined;
    lastPosition = null;
    if (wakeLock && !wakeLock.released) void wakeLock.release().catch(() => {});
    if (speech) window.speechSynthesis.cancel();
    if (activeRequest?.follow) {
      clearTimeout(routeTimer);
      activeRequest = null;
      send('cancel-route');
    }
    refreshRouteButtons();
  }
  function handlePosition(position) {
    if (!guiding() || !route) return;
    lastPosition = position;
    const {latitude, longitude, accuracy} = position.coords;
    const point = [latitude, longitude];
    if (!isPoint(point) || !Number.isFinite(accuracy)) return;
    send('position', {point, accuracy, follow: accuracy <= 60});
    if (accuracy > 60) {
      liveData.textContent = 'Слабый сигнал GPS';
      return;
    }
    const match = matchRoute(route.model, point, progress, accuracy);
    if (!match) {
      away++;
      arrived = 0;
      instruction.textContent = 'Вы вне маршрута';
      liveData.textContent = '';
      if (away >= 3 && !activeRequest && Date.now() - lastReroute > 25000) requestRoute(point, route.finish, true);
      return;
    }
    away = 0;
    progress = match.progress;
    arrived = match.remaining <= 30 && metersBetween(point, route.finish) <= 45 ? arrived + 1 : 0;
    if (arrived >= 2) {
      stopGuidance();
      summary.textContent = 'Вы на месте.';
      speak('Вы на месте');
      return;
    }
    const lastStep = !match.step || match.index === route.model.steps.length - 1;
    const action = lastStep ? 'До места назначения' : match.step.action || 'Продолжайте движение';
    instruction.textContent = `${distance(match.until)} · ${action}`;
    liveData.textContent = `Осталось ${distance(match.remaining)}${match.step?.street ? ' · ' + match.step.street : ''}`;
    const cue = `${match.index}:${action}`;
    if (!lastStep && match.until < 110 && lastSpeech !== cue && voice.checked) {
      lastSpeech = cue;
      speak(`Через ${Math.max(10, Math.round(match.until / 10) * 10)} метров, ${action}`);
    }
  }
  function startGuidance() {
    if (!route?.model.edges.length || guiding()) return;
    if (!navigator.geolocation || !window.isSecureContext) {
      summary.textContent = 'Для навигации откройте Moykm по HTTPS.';
      return;
    }
    progress = null;
    away = 0;
    arrived = 0;
    lastReroute = 0;
    lastSpeech = '';
    instruction.textContent = 'Ожидаем GPS';
    liveData.textContent = 'Держите вкладку с картой открытой.';
    watchId = navigator.geolocation.watchPosition(handlePosition, error => {
      if (!guiding()) return;
      if (error.code === 1) {
        stopGuidance();
        summary.textContent = gpsError(error);
      } else liveData.textContent = gpsError(error);
    }, gpsOptions);
    refreshRouteButtons();
    void keepScreenOn();
  }
  function setPlacePoint(point) {
    placeForm.elements.latitude.value = Number(point[0].toFixed(6));
    placeForm.elements.longitude.value = Number(point[1].toFixed(6));
  }
  function showPlaceForm(place = null) {
    setPane('places');
    $('#places-status').textContent = '';
    placeForm.reset();
    placeForm.dataset.id = place?.id || '';
    placeForm.elements.name.value = place?.name || '';
    const point = place ? [Number(place.latitude), Number(place.longitude)] : selectedPoint;
    if (point) setPlacePoint(point);
    placeForm.hidden = false;
    placeForm.elements.name.focus();
  }
  async function loadPlaces() {
    const result = await api('places');
    if (!mounted()) return;
    places = result.places;
    $('#places-list').innerHTML = places.length ? places.map(place => `<div class="place-row">
      <button type="button" data-map="destination" data-id="${Number(place.id)}" class="place-name" title="Маршрут сюда">${icon('pin', 18)}<span>${esc(place.name)}</span></button>
      <button type="button" class="icon-button" data-map="edit" data-id="${Number(place.id)}" aria-label="Изменить ${esc(place.name)}">${icon('edit', 16)}</button>
      <button type="button" class="icon-button" data-map="delete" data-id="${Number(place.id)}" aria-label="Удалить ${esc(place.name)}">${icon('trash', 16)}</button>
      </div>`).join('') : '<p class="muted places-empty">Сохранённых мест пока нет.</p>';
  }
  window.addEventListener('message', onFrameMessage, options);
  window.addEventListener('pagehide', stopGuidance, options);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void keepScreenOn(); }, options);
  routeForm.addEventListener('input', event => {
    if (event.target === fields.to) {
      destinationPoint = null;
      selectedPoint = null;
      $('#save-map-point').hidden = true;
      clearSearch();
      if (ready) send('clear-pin');
    }
    clearRoute();
  }, options);
  routeForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitRoute.disabled || guiding()) return;
    const to = toValue();
    if (!to) { fields.to.focus(); return; }
    if (event.submitter?.value === 'search' && !Array.isArray(to)) {
      searchPlaces(to);
      return;
    }
    clearSearch();
    const previous = ++sequence;
    let from = fromValue();
    try {
      if (!from) {
        summary.textContent = 'Определяем точку старта…';
        const {coords} = await getPosition();
        if (!mounted() || sequence !== previous) return;
        if (coords.accuracy > 100) throw new Error('Низкая точность GPS. Укажите точку старта вручную.');
        from = [coords.latitude, coords.longitude];
        send('position', {point: from, accuracy: coords.accuracy});
      }
      if (mounted() && sequence === previous) requestRoute(from, to);
    } catch (error) {
      if (mounted() && sequence === previous) {
        summary.textContent = error.message;
        $('.map-origin').open = true;
      }
    }
  }, options);
  placeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = placeForm.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    const data = Object.fromEntries(new FormData(placeForm));
    if (placeForm.dataset.id) data.id = Number(placeForm.dataset.id);
    try {
      if (!data.name.trim()) throw new Error('Введите название места.');
      await api('save_place', data);
      if (!mounted()) return;
      placeForm.hidden = true;
      $('#places-status').textContent = 'Место сохранено.';
      await loadPlaces();
    } catch (error) {
      if (mounted()) $('#places-status').textContent = error.message;
    } finally { submit.disabled = false; }
  }, options);
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-map]');
    if (!button || button.disabled) return;
    const action = button.dataset.map;
    const place = places.find(item => Number(item.id) === Number(button.dataset.id));
    try {
      if (action === 'places') setPane($('.places-panel').hidden ? 'places' : 'route');
      if (action === 'close-places') setPane('route');
      if (action === 'result') {
        const result = results[Number(button.dataset.index)];
        if (result) {
          chooseDestination(result.point, result.label.slice(0, 180), false, true);
          submitRoute.focus({preventScroll: true});
        }
      }
      if (action === 'start') startGuidance();
      if (action === 'stop') {
        stopGuidance();
        summary.textContent = 'Навигация завершена.';
      }
      if (action === 'locate') {
        button.disabled = true;
        const {coords} = await getPosition();
        if (!mounted()) return;
        const point = [coords.latitude, coords.longitude];
        if (coords.accuracy > 100) throw new Error('Низкая точность GPS. Попробуйте ещё раз.');
        if (!guiding() && !route) {
          selectedPoint = point;
          $('#save-map-point').hidden = false;
          fields.from.value = coordinates(point);
          clearRoute();
          if (!placeForm.hidden && !placeForm.dataset.id) setPlacePoint(point);
        }
        if (ready) send('position', {point, accuracy: coords.accuracy, follow: true});
        mapHint.textContent = 'Местоположение определено.';
      }
      if (action === 'destination' && place) {
        if (guiding()) { summary.textContent = 'Завершите навигацию перед выбором нового места.'; return; }
        setPane('route');
        chooseDestination([Number(place.latitude), Number(place.longitude)], place.name, true, true);
        fields.to.focus();
      }
      if (action === 'new') showPlaceForm();
      if (action === 'edit' && place) showPlaceForm(place);
      if (action === 'cancel') placeForm.hidden = true;
      if (action === 'delete' && place && await ask('Удалить место?', place.name, 'Удалить')) {
        await api('delete_place', {id: Number(place.id)});
        if (!mounted()) return;
        if (Number(placeForm.dataset.id) === Number(place.id)) placeForm.hidden = true;
        $('#places-status').textContent = 'Место удалено.';
        await loadPlaces();
      }
    } catch (error) {
      if (mounted()) (action === 'locate' ? mapHint : $('#places-status')).textContent = error.message;
    } finally {
      if (action === 'locate') button.disabled = false;
    }
  }, options);
  api('map_config').then(config => {
    if (!mounted()) return;
    mapConfig = config;
    if (!config.key) {
      mapUnavailable('Яндекс Карты пока не подключены. Сохранять свои места можно по координатам.');
      return;
    }
    frame = document.createElement('iframe');
    frame.title = 'Интерактивная карта Яндекса';
    frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    frame.src = 'map-frame.php';
    mapStage.append(frame);
    frameTimer = setTimeout(() => mapUnavailable('Карта не загрузилась. Проверьте подключение и настройки ключа.'), 15000);
  }).catch(() => { if (mounted()) mapUnavailable('Не удалось загрузить настройки карты.'); });
  loadPlaces().catch(error => { if (mounted()) $('#places-status').textContent = error.message; });
  return () => {
    stopGuidance();
    requests.abort();
    clearTimeout(frameTimer);
    clearTimeout(routeTimer);
    clearTimeout(searchTimer);
    if (speech) window.speechSynthesis.cancel();
    frame?.remove();
  };
}
