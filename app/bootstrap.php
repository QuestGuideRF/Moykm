<?php
declare(strict_types=1);
date_default_timezone_set('Europe/Moscow');
const COOKIE_NAME = 'moykm_session';
const REQUEST_LIMIT = 8 * 1024 * 1024;
const FUEL_TYPES = ['АИ-92', 'АИ-95', 'АИ-98', 'АИ-100', 'Дизель', 'Газ', 'Другое'];
const OTHER_CATEGORIES = ['Страховка', 'Парковка', 'Мойка', 'Платная дорога', 'Штраф', 'Налог', 'Аксессуары', 'Другое'];
const THEMES = ['light', 'dark', 'system'];
const ACCENTS = ['orange', 'teal', 'blue', 'violet', 'rose', 'amber', 'emerald'];
final class ApiException extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}
function fail(int $status, string $message): never
{
    throw new ApiException($status, $message);
}
function settings(): array
{
    static $settings;
    if ($settings === null) {
        $file = getenv('MOYKM_CONFIG') ?: (dirname(__DIR__) . '/config.php');
        $settings = is_file($file) ? require $file : [];
    }
    return $settings;
}
function envValue(string $name, ?string $default = null): ?string
{
    $value = getenv($name);
    if ($value !== false) {
        return $value;
    }
    static $dotenv;
    if ($dotenv === null) {
        $path = dirname(__DIR__) . '/.env';
        $dotenv = is_file($path) ? parse_ini_file($path, false, INI_SCANNER_RAW) : [];
        if ($dotenv === false) {
            fail(503, 'Проверьте формат файла .env.');
        }
    }
    return $dotenv[$name] ?? $default;
}
function db(): PDO
{
    static $db;
    if ($db === null) {
        $config = settings();
        $name = envValue('MOYKM_DB_NAME');
        $dsn = envValue('MOYKM_DSN');
        if (!$dsn && $name) {
            $host = envValue('MOYKM_DB_HOST', 'localhost');
            $port = envValue('MOYKM_DB_PORT', '3306');
            $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
        }
        $dsn = $dsn ?: ($config['dsn'] ?? '');
        if (!$dsn) {
            fail(503, 'Подключение к базе данных ещё не настроено.');
        }
        $db = new PDO(
            $dsn,
            envValue('MOYKM_DB_USER', $config['db_user'] ?? 'moykm'),
            envValue('MOYKM_DB_PASSWORD', $config['db_password'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
        );
        $db->exec("SET time_zone = '+00:00'");
    }
    return $db;
}
function query(string $sql, array $params = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement;
}
function rows(string $sql, array $params = []): array
{
    return query($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
}
function row(string $sql, array $params = []): ?array
{
    return query($sql, $params)->fetch(PDO::FETCH_ASSOC) ?: null;
}
function transaction(callable $operation): mixed
{
    db()->beginTransaction();
    try {
        $result = $operation();
        db()->commit();
        return $result;
    } catch (Throwable $error) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $error;
    }
}
function response(mixed $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    exit;
}
function body(): array
{
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > REQUEST_LIMIT) {
        fail(413, 'Размер запроса превышает 8 МБ.');
    }
    $raw = file_get_contents('php://input', false, null, 0, REQUEST_LIMIT + 1);
    if ($raw === false || strlen($raw) > REQUEST_LIMIT) {
        fail(413, 'Размер запроса превышает 8 МБ.');
    }
    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fail(400, 'Не удалось прочитать данные запроса.');
    }
    if (!is_array($data)) {
        fail(400, 'Не удалось прочитать данные запроса.');
    }
    return $data;
}
function textField(mixed $value, string $label, int $max, bool $required = false): string
{
    if ($value === null && !$required) {
        return '';
    }
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        fail(422, "Проверьте поле «{$label}».");
    }
    $value = trim($value);
    if (($required && $value === '') || mb_strlen($value) > $max) {
        fail(422, "Проверьте поле «{$label}» (до $max символов).");
    }
    return $value;
}
function numberField(mixed $value, string $label, float $min, float $max, int $decimals = 2, bool $required = true): ?float
{
    if (!$required && ($value === null || $value === '')) {
        return null;
    }
    if (is_string($value)) {
        $value = str_replace(',', '.', trim($value));
    }
    if (!is_numeric($value) || !is_finite((float) $value) || $value < $min || $value > $max) {
        fail(422, "Проверьте поле «{$label}». Допустимо от $min до $max.");
    }
    return round((float) $value, $decimals);
}
function positiveId(mixed $value): int
{
    if ((!is_string($value) && !is_int($value)) || !preg_match('/^[1-9][0-9]{0,9}$/D', (string) $value) || $value > 4294967295) {
        fail(422, 'Некорректный идентификатор.');
    }
    return (int) $value;
}
function choice(mixed $value, array $options, string $label): string
{
    if (!in_array($value, $options, true)) {
        fail(422, "Проверьте поле «{$label}».");
    }
    return $value;
}
function dateField(mixed $value, string $label, bool $withTime = false): string
{
    $format = $withTime ? 'Y-m-d\TH:i' : 'Y-m-d';
    $date = is_string($value) && !str_contains($value, "\0")
        ? DateTimeImmutable::createFromFormat('!' . $format, $value) : false;
    if (!$date || $date->format($format) !== $value || $date->format('Y') < '1900' || $date->format('Y') > '2199') {
        fail(422, "Проверьте поле «{$label}».");
    }
    return $date->format($withTime ? 'Y-m-d H:i:s' : 'Y-m-d');
}
