<?php
require_once __DIR__ . '/../../threat_detection.php';
api(['GET']);
requireRole(['admin', 'conservation_officer']);
respond(200, ['configuration' => threatConfiguration()]);
