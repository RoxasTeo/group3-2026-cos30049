<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']);
requireCsrf();
destroyLogin();
respond(200, ['message' => 'Logged out']);
