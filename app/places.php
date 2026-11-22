<?php
declare(strict_types=1);
function savedPlaces(array $account): array
{
    return rows('SELECT id, name, latitude, longitude FROM saved_places WHERE user_id = ? ORDER BY name, id', [$account['id']]);
}
function savePlace(array $account, array $input): int
{
    $values = [
        textField($input['name'] ?? null, 'Название', 80, true),
        numberField($input['latitude'] ?? null, 'Широта', -90, 90, 6),
        numberField($input['longitude'] ?? null, 'Долгота', -180, 180, 6),
    ];
    if (isset($input['id'])) {
        $id = positiveId($input['id']);
        $updated = query('UPDATE saved_places SET name = ?, latitude = ?, longitude = ? WHERE user_id = ? AND id = ?',
            [...$values, $account['id'], $id])->rowCount();
        if (!$updated && !row('SELECT id FROM saved_places WHERE user_id = ? AND id = ?', [$account['id'], $id])) {
            fail(404, 'Место не найдено.');
        }
        return $id;
    }
    query('INSERT INTO saved_places (name, latitude, longitude, user_id) VALUES (?, ?, ?, ?)', [...$values, $account['id']]);
    return (int) db()->lastInsertId();
}
function deletePlace(array $account, mixed $id): void
{
    $deleted = query('DELETE FROM saved_places WHERE user_id = ? AND id = ?', [$account['id'], positiveId($id)])->rowCount();
    if (!$deleted) {
        fail(404, 'Место не найдено.');
    }
}
