<?php
declare(strict_types=1);
const ENTRY_TYPES = ['trip', 'fuel', 'service', 'other', 'fuel_level', 'odometer'];
function distanceMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $h = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return 12742000 * asin(sqrt(min(1, $h)));
}
function routeData(mixed $points, bool $partial): array
{
    if (!is_array($points) || count($points) > 30000 || !array_is_list($points)) {
        fail(422, 'Маршрут превышает 30 000 точек или имеет неверный формат.');
    }
    $clean = [];
    $previous = null;
    $meters = 0;
    $trackedSeconds = 0;
    $speedSamples = 0;
    $peakAcceleration = 0;
    $accelerations = 0;
    $brakings = 0;
    $previousMotion = 0;
    foreach ($points as $point) {
        if (!is_array($point) || !array_is_list($point) || count($point) !== 6 || !is_bool($point[5])) {
            fail(422, 'Некорректная точка маршрута.');
        }
        $lat = numberField($point[0], 'Широта', -90, 90, 6);
        $lon = numberField($point[1], 'Долгота', -180, 180, 6);
        $accuracy = numberField($point[2], 'Точность GPS', 0, 200, 1);
        $speed = numberField($point[3], 'Скорость GPS', 0, 120, 2, false);
        $time = numberField($point[4], 'Время точки', 946684800000, 7258118400000, 0);
        $split = false;
        $motion = 0;
        if ($previous !== null) {
            $seconds = ($time - $previous[4]) / 1000;
            if ($seconds <= 0) {
                fail(422, 'Точки маршрута должны идти по порядку.');
            }
            $step = distanceMeters($previous[0], $previous[1], $lat, $lon);
            $split = $point[5] || $seconds > 25 || $step / $seconds > 100;
            if ($split) {
                $partial = true;
            } else {
                $trackedSeconds += $seconds;
                $noise = max(3, min(30, ($accuracy + $previous[2]) / 2));
                if ($step >= $noise || ($speed !== null && $speed >= 2 && $step >= 2)) {
                    $meters += $step;
                }
                if ($seconds >= 0.8 && $seconds <= 5 && $accuracy <= 15 && $previous[2] <= 15
                    && $speed !== null && $previous[3] !== null) {
                    $change = ($speed - $previous[3]) / $seconds;
                    $speedSamples++;
                    $peakAcceleration = max($peakAcceleration, $change);
                    $motion = $change >= 2.5 ? 1 : ($change <= -2.5 ? -1 : 0);
                    $accelerations += (int) ($motion === 1 && $previousMotion !== 1);
                    $brakings += (int) ($motion === -1 && $previousMotion !== -1);
                }
            }
        }
        $previousMotion = $motion;
        $previous = [$lat, $lon, $accuracy, $speed, $time, $split];
        $clean[] = $previous;
    }
    return [$clean, [
        'points_count' => count($clean),
        'distance' => round($meters / 1000, 2),
        'distance_meters' => $meters,
        'tracked_seconds' => round($trackedSeconds, 3),
        'duration_seconds' => count($clean) >= 2 ? max(1, (int) round(($previous[4] - $clean[0][4]) / 1000)) : null,
        'average_speed' => $trackedSeconds > 0 ? round(3.6 * $meters / $trackedSeconds, 1) : null,
        'speed_samples' => $speedSamples,
        'peak_acceleration' => $speedSamples ? round($peakAcceleration, 1) : null,
        'partial' => $partial || count($clean) < 2,
        'accelerations' => $accelerations,
        'brakings' => $brakings,
    ]];
}
function fuelFields(array $body): array
{
    $values = [
        'liters' => numberField($body['liters'] ?? null, 'Литры', 0.01, 500, 2, false),
        'price' => numberField($body['price'] ?? null, 'Цена за литр', 0.01, 100000, 2, false),
        'cost' => numberField($body['cost'] ?? null, 'Итоговая сумма', 0.01, 50000000, 2, false),
    ];
    $present = array_keys(array_filter($values, static fn($value) => $value !== null));
    $provided = $body['fuel_fields'] ?? $present;
    if (!is_array($provided) || !array_is_list($provided) || count($provided) < 2 || count($provided) > 3
        || count(array_filter($provided, static fn($field) => is_string($field) && in_array($field, $present, true))) !== count($provided)
        || count(array_unique($provided)) !== count($provided)) {
        fail(422, 'Заполните два поля из трёх: литры, цену за литр или сумму.');
    }
    $provided = array_slice($provided, 0, 2);
    $missing = array_values(array_diff(array_keys($values), $provided))[0];
    $calculated = match ($missing) {
        'liters' => $values['cost'] / $values['price'],
        'price' => $values['cost'] / $values['liters'],
        'cost' => $values['liters'] * $values['price'],
    };
    $maxima = ['liters' => 500, 'price' => 100000, 'cost' => 50000000];
    $values[$missing] = numberField(round($calculated, 2), 'Расчётное значение', 0.01, $maxima[$missing]);
    return [$values['liters'], $values['price'], $values['cost'], $provided];
}
function partSnapshots(array $car, mixed $rawIds, array $previous): array
{
    if (!is_array($rawIds) || !array_is_list($rawIds) || count($rawIds) > 100) {
        fail(422, 'Проверьте список запчастей.');
    }
    $ids = array_unique(array_map('positiveId', $rawIds));
    $available = array_column($previous, null, 'id') + array_column(partsFor($car), null, 'id');
    $selected = [];
    foreach ($ids as $id) {
        $selected[] = $available[$id] ?? fail(422, 'Запчасть не найдена в этой машине.');
    }
    return $selected;
}
function saveEntry(array $user, array $body): int
{
    $type = choice($body['type'] ?? null, ENTRY_TYPES, 'Тип записи');
    $date = dateField($body['occurred_at'] ?? null, 'Дата и время', true);
    if ($date > date('Y-m-d H:i:s')) {
        fail(422, 'Дата записи не может быть в будущем.');
    }
    $note = textField($body['note'] ?? null, 'Заметка', 1000);
    $requestKey = $body['request_key'] ?? null;
    if ($requestKey !== null && (!is_string($requestKey)
        || !preg_match('/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/D', $requestKey))) {
        fail(422, 'Обновите форму и попробуйте ещё раз.');
    }
    $historical = $type === 'service' && ($body['historical'] ?? false) === true;
    $odometer = in_array($type, ['odometer', 'service', 'fuel'], true)
        ? numberField($body['odometer'] ?? null, 'Пробег', 0, 99999999.99, 2,
            $type === 'odometer' || ($type === 'service' && !$historical))
        : null;
    return transaction(function () use ($user, $body, $type, $date, $note, $odometer, $requestKey, $historical): int {
        $car = carFor($user, $body['car_id'] ?? null, true);
        $id = empty($body['id']) ? null : positiveId($body['id']);
        if ($id === null && $requestKey !== null) {
            $saved = row('SELECT id FROM entries WHERE car_id = ? AND request_key = ?', [$car['id'], $requestKey]);
            if ($saved) {
                return (int) $saved['id'];
            }
        }
        $previous = [];
        if ($id) {
            $entry = row('SELECT type, data FROM entries WHERE id = ? AND car_id = ?', [$id, $car['id']]);
            if (!$entry || $entry['type'] !== $type) {
                fail(404, 'Запись не найдена.');
            }
            $previous = json_decode($entry['data'], true, 32, JSON_THROW_ON_ERROR);
        }
        $points = null;
        $cost = 0;
        switch ($type) {
            case 'trip':
                $details = ['distance' => numberField($body['distance'] ?? null, 'Расстояние', 0.01, 100000)];
                $consumption = array_key_exists('consumption', $body) ? $body['consumption'] : ($previous['consumption'] ?? null);
                $consumption = numberField($consumption, 'Расход поездки', 0.000001, 1000, 6, false);
                if ($consumption !== null) {
                    $details['consumption'] = $consumption;
                }
                $duration = array_key_exists('duration_seconds', $body) ? $body['duration_seconds'] : ($previous['duration_seconds'] ?? null);
                $duration = numberField($duration, 'Время в пути', 1, 2592000, 0, false);
                if ($duration !== null) {
                    $details['duration_seconds'] = (int) $duration;
                }
                if (array_key_exists('points', $body)) {
                    [$points, $details['route']] = routeData($body['points'], ($body['partial'] ?? false) === true);
                    if (!$points) {
                        unset($details['route']);
                    }
                } elseif (isset($previous['route'])) {
                    $details['route'] = $previous['route'];
                }
                break;
            case 'fuel':
                [$liters, $price, $cost, $provided] = fuelFields($body);
                $details = [
                    'liters' => $liters,
                    'price' => $price,
                    'fuel_fields' => $provided,
                    'station' => textField($body['station'] ?? null, 'АЗС', 80),
                    'fuel_type' => choice($body['fuel_type'] ?? '', ['', ...FUEL_TYPES], 'Вид топлива'),
                    'full' => ($body['full'] ?? false) === true,
                    'additive' => textField($body['additive'] ?? null, 'Присадка', 80),
                ];
                break;
            case 'service':
                $planId = empty($body['plan_id']) ? null : positiveId($body['plan_id']);
                $plan = $planId ? row('SELECT id, code, name FROM plans WHERE id = ? AND car_id = ?', [$planId, $car['id']]) : null;
                if ($planId && (!$plan || ($plan['code'] === 'haldex' && !$car['haldex'] && $planId !== ($previous['plan_id'] ?? null)))) {
                    fail(422, 'Выберите работу из плана этой машины.');
                }
                if ($historical && !$plan) {
                    fail(422, 'Выберите работу из плана обслуживания.');
                }
                $details = [
                    'plan_id' => $planId,
                    'work' => $plan ? $plan['name'] : textField($body['work'] ?? null, 'Работа', 80, true),
                    'parts' => partSnapshots($car, $body['part_ids'] ?? [], $previous['parts'] ?? []),
                ];
                if ($historical) {
                    $details['historical'] = true;
                }
                $cost = numberField($body['cost'] ?? null, 'Стоимость', 0, 9999999999.99, 2, !$historical) ?? 0;
                break;
            case 'other':
                $details = ['category' => choice($body['category'] ?? null, OTHER_CATEGORIES, 'Категория')];
                $cost = numberField($body['cost'] ?? null, 'Сумма', 0.01, 9999999999.99);
                break;
            case 'fuel_level':
                $details = ['liters' => numberField($body['liters'] ?? null, 'Остаток топлива', 0,
                    (float) ($car['tank_capacity'] ?? 500))];
                break;
            case 'odometer':
                $details = [];
                break;
        }
        $values = [$date, $note, $cost, $odometer, json_encode($details, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)];
        if ($id) {
            query('UPDATE entries SET occurred_at = ?, note = ?, cost = ?, odometer = ?, data = ?, pending = 0
                   WHERE id = ? AND car_id = ?', [...$values, $id, $car['id']]);
        } else {
            query('INSERT INTO entries (occurred_at, note, cost, odometer, data, car_id, type, request_key)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [...$values, $car['id'], $type, $requestKey]);
            $id = (int) db()->lastInsertId();
        }
        if ($points !== null) {
            query('DELETE FROM routes WHERE entry_id = ?', [$id]);
            if ($points) {
                query('INSERT INTO routes (entry_id, points) VALUES (?, ?)', [$id, json_encode($points, JSON_THROW_ON_ERROR)]);
            }
        }
        return $id;
    });
}
function decodeEntry(array $entry): array
{
    $entry['data'] = json_decode($entry['data'], true, 32, JSON_THROW_ON_ERROR);
    return $entry;
}
function historyFor(array $car, string $asOf): Generator
{
    $query = query('SELECT id, type, occurred_at, note, cost, odometer, data
                    FROM entries WHERE car_id = ? AND pending = 0 AND occurred_at <= ? ORDER BY occurred_at, id',
        [$car['id'], $asOf]);
    while ($entry = $query->fetch(PDO::FETCH_ASSOC)) {
        yield decodeEntry($entry);
    }
}
function addMonths(string $date, int $months): string
{
    $start = new DateTimeImmutable(substr($date, 0, 10));
    $month = $start->modify('first day of this month')->modify("+$months months");
    $day = min((int) $start->format('j'), (int) $month->format('t'));
    return $month->format('Y-m-') . str_pad((string) $day, 2, '0', STR_PAD_LEFT);
}
function ledger(array $car, iterable $history, array $plans, string $asOf, ?callable $onEntry = null): array
{
    $today = substr($asOf, 0, 10);
    $odometer = (float) $car['initial_odometer'];
    $tank = isset($car['tank_capacity']) ? (float) $car['tank_capacity'] : null;
    $fuel = isset($car['initial_fuel']) ? (float) $car['initial_fuel'] : null;
    $rate = isset($car['base_consumption']) ? (float) $car['base_consumption'] : null;
    $measurements = [];
    $recentMeasurements = [];
    $lastFull = null;
    $intervalLiters = 0;
    $serviced = [];
    $recentDistance = 0;
    $recentFrom = (new DateTimeImmutable($today))->modify('-89 days')->format('Y-m-d');
    $firstRecentDay = null;
    foreach ($history as $entry) {
        if (!empty($entry['pending']) || $entry['occurred_at'] > $asOf) {
            continue;
        }
        $data = $entry['data'];
        $type = $entry['type'];
        $hasReading = $entry['odometer'] !== null && empty($data['historical']);
        $recorded = $entry['type'] === 'trip' ? (float) $data['distance'] : 0;
        $gap = $hasReading && $type !== 'odometer' ? max(0, (float) $entry['odometer'] - $odometer) : 0;
        $distance = $recorded + $gap;
        $tripRate = $entry['type'] === 'trip' ? ($data['consumption'] ?? $rate) : $rate;
        $burn = ($recorded > 0 && $tripRate === null) || ($gap > 0 && $rate === null)
            ? null : ($recorded * ($tripRate ?? 0) + $gap * ($rate ?? 0)) / 100;
        $odometer += $distance;
        $fuel = $fuel !== null && $burn !== null ? max(0, $fuel - $burn) : null;
        if ($type === 'odometer') {
            $odometer = (float) $entry['odometer'];
            $lastFull = null;
        } elseif ($type === 'fuel_level') {
            $fuel = min($tank ?? PHP_FLOAT_MAX, (float) $data['liters']);
        }
        $entry['metrics'] = [
            'distance' => round($distance, 2),
            'inferred_distance' => round($gap, 2),
            'fuel_used' => $burn === null ? null : round($burn, 2),
            'odometer' => round($odometer, 2),
            'odometer_conflict' => $hasReading && (float) $entry['odometer'] < round($odometer, 2),
        ];
        if ($onEntry !== null) {
            $onEntry($entry);
        }
        $day = substr($entry['occurred_at'], 0, 10);
        if ($day >= $recentFrom && $day <= $today) {
            $firstRecentDay ??= $day;
            $recentDistance += $distance;
        }
        if ($entry['type'] === 'fuel') {
            $compatibleFuel = $car['fuel_type'] === '' || $data['fuel_type'] === $car['fuel_type'];
            $intervalLiters += (float) $data['liters'];
            if ($fuel !== null) {
                $fuel = min($tank ?? PHP_FLOAT_MAX, $fuel + $data['liters']);
            }
            if (!$compatibleFuel || ($lastFull !== null && $lastFull['fuel_type'] !== $data['fuel_type'])) {
                $lastFull = null;
            }
            if ($data['full']) {
                $fuel = $tank ?? $fuel;
                if ($lastFull !== null) {
                    $intervalDistance = $odometer - $lastFull['odometer'];
                    $measuredRate = $intervalDistance > 0 ? 100 * $intervalLiters / $intervalDistance : 0;
                    if ($measuredRate >= 0.5 && $measuredRate <= 100) {
                        $measurement = [
                            'from' => $lastFull['date'], 'to' => $entry['occurred_at'],
                            'distance' => $intervalDistance, 'liters' => $intervalLiters,
                        ];
                        $measurements[] = $measurement;
                        $recentMeasurements[] = $measurement;
                        if (count($recentMeasurements) > 5) {
                            array_shift($recentMeasurements);
                        }
                        $rate = 100 * array_sum(array_column($recentMeasurements, 'liters'))
                            / array_sum(array_column($recentMeasurements, 'distance'));
                    }
                }
                $lastFull = $compatibleFuel ? ['odometer' => $odometer, 'date' => $entry['occurred_at'],
                    'fuel_type' => $data['fuel_type']] : null;
                $intervalLiters = 0;
            }
        } elseif ($type === 'service' && !empty($data['plan_id'])) {
            $serviced[$data['plan_id']] = ['odometer' => $entry['odometer'], 'date' => $day];
        }
    }
    $days = $firstRecentDay ? ((new DateTimeImmutable($firstRecentDay))->diff(new DateTimeImmutable($today))->days + 1) : 0;
    $pace = $days >= 7 ? $recentDistance / $days : 0;
    foreach ($plans as &$plan) {
        $last = $serviced[$plan['id']] ?? null;
        $dueKm = $plan['interval_km'] && isset($last['odometer']) ? ($last['odometer'] + $plan['interval_km']) : null;
        $dueDate = $plan['interval_months'] && isset($last['date']) ? addMonths($last['date'], (int) $plan['interval_months']) : null;
        $daysLeft = $dueDate ? (int) (new DateTimeImmutable($today))->diff(new DateTimeImmutable($dueDate))->format('%r%a') : null;
        $kmLeft = $dueKm !== null ? round($dueKm - $odometer, 2) : null;
        $overdue = ($kmLeft !== null && $kmLeft < 0) || ($daysLeft !== null && $daysLeft < 0);
        $due = !$overdue && (($kmLeft !== null && $kmLeft == 0) || $daysLeft === 0);
        $booking = $plan['planned_date'] ?? null;
        if ($booking !== null && $last !== null && $last['date'] >= $booking) {
            $booking = null;
        }
        $score = $overdue || $due ? -1 : min(
            $kmLeft === null ? PHP_FLOAT_MAX : ($pace > 0 ? $kmLeft / $pace : 365 * $kmLeft / $plan['interval_km']),
            $daysLeft ?? PHP_FLOAT_MAX,
            $booking === null ? PHP_FLOAT_MAX
                : max(0, (int) (new DateTimeImmutable($today))->diff(new DateTimeImmutable($booking))->format('%r%a'))
        );
        $plan += [
            'last' => $last, 'due_odometer' => $dueKm, 'due_date' => $dueDate,
            'remaining_km' => $kmLeft, 'remaining_days' => $daysLeft,
            'overdue' => $overdue, 'due' => $due, 'order' => $score, 'booking' => $booking,
        ];
    }
    unset($plan);
    usort($plans, static fn($first, $second) => $first['order'] <=> $second['order']);
    foreach ($plans as &$plan) {
        unset($plan['order']);
    }
    unset($plan);
    return [
        'plans' => $plans,
        'measurements' => $measurements,
        'state' => [
            'odometer' => round($odometer, 2),
            'fuel' => $fuel === null ? null : round($fuel, 2),
            'range' => $fuel === null || !$rate ? null : (int) floor($fuel * 100 / $rate),
            'consumption' => $rate === null ? null : round($rate, 2),
            'consumption_source' => $measurements ? 'full_to_full' : 'base',
        ],
    ];
}
