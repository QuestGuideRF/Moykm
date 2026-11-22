export function metersBetween(first, second) {
  const rad = Math.PI / 180;
  const h = Math.sin((second[0] - first[0]) * rad / 2) ** 2
    + Math.cos(first[0] * rad) * Math.cos(second[0] * rad) * Math.sin((second[1] - first[1]) * rad / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function updateTrack(track, point) {
  const previous = track.points.at(-1);
  let motion = 0;
  if (previous) {
    const elapsed = (point[4] - previous[4]) / 1000;
    if (elapsed <= 0) return;
    const step = metersBetween(previous, point);
    point[5] ||= elapsed > 25 || step / elapsed > 100;
    if (point[5]) {
      track.partial = true;
    } else {
      track.trackedSeconds += elapsed;
      const noise = Math.max(3, Math.min(30, (previous[2] + point[2]) / 2));
      if (step >= noise || (point[3] >= 2 && step >= 2)) track.meters += step;
      if (elapsed >= 0.8 && elapsed <= 5 && previous[2] <= 15 && point[2] <= 15 && previous[3] != null && point[3] != null) {
        const change = (point[3] - previous[3]) / elapsed;
        track.speedSamples++;
        track.peakAcceleration = Math.max(track.peakAcceleration, change);
        motion = change >= 2.5 ? 1 : change <= -2.5 ? -1 : 0;
        if (motion === 1 && track.motion !== 1) track.accelerations++;
        if (motion === -1 && track.motion !== -1) track.brakings++;
      }
    }
  } else {
    point[5] = false;
  }
  track.motion = motion;
  track.points.push(point);
}
export function blankTrack(points = [], partial = false) {
  const track = {points: [], meters: 0, partial, accelerations: 0, brakings: 0, motion: 0,
    trackedSeconds: 0, speedSamples: 0, peakAcceleration: 0};
  for (const point of points) updateTrack(track, [...point]);
  return track;
}
export function stringifyRoute(track) {
  return {
    distance: Math.round(track.meters / 10) / 100, partial: track.partial || track.points.length < 2,
    duration_seconds: track.points.length >= 2 ? Math.max(1, Math.round((track.points.at(-1)[4] - track.points[0][4]) / 1000)) : null,
    average_speed: track.trackedSeconds > 0 ? Math.round(36 * track.meters / track.trackedSeconds) / 10 : null,
    speed_samples: track.speedSamples,
    peak_acceleration: track.speedSamples ? Math.round(track.peakAcceleration * 10) / 10 : null,
    points_count: track.points.length, accelerations: track.accelerations, brakings: track.brakings,
  };
}
export function recorder(track, changed) {
  const position = navigator.geolocation;
  let watch = null;
  let split = track.points.length > 0;
  let message = '';
  let lastSignal = Date.now();
  function report() {
    changed({active: watch !== null, track, message});
  }
  function interrupt(reason) {
    if (watch === null) return;
    track.partial = true;
    split = true;
    message = reason;
    report();
  }
  function visibility() {
    if (document.hidden) interrupt('Страница была в фоне. Трек может быть частичным.');
  }
  function stop() {
    if (watch === null) return;
    position.clearWatch(watch);
    watch = null;
    if (Date.now() - lastSignal > 25000) track.partial = true;
    clearInterval(gapCheck);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', visibility);
    report();
  }
  if (!position || !window.isSecureContext) {
    message = 'GPS доступен на HTTPS или localhost.';
    report();
    return {stop};
  }
  if (track.points.length >= 30000) {
    message = 'Достигнут предел записи. Уточните расстояние вручную.';
    report();
    return {stop};
  }
  watch = position.watchPosition(result => {
    if (watch === null) return;
    const {latitude, longitude, accuracy, speed} = result.coords;
    const previous = track.points.at(-1);
    if (previous && result.timestamp <= previous[4]) return;
    if (accuracy > 80 || !Number.isFinite(accuracy)) {
      if (Date.now() - lastSignal > 25000) interrupt('Слабый сигнал GPS. Трек может быть частичным.');
      return;
    }
    lastSignal = Date.now();
    const velocity = Number.isFinite(speed) && speed >= 0 && speed <= 120 ? Number(speed.toFixed(2)) : null;
    updateTrack(track, [Number(latitude.toFixed(6)), Number(longitude.toFixed(6)), Number(accuracy.toFixed(1)), velocity, result.timestamp, split]);
    split = false;
    message = '';
    if (track.points.length >= 30000) {
      track.partial = true;
      message = 'Достигнут предел записи. Уточните расстояние вручную.';
      stop();
    } else {
      report();
    }
  }, error => {
    if (watch === null) return;
    if (error.code === 1) {
      message = 'Доступ к GPS закрыт. Разрешите его в браузере или введите километры.';
      stop();
    } else {
      interrupt('Нет сигнала GPS. Трек может быть частичным.');
    }
  }, {enableHighAccuracy: true, maximumAge: 2000, timeout: 15000});
  const gapCheck = setInterval(() => {
    if (!split && Date.now() - lastSignal > 25000) interrupt('В записи есть пропуск. Трек может быть частичным.');
  }, 3000);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', visibility);
  message = 'Ищем сигнал GPS…';
  report();
  return {stop};
}
export function drawRoute(canvas, points, accent) {
  const context = canvas.getContext('2d');
  const {width, height} = canvas;
  context.clearRect(0, 0, width, height);
  if (!points.length) return;
  const midLat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const factor = Math.max(0.01, Math.cos(midLat * Math.PI / 180));
  let previousLon = points[0][1];
  let longitude = previousLon;
  const xy = points.map(([lat, lon, , , , split]) => {
    longitude += ((lon - previousLon + 540) % 360) - 180;
    previousLon = lon;
    return [longitude * factor, -lat, split];
  });
  const bounds = xy.reduce(([minX, minY, maxX, maxY], [x, y]) => [
    Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  const [minX, minY, maxX, maxY] = bounds;
  const scale = Math.min((width - 48) / Math.max(maxX - minX, 0.000001), (height - 48) / Math.max(maxY - minY, 0.000001));
  const plotted = xy.map(([x, y, split]) => [width / 2 + (x - (minX + maxX) / 2) * scale, height / 2 + (y - (minY + maxY) / 2) * scale, split]);
  context.beginPath();
  plotted.forEach(([x, y, split], index) => index === 0 || split ? context.moveTo(x, y) : context.lineTo(x, y));
  context.lineWidth = 3.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = accent;
  context.fillStyle = accent;
  context.stroke();
  for (const [x, y] of [plotted[0], plotted.at(-1)]) {
    context.beginPath();
    context.arc(x, y, 4, 0, 2 * Math.PI);
    context.fill();
  }
}
