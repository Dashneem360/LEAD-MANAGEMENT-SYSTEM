<?php

$config = require dirname(__DIR__) . '/config.php';

date_default_timezone_set($config['app']['timezone'] ?? 'UTC');

if (!is_dir($config['app']['uploads_disk_path'])) {
    mkdir($config['app']['uploads_disk_path'], 0775, true);
}

function app_config()
{
    global $config;
    return $config;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = app_config()['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $db['host'],
        $db['port'],
        $db['name'],
        $db['charset']
    );

    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function send_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function error_json(string $message, int $status = 400, array $extra = []): void
{
    send_json(array_merge(['success' => false, 'message' => $message], $extra), $status);
}

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function request_path(): string
{
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (!$uri) {
        return '/';
    }

    if (strpos($uri, '/api') === 0) {
        $uri = substr($uri, 4);
    }

    return $uri === '' ? '/' : $uri;
}

function request_body(): array
{
    static $body = null;

    if (is_array($body)) {
        return $body;
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
    $body = [];

    if (stripos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw, true);
        $body = is_array($decoded) ? $decoded : [];
    } elseif (!empty($_POST)) {
        $body = $_POST;
    }

    return $body;
}

function query_param(string $key, $default = null)
{
    return isset($_GET[$key]) && $_GET[$key] !== '' ? $_GET[$key] : $default;
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if (preg_match('/Bearer\s+(.+)/i', $header, $matches)) {
        return trim($matches[1]);
    }

    return null;
}

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwt_encode(array $payload): string
{
    $app = app_config()['app'];
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $now = time();

    $payload = array_merge([
        'iat' => $now,
        'exp' => $now + (int) $app['jwt_expire_seconds'],
    ], $payload);

    $segments = [
        base64url_encode(json_encode($header)),
        base64url_encode(json_encode($payload)),
    ];

    $signature = hash_hmac('sha256', implode('.', $segments), $app['jwt_secret'], true);
    $segments[] = base64url_encode($signature);

    return implode('.', $segments);
}

function jwt_decode_token(string $token): array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new RuntimeException('Malformed token');
    }

    [$header64, $payload64, $signature64] = $parts;
    $signature = base64url_decode($signature64);
    $expected = hash_hmac('sha256', $header64 . '.' . $payload64, app_config()['app']['jwt_secret'], true);

    if (!hash_equals($expected, $signature)) {
        throw new RuntimeException('Invalid token signature');
    }

    $payload = json_decode(base64url_decode($payload64), true);
    if (!is_array($payload)) {
        throw new RuntimeException('Invalid token payload');
    }

    if (isset($payload['exp']) && (int) $payload['exp'] < time()) {
        throw new RuntimeException('Token expired');
    }

    return $payload;
}

