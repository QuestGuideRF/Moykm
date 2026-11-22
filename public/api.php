<?php
declare(strict_types=1);
ini_set('display_errors', '0');
require dirname(__DIR__) . '/app/bootstrap.php';
require dirname(__DIR__) . '/app/auth.php';
require dirname(__DIR__) . '/app/garage.php';
require dirname(__DIR__) . '/app/ledger.php';
require dirname(__DIR__) . '/app/places.php';
require dirname(__DIR__) . '/app/report.php';
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: frame-ancestors 'none'");
header('Referrer-Policy: same-origin');
try {
    $action = $_GET['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $methods = [
        'bootstrap' => 'GET', 'detail' => 'GET', 'photo' => 'GET', 'route' => 'GET', 'sessions' => 'GET',
        'register' => 'POST', 'login' => 'POST', 'logout' => 'POST', 'revoke' => 'POST', 'preferences' => 'POST',
        'vin' => 'POST', 'save_car' => 'POST', 'select_car' => 'POST', 'save_entry' => 'POST', 'delete_entry' => 'POST',
        'save_plan' => 'POST', 'save_part' => 'POST', 'delete_part' => 'POST',
        'map_config' => 'GET', 'places' => 'GET', 'save_place' => 'POST', 'delete_place' => 'POST',
        'journal' => 'GET', 'entry' => 'GET', 'analytics' => 'GET', 'export' => 'GET',
        'archive_car' => 'POST', 'delete_account' => 'POST',
    ];
    if (!is_string($action) || !isset($methods[$action])) {
        fail(404, 'Запрос не найден.');
    }
    if ($method !== $methods[$action]) {
        header('Allow: ' . $methods[$action]);
        fail(405, 'Метод запроса не поддерживается.');
    }
    $input = [];
    $photo = null;
    if ($method === 'POST') {
        if (($_SERVER['HTTP_X_MOYKM'] ?? '') !== '1'
            || in_array($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '', ['cross-site', 'same-site'], true)) {
            fail(403, 'Обновите страницу и повторите действие.');
        }
        if ($action === 'save_car' && str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data;')) {
            if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > REQUEST_LIMIT) {
                fail(413, 'Размер запроса превышает 8 МБ.');
            }
            try {
                $input = json_decode(is_string($_POST['data'] ?? null) ? $_POST['data'] : '', true, 32, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                fail(422, 'Не удалось прочитать данные машины. Проверьте размер фото.');
            }
            if (!is_array($input)) {
                fail(422, 'Не удалось прочитать данные машины.');
            }
        } else {
            if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
                fail(415, 'Ожидаются данные в формате JSON.');
            }
            $input = body();
        }
    }
    if ($action === 'register' || $action === 'login') {
        authenticate($input, $action === 'register');
        response(['ok' => true]);
    }
    if ($action === 'bootstrap') {
        $account = user(false);
        $cars = $account ? rows(
            'SELECT c.id, c.name, c.plate, c.year, c.archived_at, EXISTS(SELECT 1 FROM car_photos p WHERE p.car_id = c.id) AS has_photo
             FROM cars c WHERE c.user_id = ? ORDER BY c.id',
            [$account['id']]
        ) : [];
        response(['user' => $account, 'cars' => $cars, 'shops' => $account ? shops() : []]);
    }
    if ($action === 'map_config') {
        response([
            'key' => trim(envValue('MOYKM_YANDEX_MAPS_KEY', '')),
            'enterprise' => envValue('MOYKM_YANDEX_MAPS_ENTERPRISE') === '1',
        ]);
    }
    if ($action === 'logout') {
        if ($hash = sessionHash()) {
            query('DELETE FROM sessions WHERE token_hash = ?', [$hash]);
        }
        sessionCookie('', time() - 86400);
        response(['ok' => true]);
    }
    $account = user();
    switch ($action) {
        case 'places':
            response(['places' => savedPlaces($account)]);
        case 'save_place':
            response(['id' => savePlace($account, $input)]);
        case 'delete_place':
            deletePlace($account, $input['id'] ?? null);
            response(['ok' => true]);
        case 'sessions':
            response(['sessions' => sessions($account)]);
        case 'revoke':
            $hash = $input['id'] ?? null;
            if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)) {
                fail(422, 'Некорректная сессия.');
            }
            query('DELETE FROM sessions WHERE token_hash = ? AND user_id = ?', [$hash, $account['id']]);
            $signedOut = $hash === sessionHash();
            if ($signedOut) {
                sessionCookie('', time() - 86400);
            }
            response(['signed_out' => $signedOut]);
        case 'preferences':
            $updates = [];
            if (array_key_exists('theme', $input)) {
                $updates['theme'] = choice($input['theme'], THEMES, 'Тема');
            }
            if (array_key_exists('accent', $input)) {
                $updates['accent'] = choice($input['accent'], ACCENTS, 'Акцент');
            }
            if (array_key_exists('neon', $input)) {
                if (!is_bool($input['neon'])) {
                    fail(422, 'Проверьте режим оформления.');
                }
                $updates['neon'] = (int) $input['neon'];
            }
            if ($updates) {
                $values = implode(', ', array_map(static fn($key) => "$key = ?", array_keys($updates)));
                query("UPDATE users SET $values WHERE id = ?", [...array_values($updates), $account['id']]);
            }
            response(['ok' => true]);
        case 'detail':
            response(transaction(function () use ($account): array {
                $car = carFor($account, $_GET['car_id'] ?? null);
                return carDetail($car, date('Y-m-d H:i:s'));
            }));
        case 'journal':
        case 'entry':
        case 'analytics':
            response(transaction(static function () use ($action, $account): array {
                $car = carFor($account, $_GET['car_id'] ?? null);
                $asOf = date('Y-m-d H:i:s');
                if ($action === 'journal') {
                    return journalPage($car, $_GET, $asOf);
                }
                if ($action === 'entry') {
                    return entryFor($car, positiveId($_GET['id'] ?? null), $asOf);
                }
                $from = ($_GET['from'] ?? '') === '' ? '' : dateField($_GET['from'], 'Дата начала');
                $to = ($_GET['to'] ?? '') === '' ? '' : dateField($_GET['to'], 'Дата окончания');
                if ($from !== '' && $to !== '' && $from > $to) {
                    fail(422, 'Дата начала позже даты окончания.');
                }
                return periodStats($from, $to,
                    static fn(callable $collect): array => ledger($car, historyFor($car, $asOf), [], $asOf, $collect),
                    'storedRouteSummary');
            }));
        case 'archive_car':
            if (!is_bool($input['archived'] ?? null)) {
                fail(422, 'Некорректное действие с архивом.');
            }
            archiveCar($account, $input['car_id'] ?? null, $input['archived']);
            response(['ok' => true]);
        case 'export':
            header('Content-Disposition: attachment; filename="moykm.json"');
            response(transaction(static fn(): array => accountExport($account)));
        case 'delete_account':
            deleteAccount($account, $input['password'] ?? null);
            response(['ok' => true]);
        case 'select_car':
            response(transaction(static function () use ($account, $input): array {
                $car = carFor($account, $input['car_id'] ?? null, true);
                query('UPDATE users SET last_car_id = ? WHERE id = ?', [$car['id'], $account['id']]);
                return ['ok' => true];
            }));
        case 'photo':
            $car = carFor($account, $_GET['car_id'] ?? null);
            $image = row('SELECT mime, content FROM car_photos WHERE car_id = ?', [$car['id']]);
            if (!$image) {
                fail(404, 'Фото не найдено.');
            }
            header('Content-Type: ' . $image['mime']);
            header('Content-Disposition: inline');
            header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox");
            echo $image['content'];
            exit;
        case 'route':
            $car = carFor($account, $_GET['car_id'] ?? null);
            $route = row('SELECT r.points FROM routes r JOIN entries e ON e.id = r.entry_id
                          WHERE e.id = ? AND e.car_id = ?', [positiveId($_GET['id'] ?? null), $car['id']]);
            if (!$route) {
                fail(404, 'Маршрут не найден.');
            }
            response(['points' => json_decode($route['points'], true, 32, JSON_THROW_ON_ERROR)]);
        case 'vin':
            response(lookupVin(vinValue($input['vin'] ?? null, true)));
        case 'save_car':
            if (!empty($input['id'])) {
                carFor($account, $input['id']);
            }
            $photo = photoUpload();
            response(['id' => saveCar($account, $input, $photo)]);
        case 'save_entry':
            response(['id' => saveEntry($account, $input)]);
        case 'save_plan':
        case 'save_part':
        case 'delete_entry':
        case 'delete_part':
            response(transaction(function () use ($account, $input, $action): array {
                $car = carFor($account, $input['car_id'] ?? null, true);
                if ($action === 'save_plan') {
                    return ['id' => savePlan($car, $input)];
                }
                if ($action === 'save_part') {
                    return ['id' => savePart($car, $input)];
                }
                $table = $action === 'delete_entry' ? 'entries' : 'parts';
                $deleted = query("DELETE FROM $table WHERE id = ? AND car_id = ?",
                    [positiveId($input['id'] ?? null), $car['id']])->rowCount();
                if (!$deleted) {
                    fail(404, 'Запись не найдена.');
                }
                return ['ok' => true];
            }));
    }
} catch (ApiException $error) {
    response(['error' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    error_log('Moykm API: ' . get_class($error) . ' in ' . basename($error->getFile()) . ':' . $error->getLine());
    response(['error' => 'Сервер временно недоступен. Попробуйте ещё раз.'], 500);
}
