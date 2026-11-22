<?php
declare(strict_types=1);
function assetUrl(string $name): string
{
    $path = dirname(__DIR__) . '/public/assets/' . $name;
    return './assets/' . $name . '?v=' . substr(hash_file('sha256', $path), 0, 16);
}
function importMap(): string
{
    $modules = [];
    foreach (glob(dirname(__DIR__) . '/public/assets/*.js') as $path) {
        $name = basename($path);
        $modules['./assets/' . $name] = assetUrl($name);
    }
    return json_encode(['imports' => $modules], JSON_HEX_TAG | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}