function fetch_user_by_id(int $id): ?array
{
    $stmt = db()->prepare(
        'SELECT u.*, ue.total AS earnings_total, ue.this_month AS earnings_this_month, ue.this_week AS earnings_this_week,
                us.total_leads AS stats_total_leads, us.converted_leads AS stats_converted_leads,
                us.total_followups AS stats_total_followups, us.completed_followups AS stats_completed_followups,
                us.missed_followups AS stats_missed_followups
         FROM users u
         LEFT JOIN user_earnings ue ON ue.user_id = u.id
         LEFT JOIN user_stats us ON us.user_id = u.id
         WHERE u.id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function current_user(): array
{
    static $user = null;

    if (is_array($user)) {
        return $user;
    }

    $token = bearer_token();
    if (!$token) {
        error_json('Not authorized, no token', 401);
    }

    try {
        $payload = jwt_decode_token($token);
    } catch (RuntimeException $e) {
        error_json('Token invalid or expired', 401);
    }

    $user = fetch_user_by_id((int) ($payload['id'] ?? 0));
    if (!$user || !(int) $user['is_active']) {
        error_json('User not found', 401);
    }

    return $user;
}

function require_role(array $roles): array
{
    $user = current_user();
    if (!in_array($user['role'], $roles, true)) {
        error_json(count($roles) === 1 ? ucfirst($roles[0]) . ' access required' : 'Manager or Admin access required', 403);
    }
    return $user;
}

function paginate(int $defaultLimit = 20, int $maxLimit = 500): array
{
    $page = max(1, (int) query_param('page', 1));
    $limit = max(1, min($maxLimit, (int) query_param('limit', $defaultLimit)));
    $offset = ($page - 1) * $limit;

    return [$page, $limit, $offset];
}

function to_bool($value): bool
{
    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function now_sql(): string
{
    return date('Y-m-d H:i:s');
}

function start_of_day(?string $date = null): string
{
    $ts = $date ? strtotime($date) : time();
    return date('Y-m-d 00:00:00', $ts);
}

function end_of_day(?string $date = null): string
{
    $ts = $date ? strtotime($date) : time();
    return date('Y-m-d 23:59:59', $ts);
}

function mysql_datetime(?string $value): ?string
{
    if (!$value) {
        return null;
    }

    $ts = strtotime($value);
    return $ts ? date('Y-m-d H:i:s', $ts) : null;
}

function public_user(array $row): array
{
    return [
        '_id' => (string) $row['id'],
        'id' => (string) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'role' => $row['role'],
        'avatar' => $row['avatar'] ?? '',
        'isActive' => (bool) $row['is_active'],
        'lastLogin' => $row['last_login_at'],
        'earnings' => [
            'total' => (float) ($row['earnings_total'] ?? 0),
            'thisMonth' => (float) ($row['earnings_this_month'] ?? 0),
            'thisWeek' => (float) ($row['earnings_this_week'] ?? 0),
        ],
        'stats' => [
            'totalLeads' => (int) ($row['stats_total_leads'] ?? 0),
            'convertedLeads' => (int) ($row['stats_converted_leads'] ?? 0),
            'totalFollowups' => (int) ($row['stats_total_followups'] ?? 0),
            'completedFollowups' => (int) ($row['stats_completed_followups'] ?? 0),
            'missedFollowups' => (int) ($row['stats_missed_followups'] ?? 0),
        ],
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function min_user(?array $row): ?array
{
    if (!$row || empty($row['id'])) {
        return null;
    }

    return [
        '_id' => (string) $row['id'],
        'id' => (string) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'] ?? null,
        'phone' => $row['phone'] ?? null,
        'avatar' => $row['avatar'] ?? '',
        'role' => $row['role'] ?? null,
    ];
}

function bind_in_clause(array &$params, array $values, string $prefix): string
{
    $placeholders = [];
    foreach (array_values($values) as $index => $value) {
        $key = $prefix . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $value;
    }
    return implode(', ', $placeholders);
}

function fetch_lead_rows(array $ids): array
{
    if (!$ids) {
        return [];
    }

    $params = [];
    $in = bind_in_clause($params, $ids, 'lead_id_');

    $sql = 'SELECT l.*,
                   atu.id AS assigned_to_id, atu.name AS assigned_to_name, atu.email AS assigned_to_email, atu.phone AS assigned_to_phone, atu.avatar AS assigned_to_avatar, atu.role AS assigned_to_role,
                   abu.id AS assigned_by_id, abu.name AS assigned_by_name, abu.email AS assigned_by_email, abu.phone AS assigned_by_phone, abu.avatar AS assigned_by_avatar, abu.role AS assigned_by_role
            FROM leads l
            LEFT JOIN users atu ON atu.id = l.assigned_to_user_id
            LEFT JOIN users abu ON abu.id = l.assigned_by_user_id
            WHERE l.id IN (' . $in . ')';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        return [];
    }

    $remarkStmt = db()->prepare(
        'SELECT lr.*, u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
         FROM lead_remarks lr
         LEFT JOIN users u ON u.id = lr.added_by_user_id
         WHERE lr.lead_id IN (' . $in . ')
         ORDER BY lr.added_at ASC'
    );
    $remarkStmt->execute($params);
    $remarks = $remarkStmt->fetchAll();

    $tagStmt = db()->prepare(
        'SELECT lead_id, tag
         FROM lead_tags
         WHERE lead_id IN (' . $in . ')
         ORDER BY tag ASC'
    );
    $tagStmt->execute($params);
    $tags = $tagStmt->fetchAll();

    $remarksByLead = [];
    foreach ($remarks as $remark) {
        $remarksByLead[$remark['lead_id']][] = [
            '_id' => (string) $remark['id'],
            'text' => $remark['text'],
            'addedAt' => $remark['added_at'],
            'addedBy' => $remark['user_id'] ? [
                '_id' => (string) $remark['user_id'],
                'name' => $remark['user_name'],
                'avatar' => $remark['user_avatar'] ?? '',
            ] : null,
        ];
    }

    $tagsByLead = [];
    foreach ($tags as $tag) {
        $tagsByLead[$tag['lead_id']][] = $tag['tag'];
    }

    $result = [];
    foreach ($rows as $row) {
        $result[$row['id']] = serialize_lead($row, $remarksByLead[$row['id']] ?? [], $tagsByLead[$row['id']] ?? []);
    }

    return $result;
}

function serialize_lead(array $row, array $remarks = [], array $tags = []): array
{
    return [
        '_id' => (string) $row['id'],
        'name' => $row['name'],
        'phone' => $row['phone'],
        'alternatePhone' => $row['alternate_phone'],
        'email' => $row['email'],
        'city' => $row['city'],
        'state' => $row['state'],
        'source' => $row['source'],
        'status' => $row['status'],
        'priority' => $row['priority'],
        'assignedTo' => !empty($row['assigned_to_id']) ? [
            '_id' => (string) $row['assigned_to_id'],
            'name' => $row['assigned_to_name'],
            'email' => $row['assigned_to_email'],
            'phone' => $row['assigned_to_phone'],
            'avatar' => $row['assigned_to_avatar'] ?? '',
            'role' => $row['assigned_to_role'] ?? null,
        ] : null,
        'assignedBy' => !empty($row['assigned_by_id']) ? [
            '_id' => (string) $row['assigned_by_id'],
            'name' => $row['assigned_by_name'],
            'email' => $row['assigned_by_email'],
            'phone' => $row['assigned_by_phone'],
            'avatar' => $row['assigned_by_avatar'] ?? '',
            'role' => $row['assigned_by_role'] ?? null,
        ] : null,
        'assignedAt' => $row['assigned_at'],
        'webinarStatus' => $row['webinar_status'],
        'webinarSeenAt' => $row['webinar_seen_at'],
        'webinarLink' => $row['webinar_link'],
        'callCount' => (int) $row['call_count'],
        'lastCalledAt' => $row['last_called_at'],
        'callDuration' => (int) $row['call_duration'],
        'nextFollowupDate' => $row['next_followup_date'],
        'lastFollowupDate' => $row['last_followup_date'],
        'followupCount' => (int) $row['followup_count'],
        'remarks' => $remarks,
        'latestRemark' => $row['latest_remark'],
        'dealValue' => (float) $row['deal_value'],
        'commission' => (float) $row['commission'],
        'sheetRowIndex' => $row['sheet_row_index'] !== null ? (int) $row['sheet_row_index'] : null,
        'sheetId' => $row['sheet_id'],
        'lastSyncedAt' => $row['last_synced_at'],
        'product' => $row['product'],
        'notes' => $row['notes'],
        'tags' => $tags,
        'isActive' => (bool) $row['is_active'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function fetch_followups(array $whereParts, array $params, string $order = 'f.scheduled_date ASC', ?int $limit = null, ?int $offset = null): array
{
    $sql = 'SELECT f.*,
                   l.id AS lead_id, l.name AS lead_name, l.phone AS lead_phone, l.email AS lead_email, l.status AS lead_status, l.priority AS lead_priority, l.webinar_status AS lead_webinar_status,
                   atu.id AS assigned_to_id, atu.name AS assigned_to_name, atu.avatar AS assigned_to_avatar,
                   abu.id AS assigned_by_id, abu.name AS assigned_by_name, abu.avatar AS assigned_by_avatar
            FROM followups f
            INNER JOIN leads l ON l.id = f.lead_id
            LEFT JOIN users atu ON atu.id = f.assigned_to_user_id
            LEFT JOIN users abu ON abu.id = f.assigned_by_user_id';

    if ($whereParts) {
        $sql .= ' WHERE ' . implode(' AND ', $whereParts);
    }

    $sql .= ' ORDER BY ' . $order;

    if ($limit !== null) {
        $sql .= ' LIMIT ' . (int) $limit;
    }
    if ($offset !== null) {
        $sql .= ' OFFSET ' . (int) $offset;
    }

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    return array_map('serialize_followup', $rows);
}

function serialize_followup(array $row): array
{
    return [
        '_id' => (string) $row['id'],
        'lead' => [
            '_id' => (string) $row['lead_id'],
            'name' => $row['lead_name'],
            'phone' => $row['lead_phone'],
            'email' => $row['lead_email'],
            'status' => $row['lead_status'],
            'priority' => $row['lead_priority'],
            'webinarStatus' => $row['lead_webinar_status'],
        ],
        'assignedTo' => $row['assigned_to_id'] ? [
            '_id' => (string) $row['assigned_to_id'],
            'name' => $row['assigned_to_name'],
            'avatar' => $row['assigned_to_avatar'] ?? '',
        ] : null,
        'assignedBy' => $row['assigned_by_id'] ? [
            '_id' => (string) $row['assigned_by_id'],
            'name' => $row['assigned_by_name'],
            'avatar' => $row['assigned_by_avatar'] ?? '',
        ] : null,
        'scheduledDate' => $row['scheduled_date'],
        'scheduledTime' => $row['scheduled_time'],
        'status' => $row['status'],
        'type' => $row['type'],
        'meetingLink' => $row['meeting_link'],
        'outcome' => $row['outcome'],
        'remark' => $row['remark'],
        'duration' => (int) $row['duration'],
        'completedAt' => $row['completed_at'],
        'rescheduledTo' => $row['rescheduled_to'],
        'rescheduledReason' => $row['rescheduled_reason'],
        'priority' => $row['priority'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function create_notification(array $data): void
{
    $stmt = db()->prepare(
        'INSERT INTO notifications (user_id, type, title, message, related_lead_id, related_followup_id, is_read, created_at, updated_at)
         VALUES (:user_id, :type, :title, :message, :related_lead_id, :related_followup_id, 0, NOW(), NOW())'
    );
    $stmt->execute([
        'user_id' => $data['user_id'],
        'type' => $data['type'],
        'title' => $data['title'],
        'message' => $data['message'],
        'related_lead_id' => $data['related_lead_id'] ?? null,
        'related_followup_id' => $data['related_followup_id'] ?? null,
    ]);
}

function sync_user_stat(int $userId, string $column, int $amount): void
{
    $allowed = ['total_leads', 'converted_leads', 'total_followups', 'completed_followups', 'missed_followups'];
    if (!in_array($column, $allowed, true)) {
        return;
    }

    db()->exec(
        sprintf(
            'INSERT INTO user_stats (user_id, %1$s) VALUES (%2$d, %3$d)
             ON DUPLICATE KEY UPDATE %1$s = %1$s + VALUES(%1$s)',
            $column,
            $userId,
            $amount
        )
    );
}

function read_csv_from_sheet(string $sheetId): array
{
    $tab = rawurlencode(app_config()['app']['google_sheet_tab'] ?? 'Sheet1');
    $url = sprintf('https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&sheet=%s', rawurlencode($sheetId), $tab);

    $content = @file_get_contents($url);
    if ($content === false) {
        throw new RuntimeException('Unable to fetch Google Sheet. Make sure the sheet is publicly viewable or use CSV import.');
    }

    $handle = fopen('php://temp', 'r+');
    fwrite($handle, $content);
    rewind($handle);

    $rows = [];
    while (($row = fgetcsv($handle)) !== false) {
        $rows[] = $row;
    }
    fclose($handle);

    return $rows;
}

function map_row_to_lead(array $headers, array $row): array
{
    $mapped = [];
    foreach ($headers as $index => $header) {
        $key = strtolower(trim(str_replace([' ', '-'], '_', $header)));
        $mapped[$key] = trim((string) ($row[$index] ?? ''));
    }

    return [
        'name' => $mapped['name'] ?? $mapped['full_name'] ?? '',
        'phone' => $mapped['phone'] ?? $mapped['mobile'] ?? $mapped['phone_number'] ?? '',
        'alternatePhone' => $mapped['alternate_phone'] ?? $mapped['alt_phone'] ?? '',
        'email' => $mapped['email'] ?? $mapped['email_id'] ?? '',
        'city' => $mapped['city'] ?? '',
        'state' => $mapped['state'] ?? '',
        'product' => $mapped['product'] ?? $mapped['course'] ?? $mapped['service'] ?? '',
        'notes' => $mapped['notes'] ?? $mapped['remarks'] ?? $mapped['comment'] ?? '',
    ];
}

function import_lead_rows(array $headers, array $rows, ?string $sheetId = null): array
{
    $created = 0;
    $updated = 0;
    $skipped = 0;

    $select = db()->prepare('SELECT id FROM leads WHERE phone = :phone LIMIT 1');
    $insert = db()->prepare(
        'INSERT INTO leads
         (name, phone, alternate_phone, email, city, state, source, status, priority, webinar_status, sheet_row_index, sheet_id, last_synced_at, product, notes, is_active, created_at, updated_at)
         VALUES (:name, :phone, :alternate_phone, :email, :city, :state, :source, :status, :priority, :webinar_status, :sheet_row_index, :sheet_id, :last_synced_at, :product, :notes, 1, NOW(), NOW())'
    );
    $update = db()->prepare(
        'UPDATE leads
         SET name = :name, alternate_phone = :alternate_phone, email = :email, city = :city, state = :state,
             product = :product, notes = :notes, source = :source, sheet_row_index = :sheet_row_index,
             sheet_id = :sheet_id, last_synced_at = :last_synced_at, updated_at = NOW()
         WHERE id = :id'
    );

    foreach ($rows as $index => $row) {
        $lead = map_row_to_lead($headers, $row);
        if ($lead['name'] === '' || $lead['phone'] === '') {
            $skipped++;
            continue;
        }

        $select->execute(['phone' => $lead['phone']]);
        $existing = $select->fetch();

        $payload = [
            'name' => $lead['name'],
            'phone' => $lead['phone'],
            'alternate_phone' => $lead['alternatePhone'] ?: null,
            'email' => $lead['email'] ?: null,
            'city' => $lead['city'] ?: null,
            'state' => $lead['state'] ?: null,
            'source' => 'google_sheet',
            'status' => 'new',
            'priority' => 'medium',
            'webinar_status' => 'not_invited',
            'sheet_row_index' => $sheetId ? $index + 2 : null,
            'sheet_id' => $sheetId,
            'last_synced_at' => now_sql(),
            'product' => $lead['product'] ?: null,
            'notes' => $lead['notes'] ?: null,
        ];

        if ($existing) {
            $payload['id'] = $existing['id'];
            $update->execute($payload);
            $updated++;
        } else {
            $insert->execute($payload);
            $created++;
        }
    }

    return compact('created', 'updated', 'skipped');
}
