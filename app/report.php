<?php
declare(strict_types=1);
function storedRouteSummary(int $entryId): ?array
{
    $route = row('SELECT points FROM routes WHERE entry_id = ?', [$entryId]);
    if (!$route) {
        return null;
    }
    try {
        $points = json_decode($route['points'], true, 32, JSON_THROW_ON_ERROR);
        [, $summary] = routeData($points, false);
        return $summary;
    } catch (JsonException | ApiException) {
        return null;
    }
}
function periodStats(string $from, string $to, callable $replay, ?callable $readRoute = null): array
{
    $cost = $distance = $fuel = $timedDistance = $timedSeconds = $timedTrips = 0;
    $inferred = false;
    $fuelKnown = true;
    $categories = [];
    $gps = ['meters' => 0, 'seconds' => 0, 'tracks' => 0, 'motion_tracks' => 0, 'accelerations' => 0, 'brakings' => 0];
    $inside = static fn(string $at): bool => ($from === '' || substr($at, 0, 10) >= $from)
        && ($to === '' || substr($at, 0, 10) <= $to);
    $result = $replay(static function (array $entry) use (
        $inside, $readRoute, &$cost, &$distance, &$fuel, &$fuelKnown, &$timedDistance, &$timedSeconds, &$timedTrips, &$inferred, &$categories, &$gps
    ): void {
        if (!$inside($entry['occurred_at'])) {
            return;
        }
        $metrics = $entry['metrics'];
        $distance += $metrics['distance'];
        $inferred = $inferred || $metrics['inferred_distance'] > 0;
        $fuelKnown = $fuelKnown && $metrics['fuel_used'] !== null;
        $fuel += $metrics['fuel_used'] ?? 0;
        $data = $entry['data'];
        if ($entry['type'] === 'trip' && !empty($data['duration_seconds'])) {
            $timedDistance += $data['distance'];
            $timedSeconds += $data['duration_seconds'];
            $timedTrips++;
        }
        $route = $entry['type'] === 'trip' ? ($data['route'] ?? []) : [];
        if ($route) {
            $summary = $route;
            if (!isset($route['tracked_seconds'], $route['distance_meters']) && $readRoute !== null) {
                $summary = $readRoute((int) $entry['id']) ?? $route;
            }
            $complete = empty($summary['partial']);
            $seconds = $summary['tracked_seconds'] ?? ($complete ? ($summary['duration_seconds'] ?? 0) : 0);
            $meters = $summary['distance_meters'] ?? (isset($summary['distance']) ? 1000 * $summary['distance'] : null);
            if ($seconds > 0 && $meters !== null) {
                $gps['seconds'] += $seconds;
                $gps['meters'] += $meters;
                $gps['tracks']++;
            }
        }
        if (!empty($route['speed_samples']) || !empty($route['accelerations']) || !empty($route['brakings'])) {
            $gps['motion_tracks']++;
            $gps['accelerations'] += $route['accelerations'] ?? 0;
            $gps['brakings'] += $route['brakings'] ?? 0;
        }
        $cost += (float) $entry['cost'];
        if ($entry['cost'] > 0) {
            $category = match ($entry['type']) {
                'fuel' => 'Топливо', 'service' => 'Сервис', default => $data['category'] ?? 'Другое',
            };
            $categories[$category] = ($categories[$category] ?? 0) + (float) $entry['cost'];
        }
    });
    $measuredDistance = $measuredFuel = 0;
    foreach ($result['measurements'] as $interval) {
        if ($inside($interval['from']) && $inside($interval['to'])) {
            $measuredDistance += $interval['distance'];
            $measuredFuel += $interval['liters'];
        }
    }
    arsort($categories, SORT_NUMERIC);
    return [
        'cost' => round($cost, 2), 'distance' => round($distance, 2), 'inferred' => $inferred,
        'categories' => array_map(static fn(string $name, float $total): array => [$name, round($total, 2)],
            array_keys($categories), array_values($categories)),
        'consumption' => $measuredDistance ? round(100 * $measuredFuel / $measuredDistance, 2)
            : ($distance && $fuelKnown ? round(100 * $fuel / $distance, 2) : null),
        'consumptionMeasured' => $measuredDistance > 0,
        'perKm' => $distance && $cost ? round($cost / $distance, 2) : null,
        'averageSpeed' => $timedSeconds ? round(3600 * $timedDistance / $timedSeconds, 1) : null,
        'timedTrips' => $timedTrips,
        'gpsAverageSpeed' => $gps['seconds'] > 0 ? round(3.6 * $gps['meters'] / $gps['seconds'], 1) : null,
        'gpsTracks' => $gps['tracks'],
        'accelerations' => $gps['motion_tracks'] ? $gps['accelerations'] : null,
        'brakings' => $gps['motion_tracks'] ? $gps['brakings'] : null,
    ];
}
function carDetail(array $car, string $asOf): array
{
    $latest = [];
    $lastFuel = null;
    $details = [];
    $stats = periodStats(substr($asOf, 0, 7) . '-01', substr($asOf, 0, 10),
        static function (callable $collect) use ($car, $asOf, &$latest, &$lastFuel, &$details): array {
            return $details = ledger($car, historyFor($car, $asOf), plansFor($car), $asOf,
                static function (array $entry) use ($collect, &$latest, &$lastFuel): void {
                    $collect($entry);
                    $latest[] = $entry;
                    if (count($latest) > 4) {
                        array_shift($latest);
                    }
                    if ($entry['type'] === 'fuel') {
                        $lastFuel = $entry['data'];
                    }
                });
        }, 'storedRouteSummary');
    unset($details['measurements']);
    $pending = row('SELECT id FROM entries WHERE car_id = ? AND (pending = 1 OR occurred_at > ?) LIMIT 1', [$car['id'], $asOf]);
    return ['car' => $car, 'parts' => partsFor($car), 'entries' => array_reverse($latest),
        'last_fuel' => $lastFuel, 'month' => $stats, 'has_pending' => $pending !== null, ...$details];
}
function journalPage(array $car, array $params, string $asOf): array
{
    $filter = choice($params['type'] ?? 'all', ['all', 'pending', ...ENTRY_TYPES], 'Тип записи');
    $search = textField($params['search'] ?? '', 'Поиск', 160);
    $values = [$car['id'], $asOf];
    $where = $filter === 'pending' ? '(pending = 1 OR occurred_at > ?)' : 'pending = 0 AND occurred_at <= ?';
    if ($filter !== 'all' && $filter !== 'pending') {
        $where .= ' AND type = ?';
        $values[] = $filter;
    }
    $cursor = empty($params['before']) ? null : row('SELECT id, occurred_at FROM entries WHERE id = ? AND car_id = ?',
        [positiveId($params['before']), $car['id']]);
    if ($cursor) {
        $where .= ' AND (occurred_at < ? OR (occurred_at = ? AND id < ?))';
        array_push($values, $cursor['occurred_at'], $cursor['occurred_at'], $cursor['id']);
    }
    foreach (preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY) as $word) {
        $where .= " AND LOCATE(LOWER(?), LOWER(CONCAT_WS(' ', note, occurred_at, DATE_FORMAT(occurred_at, '%d.%m.%Y'),
            ELT(MONTH(occurred_at), 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'), cost, CAST(data AS CHAR),
            CASE type WHEN 'trip' THEN 'Поездка' WHEN 'fuel' THEN 'Заправка' WHEN 'service' THEN 'Сервис'
                WHEN 'fuel_level' THEN 'Уровень топлива' WHEN 'odometer' THEN 'Корректировка пробега' ELSE 'Прочее' END))) > 0";
        $values[] = $word;
    }
    $items = rows("SELECT id, type, occurred_at, note, cost, odometer, data
        FROM entries WHERE car_id = ? AND $where ORDER BY occurred_at DESC, id DESC LIMIT 25", $values);
    $hasMore = count($items) > 24;
    if ($hasMore) {
        array_pop($items);
    }
    return ['items' => array_map('decodeEntry', $items), 'next' => $hasMore ? (int) end($items)['id'] : null];
}
function accountExport(array $account): array
{
    $cars = rows('SELECT * FROM cars WHERE user_id = ? ORDER BY id', [$account['id']]);
    foreach ($cars as &$car) {
        $id = $car['id'];
        $car['specs'] = $car['specs'] === null ? null : json_decode($car['specs'], true, 16, JSON_THROW_ON_ERROR);
        $car['entries'] = array_map('decodeEntry', rows('SELECT id, type, occurred_at, pending, note, cost, odometer, data
            FROM entries WHERE car_id = ? ORDER BY occurred_at, id', [$id]));
        $car['routes'] = array_map(static function (array $route): array {
            $route['points'] = json_decode($route['points'], true, 32, JSON_THROW_ON_ERROR);
            return $route;
        }, rows('SELECT r.entry_id, r.points FROM routes r JOIN entries e ON e.id = r.entry_id
                 WHERE e.car_id = ? ORDER BY r.entry_id', [$id]));
        $photo = row('SELECT mime, content FROM car_photos WHERE car_id = ?', [$id]);
        $car['photo'] = $photo ? ['mime' => $photo['mime'], 'base64' => base64_encode($photo['content'])] : null;
        $car['parts'] = partsFor($car);
        $car['plans'] = rows('SELECT id, code, name, interval_km, interval_months, planned_date
                              FROM plans WHERE car_id = ? ORDER BY id', [$id]);
    }
    return ['version' => 1, 'exported_at' => date(DATE_ATOM), 'account' => $account,
        'cars' => $cars, 'places' => savedPlaces($account)];
}
function entryFor(array $car, int $id, string $asOf): array
{
    $entry = row('SELECT id, type, occurred_at, note, cost, odometer, pending, data FROM entries WHERE id = ? AND car_id = ?',
        [$id, $car['id']]);
    if (!$entry) {
        fail(404, 'Запись не найдена.');
    }
    if ($entry['pending'] || $entry['occurred_at'] > $asOf) {
        return [...decodeEntry($entry), 'pending' => true, 'metrics' => []];
    }
    $result = null;
    ledger($car, historyFor($car, $entry['occurred_at']), [], $asOf, static function (array $item) use ($id, &$result): void {
        if ((int) $item['id'] === $id) {
            $result = $item;
        }
    });
    return $result ?? decodeEntry($entry);
}
