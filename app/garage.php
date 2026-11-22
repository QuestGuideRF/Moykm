<?php
declare(strict_types=1);
function carFor(array $user, mixed $id, bool $lock = false, bool $allowArchived = false): array
{
    $car = row(
        'SELECT c.*, EXISTS(SELECT 1 FROM car_photos p WHERE p.car_id = c.id) AS has_photo
         FROM cars c WHERE c.id = ? AND c.user_id = ?' . ($lock ? ' FOR UPDATE' : ''),
        [positiveId($id), $user['id']]
    );
    if ($car === null) {
        fail(404, 'Машина не найдена.');
    }
    if ($lock && !$allowArchived && $car['archived_at'] !== null) {
        fail(409, 'Сначала верните машину из архива.');
    }
    $car['specs'] = isset($car['specs']) ? json_decode($car['specs'], true, 16, JSON_THROW_ON_ERROR) : null;
    return $car;
}
function archiveCar(array $account, mixed $id, bool $archive): void
{
    transaction(static function () use ($account, $id, $archive): void {
        $car = carFor($account, $id, true, true);
        query('UPDATE cars SET archived_at = ? WHERE id = ?', [$archive ? date('Y-m-d H:i:s') : null, $car['id']]);
        if ($archive) {
            query('UPDATE users SET last_car_id = NULL WHERE id = ? AND last_car_id = ?', [$account['id'], $car['id']]);
        } else {
            query('UPDATE users SET last_car_id = COALESCE(last_car_id, ?) WHERE id = ?', [$car['id'], $account['id']]);
        }
    });
}
function vinValue(mixed $raw, bool $required = false): string
{
    $vin = strtoupper(textField($raw, 'VIN', 17, $required));
    if ($vin !== '' && !preg_match('/^[A-HJ-NPR-Z0-9]{17}$/D', $vin)) {
        fail(422, 'Проверьте VIN. Нужны 17 букв и цифр без I, O и Q.');
    }
    return $vin;
}
function carSpecs(mixed $data): ?array
{
    if ($data === null) {
        return null;
    }
    if (!is_array($data)) {
        fail(422, 'Проверьте характеристики машины.');
    }
    $specs = [
        'brand' => textField($data['brand'] ?? null, 'Марка', 28),
        'model' => textField($data['model'] ?? null, 'Модель', 28),
        'trim' => textField($data['trim'] ?? null, 'Комплектация', 22),
        'generation' => textField($data['generation'] ?? null, 'Поколение', 18),
        'transmission' => choice($data['transmission'] ?? '', ['', 'auto', 'manual', 'cvt', 'robot'], 'Коробка передач'),
        'engine' => choice($data['engine'] ?? '', ['', 'hybrid', 'petrol', 'diesel', 'gas', 'other'], 'Двигатель'),
        'displacement' => numberField($data['displacement'] ?? null, 'Объём двигателя', 0.1, 20, 2, false),
        'power' => numberField($data['power'] ?? null, 'Мощность ДВС', 1, 3000, 0, false),
        'custom_power' => numberField($data['custom_power'] ?? null, 'Мощность после доработки', 1, 3000, 0, false),
    ];
    if (($specs['brand'] === '') !== ($specs['model'] === '')) {
        fail(422, 'Укажите марку и модель.');
    }
    return array_filter($specs, static fn($value) => $value !== '' && $value !== null) ?: null;
}
function carFields(array $data): array
{
    $drive = empty($data['drive']) ? null : choice($data['drive'], ['front', 'rear', 'awd'], 'Привод');
    $tank = numberField($data['tank_capacity'] ?? null, 'Объём бака', 1, 500, 2, false);
    $specs = carSpecs($data['specs'] ?? null);
    $name = isset($specs['brand']) ? implode(' ', array_filter([$specs['brand'], $specs['model'], $specs['trim'] ?? ''])) : ($data['name'] ?? null);
    return [
        'name' => textField($name, 'Название', 80, true),
        'plate' => textField($data['plate'] ?? null, 'Госномер', 20),
        'vin' => vinValue($data['vin'] ?? null),
        'year' => numberField($data['year'] ?? null, 'Год выпуска', 1900, (int) date('Y') + 1, 0, false),
        'drive' => $drive,
        ...(array_key_exists('specs', $data) ? ['specs' => $specs === null ? null : json_encode($specs, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)] : []),
        'haldex' => (int) ($drive === 'awd' && ($data['haldex'] ?? false) === true),
        'fuel_type' => choice($data['fuel_type'] ?? '', ['', ...FUEL_TYPES], 'Вид топлива'),
        'initial_odometer' => numberField($data['initial_odometer'] ?? null, 'Начальный пробег', 0, 99999999.99),
        'tank_capacity' => $tank,
        'initial_fuel' => numberField($data['initial_fuel'] ?? null, 'Начальный остаток', 0, $tank ?? 500, 2, false),
        'base_consumption' => numberField($data['base_consumption'] ?? null, 'Базовый расход', 0.5, 100, 2, false),
    ];
}
function photoUpload(): ?array
{
    $file = $_FILES['photo'] ?? null;
    if (!$file || $file['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        fail(422, 'Не удалось загрузить фото. Попробуйте выбрать его заново.');
    }
    $info = @getimagesize($file['tmp_name']);
    $mime = $info['mime'] ?? '';
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || $info[0] < 1 || $info[1] < 1) {
        fail(422, 'Не удалось распознать изображение.');
    }
    $content = file_get_contents($file['tmp_name']);
    if ($content === false) {
        fail(422, 'Не удалось прочитать фото.');
    }
    return [$mime, $content];
}
function saveCar(array $user, array $data, ?array $photo): int
{
    $fields = carFields($data);
    return transaction(function () use ($user, $data, $photo, $fields): int {
        if (!empty($data['id'])) {
            $car = carFor($user, $data['id'], true);
            $id = (int) $car['id'];
            $assignments = implode(', ', array_map(static fn($key) => "$key = ?", array_keys($fields)));
            query("UPDATE cars SET $assignments WHERE id = ?", [...array_values($fields), $id]);
        } else {
            $columns = implode(', ', array_keys($fields));
            $values = implode(', ', array_fill(0, count($fields) + 1, '?'));
            query("INSERT INTO cars (user_id, $columns) VALUES ($values)", [$user['id'], ...array_values($fields)]);
            $id = (int) db()->lastInsertId();
            foreach ([
                ['oil', 'Замена масла', 10000, 12],
                ['air', 'Воздушный фильтр', 15000, 12],
                ['brake', 'Тормозная жидкость', null, 24],
            ] as $plan) {
                query('INSERT INTO plans (car_id, code, name, interval_km, interval_months) VALUES (?, ?, ?, ?, ?)', [$id, ...$plan]);
            }
        }
        if ($fields['haldex']) {
            query("INSERT INTO plans (car_id, code, name, interval_km, interval_months)
                   VALUES (?, 'haldex', 'Масло в муфте Haldex', 60000, 36)
                   ON DUPLICATE KEY UPDATE id = id", [$id]);
        }
        if ($photo) {
            query('INSERT INTO car_photos (car_id, mime, content) VALUES (?, ?, ?)
                   ON DUPLICATE KEY UPDATE mime = ?, content = ?', [$id, ...$photo, ...$photo]);
        } elseif (($data['remove_photo'] ?? false) === true) {
            query('DELETE FROM car_photos WHERE car_id = ?', [$id]);
        }
        if (empty($data['id'])) {
            query('UPDATE users SET last_car_id = ? WHERE id = ?', [$id, $user['id']]);
        }
        return $id;
    });
}
function lookupVin(string $vin): array
{
    $provider = settings()['vin_lookup'] ?? null;
    if (!is_callable($provider) && envValue('MOYKM_VIN_VPIC', '1') === '1') {
        $provider = 'lookupVpic';
    }
    if (!is_callable($provider)) {
        return ['car' => null, 'message' => 'Поиск по VIN пока недоступен. Заполните параметры вручную.'];
    }
    try {
        $data = $provider($vin);
        if (is_array($data)) {
            $fields = array_intersect_key($data, array_flip(['name', 'year', 'drive', 'haldex', 'fuel_type',
                'tank_capacity', 'base_consumption', 'specs']));
            return ['car' => $fields, 'message' => 'Проверьте характеристики перед сохранением.'];
        }
    } catch (Throwable $error) {
        error_log('Moykm VIN lookup failed: ' . get_class($error));
    }
    return ['car' => null, 'message' => 'По VIN не удалось получить характеристики. Заполните их вручную.'];
}
function lookupVpic(string $vin): ?array
{
    $context = stream_context_create(['http' => ['timeout' => 8, 'follow_location' => 0,
        'header' => "Accept: application/json\r\n"]]);
    $response = @file_get_contents('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/' . rawurlencode($vin)
        . '?format=json', false, $context, 0, 262144);
    if ($response === false) {
        return null;
    }
    $data = json_decode($response, true, 16, JSON_THROW_ON_ERROR)['Results'][0] ?? [];
    $brand = trim($data['Make'] ?? '');
    $model = trim($data['Model'] ?? '');
    if ($brand === '' || $model === '') {
        return null;
    }
    $number = static fn(string $field, float $min, float $max): ?float =>
        is_numeric($data[$field] ?? null) && $data[$field] >= $min && $data[$field] <= $max ? (float) $data[$field] : null;
    $engine = match (true) {
        (bool) preg_match('/hybrid|hev/i', $data['ElectrificationLevel'] ?? '') => 'hybrid',
        strtolower($data['FuelTypePrimary'] ?? '') === 'gasoline' => 'petrol',
        strtolower($data['FuelTypePrimary'] ?? '') === 'diesel' => 'diesel',
        default => null,
    };
    $transmission = strtolower($data['TransmissionStyle'] ?? '');
    $drive = $data['DriveType'] ?? '';
    $kw = $number('EngineKW', 1, 2000);
    $hp = $number('EngineHP', 1, 2900);
    return [
        'year' => $number('ModelYear', 1900, (int) date('Y') + 1),
        'drive' => match (true) {
            preg_match('/FWD|Front.Wheel/i', $drive) === 1 => 'front',
            preg_match('/RWD|Rear.Wheel/i', $drive) === 1 => 'rear',
            preg_match('/AWD|4WD|4x4|All.Wheel/i', $drive) === 1 => 'awd',
            default => null,
        },
        'fuel_type' => $engine === 'diesel' ? 'Дизель' : null,
        'specs' => [
            'brand' => mb_substr($brand, 0, 28), 'model' => mb_substr($model, 0, 28),
            'trim' => mb_substr(trim($data['Trim'] ?? ''), 0, 22), 'engine' => $engine,
            'displacement' => $number('DisplacementL', 0.1, 20) === null ? null : round((float) $data['DisplacementL'], 2),
            'power' => $kw !== null ? round($kw * 1.35962) : ($hp === null ? null : round($hp * 1.01387)),
            'transmission' => match (true) {
                str_contains($transmission, 'cvt') => 'cvt',
                str_contains($transmission, 'dual clutch') => 'robot',
                str_contains($transmission, 'automatic') => 'auto',
                str_contains($transmission, 'manual') => 'manual',
                default => null,
            },
        ],
    ];
}
function shops(): array
{
    return array_values(array_filter(settings()['shops'] ?? [], static function ($shop): bool {
        if (!is_array($shop) || !is_string($shop['name'] ?? null) || !is_string($shop['url'] ?? null)) {
            return false;
        }
        $template = $shop['url'];
        $parsed = parse_url(str_replace('{article}', '123', $template));
        return str_contains($template, '{article}') && (($parsed['scheme'] ?? '') === 'https')
            && !empty($parsed['host']) && empty($parsed['user']) && empty($parsed['pass'])
            && !str_contains((string) parse_url($template, PHP_URL_HOST), '{article}');
    }));
}
function plansFor(array $car): array
{
    $plans = rows('SELECT id, code, name, interval_km, interval_months, planned_date FROM plans WHERE car_id = ? ORDER BY id', [$car['id']]);
    return array_values(array_filter($plans, static fn($plan) => $plan['code'] !== 'haldex' || $car['haldex']));
}
function partsFor(array $car): array
{
    return rows('SELECT id, name, article, maker, price FROM parts WHERE car_id = ? ORDER BY id DESC', [$car['id']]);
}
function savePlan(array $car, array $body): int
{
    $name = textField($body['name'] ?? null, 'Работа', 80, true);
    $km = numberField($body['interval_km'] ?? null, 'Интервал, км', 1, 500000, 0, false);
    $months = numberField($body['interval_months'] ?? null, 'Интервал, мес.', 1, 120, 0, false);
    $planned = empty($body['planned_date']) ? null : dateField($body['planned_date'], 'Дата записи в сервис');
    if ($km === null && $months === null && $planned === null) {
        fail(422, 'Укажите интервал или запланированную дату.');
    }
    if (!empty($body['id'])) {
        $id = positiveId($body['id']);
        if (!row('SELECT id FROM plans WHERE id = ? AND car_id = ?', [$id, $car['id']])) {
            fail(404, 'Работа не найдена.');
        }
        query('UPDATE plans SET name = ?, interval_km = ?, interval_months = ?, planned_date = ? WHERE id = ? AND car_id = ?',
            [$name, $km, $months, $planned, $id, $car['id']]);
        return $id;
    }
    query('INSERT INTO plans (car_id, name, interval_km, interval_months, planned_date) VALUES (?, ?, ?, ?, ?)',
        [$car['id'], $name, $km, $months, $planned]);
    return (int) db()->lastInsertId();
}
function savePart(array $car, array $body): int
{
    $fields = [
        textField($body['name'] ?? null, 'Название', 100, true),
        textField($body['article'] ?? null, 'Артикул', 80, true),
        textField($body['maker'] ?? null, 'Производитель', 80),
        numberField($body['price'] ?? null, 'Цена', 0, 9999999999.99, 2, false),
    ];
    if (!empty($body['id'])) {
        $id = positiveId($body['id']);
        if (!row('SELECT id FROM parts WHERE id = ? AND car_id = ?', [$id, $car['id']])) {
            fail(404, 'Запчасть не найдена.');
        }
        query('UPDATE parts SET name = ?, article = ?, maker = ?, price = ? WHERE id = ? AND car_id = ?',
            [...$fields, $id, $car['id']]);
        return $id;
    }
    query('INSERT INTO parts (car_id, name, article, maker, price) VALUES (?, ?, ?, ?, ?)', [$car['id'], ...$fields]);
    return (int) db()->lastInsertId();
}
