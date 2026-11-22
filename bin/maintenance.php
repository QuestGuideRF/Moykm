<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}
require dirname(__DIR__) . '/app/bootstrap.php';
$lock = false;
try {
    $lock = (bool) query("SELECT GET_LOCK('moykm:maintenance', 0)")->fetchColumn();
    if (!$lock) {
        exit(0);
    }
    $sessions = query('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()')->rowCount();
    $attempts = query('DELETE FROM auth_attempts WHERE window_start < ?', [time() - 86400])->rowCount();
    printf("[%s] Истёкшие сессии: %d, старые счётчики входа: %d\n", date(DATE_ATOM), $sessions, $attempts);
} catch (Throwable $error) {
    fwrite(STDERR, 'Сбой обслуживания: ' . get_class($error) . PHP_EOL);
    exit(1);
} finally {
    if ($lock) {
        query("SELECT RELEASE_LOCK('moykm:maintenance')");
    }
}
