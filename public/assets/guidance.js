import {metersBetween} from './gps.js';
export function isPoint(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
    && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;
}
export function routeProgressModel(segments) {
  const edges = [];
  const steps = [];
  let length = 0;
  for (const segment of segments) {
    const line = segment?.line;
    if (!Array.isArray(line) || line.length < 2 || !line.every(isPoint)) continue;
    const start = length;
    for (let index = 1; index < line.length; index++) {
      const from = line[index - 1];
      const to = line[index];
      const meters = metersBetween(from, to);
      if (!meters) continue;
      edges.push({from, to, start: length, meters});
      length += meters;
    }
    if (length > start) steps.push({end: length, action: segment.action, street: segment.street});
  }
  return {edges, steps, length};
}
function longitudeDelta(delta) {
  return delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta;
}
export function matchRoute(model, point, previous, accuracy) {
  const longitudeScale = Math.cos(point[0] * Math.PI / 180);
  const offset = other => [longitudeDelta(other[1] - point[1]) * longitudeScale, other[0] - point[0]];
  const tolerance = Math.max(35, accuracy * 1.4);
  let best = null;
  for (const {from, to, start, meters} of model.edges) {
    if (previous !== null && start + meters < previous - tolerance) continue;
    const [x, y] = offset(from);
    const [endX, endY] = offset(to);
    const dx = endX - x;
    const dy = endY - y;
    const squared = dx * dx + dy * dy;
    const ratio = squared ? Math.max(0, Math.min(1, -(x * dx + y * dy) / squared)) : 0;
    const distance = Math.hypot(x + dx * ratio, y + dy * ratio) * 111195;
    const progress = start + meters * ratio;
    const jump = previous === null ? 0 : Math.max(0, progress - previous - 160);
    const score = distance + Math.min(50, jump * 0.08);
    if (!best || score < best.score) best = {distance, progress, score};
  }
  if (!best || best.distance > tolerance) return null;
  const progress = Math.max(previous ?? 0, best.progress);
  const remaining = Math.max(0, model.length - progress);
  const index = model.steps.findIndex(step => step.end > progress + 12);
  const step = model.steps[index];
  return {progress, remaining, index, step, until: step ? step.end - progress : remaining};
}
