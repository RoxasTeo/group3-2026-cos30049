<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['GET']);
respond(200, ['user' => requireLogin(), 'csrf_token' => csrfToken()]);
