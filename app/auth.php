<?php
declare(strict_types=1);
function sessionHash(): ?string
{
    $token = $_COOKIE[COOKIE_NAME] ?? '';
    return is_string($token) && preg_match('/^[a-f0-9]{64}$/D', $token) ? hash('sha256', $token) : null;
}
function deleteAccount(array $account, mixed $password): void
{
    transaction(static function () use ($account, $password): void {
        $record = row('SELECT password_hash FROM users WHERE id = ? FOR UPDATE', [$account['id']]);
        if (!is_string($password) || strlen($password) > 1024 || !$record
            || !password_verify($password, $record['password_hash'])) {
            fail(403, 'Неверный пароль.');
        }
        query('DELETE FROM users WHERE id = ?', [$account['id']]);
    });
    sessionCookie('', time() - 86400);
}
function user(bool $required = true): ?array
{
    $hash = sessionHash();
    $user = $hash ? row(
        'SELECT u.id, u.nickname, u.last_car_id, u.theme, u.accent, u.neon
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()',
        [$hash]
    ) : null;
    if ($required && !$user) {
        fail(401, 'Войдите в свой гараж.');
    }
    return $user;
}
function sessionCookie(string $token, int $expires): void
{
    $local = envValue('MOYKM_INSECURE_LOCAL') === '1'
        && in_array($_SERVER['SERVER_NAME'] ?? '', ['127.0.0.1', 'localhost'], true);
    setcookie(COOKIE_NAME, $token, [
        'expires' => $expires,
        'path' => '/',
        'secure' => !$local && (settings()['secure_cookies'] ?? true),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}
function throttle(string $nickname): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $buckets = [hash('sha256', "ip:$ip") => 60, hash('sha256', "login:$ip:$nickname") => 12];
    $allowed = transaction(function () use ($buckets): bool {
        $now = time();
        $cutoff = $now - 900;
        foreach ($buckets as $bucket => $limit) {
            query(
                'INSERT INTO auth_attempts (bucket, window_start, attempts) VALUES (?, ?, 1)
                 ON DUPLICATE KEY UPDATE attempts = IF(window_start <= ?, 1, LEAST(attempts + 1, 10000)),
                 window_start = IF(window_start <= ?, ?, window_start)',
                [$bucket, $now, $cutoff, $cutoff, $now]
            );
            if ((int) row('SELECT attempts FROM auth_attempts WHERE bucket = ?', [$bucket])['attempts'] > $limit) {
                return false;
            }
        }
        return true;
    });
    if (!$allowed) {
        fail(429, 'Слишком много попыток. Попробуйте через 15 минут.');
    }
}
function authenticate(array $data, bool $register): void
{
    $nickname = textField($data['nickname'] ?? null, 'Ник', 24, true);
    if (!preg_match('/^[\p{L}\p{N}_.-]{3,24}$/uD', $nickname)) {
        fail(422, 'Ник должен содержать от 3 до 24 букв, цифр или знаков . _ -');
    }
    $key = mb_strtolower($nickname, 'UTF-8');
    $password = $data['password'] ?? '';
    if (!is_string($password) || strlen($password) > 72 || str_contains($password, "\0")
        || !mb_check_encoding($password, 'UTF-8') || ($register && mb_strlen($password) < 8)) {
        fail(422, 'Используйте от 8 символов. Пароль может занимать до 72 байт.');
    }
    throttle($key);
    $id = null;
    $newHash = $register ? password_hash($password, PASSWORD_DEFAULT) : null;
    if (!$register) {
        $account = row('SELECT id, password_hash FROM users WHERE nickname_key = ?', [$key]);
        $hash = $account['password_hash'] ?? '$2y$12$RYbbIVlyW0ZgoPNmp.6L1ud4SpEdAVfvrJHjFrsq5XD6R2MAUR3OS';
        if (!password_verify($password, $hash) || !$account) {
            fail(401, 'Неверный ник или пароль.');
        }
        $id = (int) $account['id'];
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            query('UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?',
                [password_hash($password, PASSWORD_DEFAULT), $id, $hash]);
        }
    }
    $token = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('+1 year')->getTimestamp();
    $device = mb_substr(mb_scrub($_SERVER['HTTP_USER_AGENT'] ?? '', 'UTF-8'), 0, 180);
    transaction(function () use ($token, $id, $expires, $device, $nickname, $key, $newHash): void {
        if ($newHash !== null) {
            try {
                query('INSERT INTO users (nickname, nickname_key, password_hash) VALUES (?, ?, ?)',
                    [$nickname, $key, $newHash]);
            } catch (PDOException $error) {
                if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                    fail(409, 'Этот ник уже занят.');
                }
                throw $error;
            }
            $id = (int) db()->lastInsertId();
        }
        if ($previous = sessionHash()) {
            query('DELETE FROM sessions WHERE token_hash = ?', [$previous]);
        }
        query('INSERT INTO sessions (token_hash, user_id, device, created_at, expires_at)
               VALUES (?, ?, ?, UTC_TIMESTAMP(), ?)', [hash('sha256', $token), $id, $device, gmdate('Y-m-d H:i:s', $expires)]);
    });
    sessionCookie($token, $expires);
}
function sessions(array $user): array
{
    $current = sessionHash();
    return array_map(static fn(array $session) => [
        'id' => $session['token_hash'],
        'device' => $session['device'],
        'created_at' => $session['created_at'] . 'Z',
        'expires_at' => $session['expires_at'] . 'Z',
        'current' => $session['token_hash'] === $current,
    ], rows('SELECT token_hash, device, created_at, expires_at FROM sessions
             WHERE user_id = ? AND expires_at > UTC_TIMESTAMP() ORDER BY created_at DESC', [$user['id']]));
}
