<?php

return [
    'db' => [
        'host' => 'localhost',
        'port' => '3306',
        'name' => 'lead_management',
        'user' => 'root',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'name' => 'Dashneem',
        'jwt_secret' => 'change-this-to-a-long-random-secret',
        'jwt_expire_seconds' => 7 * 24 * 60 * 60,
        'timezone' => 'Asia/Kolkata',
        'google_sheet_tab' => 'Sheet1',
        'uploads_public_path' => '/uploads/voice/',
        'uploads_disk_path' => __DIR__ . '/uploads/voice/',
    ],
];
