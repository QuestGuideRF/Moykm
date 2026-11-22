<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/assets.php';
header('Cache-Control: no-cache');
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-eval' https://yandex.ru https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net; style-src 'unsafe-inline' blob: https://yastatic.net https://*.yastatic.net; connect-src https://yandex.ru https://*.yandex.ru https://*.yandex.net https://*.yandex.com https://yastatic.net https://*.yastatic.net; img-src data: blob: https://yandex.ru https://*.yandex.ru https://*.yandex.net https://*.yandex.com https://yastatic.net https://*.yastatic.net; font-src data: https://yastatic.net https://*.yastatic.net; frame-src https://api-maps.yandex.ru https://enterprise.api-maps.yandex.ru; base-uri 'none'; form-action 'none'">
  <title>Яндекс Карты в Moykm</title>
  <style>html,body,#map { width: 100%; height: 100%; margin: 0; }</style>
  <script src="<?= assetUrl('map-frame.js') ?>" defer></script>
</head>
<body><div id="map"></div></body>
</html>
