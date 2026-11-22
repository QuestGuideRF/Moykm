'use strict';
if (window.parent !== window) {
  const appOrigin = new URL(location.href).origin;
  const send = (type, data = {}) => parent.postMessage({channel: 'moykm-map', type, ...data}, appOrigin);
  let map, searchControl, route, pin, locationMarker, accuracyCircle;
  let searchVersion = 0;
  let routeVersion = 0;
  let started = false;
  function init(key, enterprise) {
    if (started) return;
    started = true;
    const script = document.createElement('script');
    const host = enterprise ? 'enterprise.api-maps.yandex.ru' : 'api-maps.yandex.ru';
    const url = new URL(`https://${host}/2.1.79/`);
    url.search = new URLSearchParams({apikey: key, lang: 'ru_RU', csp: 'true'});
    script.src = url;
    script.onerror = () => send('unavailable');
    script.onload = () => {
      if (!window.ymaps) return send('unavailable');
      ymaps.ready(() => {
        try {
          map = new ymaps.Map('map', {center: [55.76, 37.64], zoom: 11, controls: ['zoomControl']});
          map.behaviors.disable('scrollZoom');
          searchControl = new ymaps.control.SearchControl({options: {
            provider: 'yandex#search', visible: false, noSelect: true, noPopup: true, results: 5,
          }});
          map.controls.add(searchControl);
          map.events.add('click', event => send('pick', {point: event.get('coords')}));
          send('ready');
        } catch {
          send('unavailable');
        }
      });
    };
    document.head.append(script);
  }
  function clearRoute() {
    routeVersion++;
    if (route) map.geoObjects.remove(route);
    route = null;
  }
  async function searchPlaces({id, query}) {
    const version = ++searchVersion;
    try {
      let found;
      try {
        await searchControl.search(query);
        found = searchControl.getResultsArray();
      } catch {
        const geocoded = await ymaps.geocode(query, {results: 5, boundedBy: map.getBounds()});
        found = [];
        geocoded.geoObjects.each(item => found.push(item));
      }
      if (version !== searchVersion) return;
      const results = found.slice(0, 5).map(item => ({
        point: item.geometry.getCoordinates(),
        label: String(item.getAddressLine?.() || [item.properties.get('name'), item.properties.get('description')].filter(Boolean).join(', ')),
      }));
      send('search-results', {id, results});
    } catch {
      if (version === searchVersion) send('search-error', {id});
    }
  }
  async function buildRoute(message) {
    const version = ++routeVersion;
    try {
      const next = await ymaps.route([message.from, message.to], {avoidTrafficJams: true, reverseGeocoding: false});
      if (version !== routeVersion) return;
      const segments = [];
      next.getPaths().each(path => {
        for (const segment of path.getSegments()) {
          segments.push({line: segment.getCoordinates(), action: String(segment.getHumanAction() || ''),
            street: String(segment.getStreet() || ''), meters: segment.getLength()});
        }
      });
      const finish = next.getWayPoints().get(1)?.geometry.getCoordinates();
      if (route) map.geoObjects.remove(route);
      route = next;
      route.getPaths().options.set({strokeWidth: 6, strokeColor: '#c44d17', opacity: 0.9});
      map.geoObjects.add(route);
      const bounds = route.getPaths().getBounds();
      if (!message.follow && bounds) {
        const inset = Math.min(Math.max(0, Number(message.inset) || 0), window.innerHeight * .45);
        map.setBounds(bounds, {checkZoomRange: true, zoomMargin: [48, 36, 50 + inset, 36]});
      }
      send('route', {id: message.id, segments, finish, meters: route.getLength(), seconds: route.getJamsTime() || route.getTime()});
    } catch {
      if (version === routeVersion) send('route-error', {id: message.id});
    }
  }
  function showTrack(points) {
    try {
      if (!Array.isArray(points) || !points.length || points.length > 30000) return;
      const collection = new ymaps.GeoObjectCollection();
      let segment = [];
      const addSegment = () => {
        if (segment.length > 1) {
          collection.add(new ymaps.Polyline(segment, {}, {strokeWidth: 5, strokeColor: '#c44d17'}));
        } else if (segment.length) {
          collection.add(new ymaps.Placemark(segment[0], {}, {preset: 'islands#orangeDotIcon'}));
        }
      };
      for (const point of points) {
        if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
        if (point[5] && segment.length) {
          addSegment();
          segment = [];
        }
        segment.push([point[0], point[1]]);
      }
      addSegment();
      map.geoObjects.add(collection);
      const bounds = collection.getBounds();
      if (bounds) map.setBounds(bounds, {checkZoomRange: true, zoomMargin: [64, 36, 210, 36]});
    } catch {
      send('track-error');
    }
  }
  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== parent || event.origin !== appOrigin || message?.channel !== 'moykm-map') return;
    if (message.type === 'init' && typeof message.key === 'string') init(message.key, message.enterprise === true);
    if (!map) return;
    if (message.type === 'search' && typeof message.query === 'string') void searchPlaces(message);
    if (message.type === 'saved-track') showTrack(message.points);
    if (message.type === 'route') void buildRoute(message);
    if (message.type === 'clear-route') clearRoute();
    if (message.type === 'cancel-route') routeVersion++;
    if (message.type === 'clear-pin' && pin) {
      map.geoObjects.remove(pin);
      pin = null;
    }
    if (message.type === 'pick') {
      if (!pin) {
        pin = new ymaps.Placemark(message.point, {}, {preset: 'islands#orangeDotIcon', interactiveZIndex: false});
        map.geoObjects.add(pin);
      } else pin.geometry.setCoordinates(message.point);
      if (message.center) map.setCenter(message.point, 16);
    }
    if (message.type === 'position') {
      if (!locationMarker) {
        accuracyCircle = new ymaps.Circle([message.point, message.accuracy], {}, {fillColor: '#2277dd22', strokeColor: '#2277dd66', strokeWidth: 1, interactivityModel: 'default#transparent'});
        locationMarker = new ymaps.Placemark(message.point, {}, {preset: 'islands#blueCircleDotIcon', zIndex: 500});
        map.geoObjects.add(accuracyCircle).add(locationMarker);
      } else {
        accuracyCircle.geometry.setCoordinates(message.point);
        accuracyCircle.geometry.setRadius(message.accuracy);
        locationMarker.geometry.setCoordinates(message.point);
      }
      if (message.follow) map.setCenter(message.point, 16);
    }
  });
  send('boot');
}
