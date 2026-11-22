<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/assets.php';
$nonce = base64_encode(random_bytes(18));
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-$nonce'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
header('Cache-Control: no-cache');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="ru" data-theme="system" data-accent="orange">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="Moykm — личный бортжурнал автомобиля">
  <meta name="theme-color" content="#f6f5f3">
  <title>Moykm — личный бортжурнал</title>
  <link rel="icon" type="image/svg+xml" href="assets/moykm-icon.svg">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="stylesheet" href="<?= assetUrl('app.css') ?>">
  <script type="importmap" nonce="<?= $nonce ?>"><?= importMap() ?></script>
  <script type="module" src="<?= assetUrl('app.js') ?>"></script>
</head>
<body>
  <div id="app"><div class="loading" role="status"><img src="assets/moykm-icon.svg" alt="" width="42" height="42"><p>Открываем Moykm…</p></div></div>
  <dialog id="garage-dialog" class="garage-dialog" aria-labelledby="garage-title"></dialog>
  <dialog id="panel-dialog" class="panel-dialog" aria-labelledby="panel-title"></dialog>
  <dialog id="confirm-dialog" class="confirm-dialog" aria-labelledby="confirm-title"></dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <noscript><p>Для работы бортжурнала включите JavaScript.</p></noscript>
</body>
</html>
