<?php

require __DIR__ . '/bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if (request_method() === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = request_method();
$path = request_path();
$segments = array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));

try {
    route_request($method, $segments);
} catch (Throwable $e) {
    error_json($e->getMessage(), 500);
}

function route_request(string $method, array $segments): void
{
    if ($segments === ['health']) {
        send_json(['status' => 'OK', 'message' => 'Lead Management API is running']);
    }

    if (!$segments) {
        error_json('API route not found', 404);
    }

    switch ($segments[0]) {
        case 'auth':
            handle_auth_routes($method, array_slice($segments, 1));
            return;
        case 'users':
            handle_user_routes($method, array_slice($segments, 1));
            return;
        case 'leads':
            handle_lead_routes($method, array_slice($segments, 1));
            return;
        case 'followups':
            handle_followup_routes($method, array_slice($segments, 1));
            return;
        case 'dashboard':
            handle_dashboard_routes($method, array_slice($segments, 1));
            return;
        case 'webinars':
            handle_webinar_routes($method, array_slice($segments, 1));
            return;
        case 'messages':
            handle_message_routes($method, array_slice($segments, 1));
            return;
        case 'meetings':
            handle_meeting_routes($method, array_slice($segments, 1));
            return;
        case 'sheets':
            handle_sheet_routes($method, array_slice($segments, 1));
            return;
        case 'whatsapp':
            handle_whatsapp_routes($method, array_slice($segments, 1));
            return;
        default:
            error_json('API route not found', 404);
    }
}

function handle_auth_routes(string $method, array $segments): void
{
    if ($method === 'POST' && $segments === ['register']) {
        $body = request_body();
        $name = trim((string) ($body['name'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $phone = trim((string) ($body['phone'] ?? ''));
        $role = trim((string) ($body['role'] ?? 'member'));

        if ($name === '' || $email === '' || $password === '') {
            error_json('Name, email and password are required', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_json('Invalid email address', 400);
        }

        if (strlen($password) < 6) {
            error_json('Password must be at least 6 characters', 400);
        }

        $allowedRoles = ['admin', 'manager', 'member'];
        if (!in_array($role, $allowedRoles, true)) {
            $role = 'member';
        }

        $check = db()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $check->execute(['email' => $email]);
        if ($check->fetch()) {
            error_json('Email already registered', 400);
        }

        $stmt = db()->prepare(
            'INSERT INTO users (name, email, password_hash, phone, role, avatar, is_active, created_at, updated_at)
             VALUES (:name, :email, :password_hash, :phone, :role, :avatar, 1, NOW(), NOW())'
        );
        $stmt->execute([
            'name' => $name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'phone' => $phone ?: null,
            'role' => $role,
            'avatar' => '',
        ]);

        $userId = (int) db()->lastInsertId();
        db()->prepare('INSERT INTO user_earnings (user_id, total, this_month, this_week) VALUES (:user_id, 0, 0, 0)')
            ->execute(['user_id' => $userId]);
        db()->prepare('INSERT INTO user_stats (user_id, total_leads, converted_leads, total_followups, completed_followups, missed_followups) VALUES (:user_id, 0, 0, 0, 0, 0)')
            ->execute(['user_id' => $userId]);

        $row = fetch_user_by_id($userId);
        $token = jwt_encode(['id' => $userId]);
        send_json([
            'success' => true,
            'token' => $token,
            'user' => public_user($row),
        ], 201);
    }

    if ($method === 'POST' && $segments === ['login']) {
        $body = request_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' || $password === '') {
            error_json('Please provide email and password', 400);
        }

        $stmt = db()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            error_json('Invalid credentials', 401);
        }

        db()->prepare('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = :id')->execute(['id' => $user['id']]);
        $fullUser = fetch_user_by_id((int) $user['id']);
        $token = jwt_encode(['id' => (int) $user['id']]);

        send_json([
            'success' => true,
            'token' => $token,
            'user' => public_user($fullUser),
        ]);
    }

    if ($method === 'GET' && $segments === ['me']) {
        send_json([
            'success' => true,
            'user' => public_user(current_user()),
        ]);
    }

    if ($method === 'PUT' && $segments === ['update-password']) {
        $user = current_user();
        $body = request_body();
        $currentPassword = (string) ($body['currentPassword'] ?? '');
        $newPassword = (string) ($body['newPassword'] ?? '');

        if ($currentPassword === '' || $newPassword === '') {
            error_json('Current password and new password are required', 400);
        }

        if (!password_verify($currentPassword, $user['password_hash'])) {
            error_json('Current password incorrect', 401);
        }

        db()->prepare('UPDATE users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :id')->execute([
            'password_hash' => password_hash($newPassword, PASSWORD_BCRYPT),
            'id' => $user['id'],
        ]);

        send_json(['success' => true, 'message' => 'Password updated successfully']);
    }

    error_json('Auth route not found', 404);
}

function handle_user_routes(string $method, array $segments): void
{
    $authUser = current_user();

    if ($method === 'GET' && !$segments) {
        $stmt = db()->query(
            'SELECT u.*, ue.total AS earnings_total, ue.this_month AS earnings_this_month, ue.this_week AS earnings_this_week,
                    us.total_leads AS stats_total_leads, us.converted_leads AS stats_converted_leads,
                    us.total_followups AS stats_total_followups, us.completed_followups AS stats_completed_followups,
                    us.missed_followups AS stats_missed_followups
             FROM users u
             LEFT JOIN user_earnings ue ON ue.user_id = u.id
             LEFT JOIN user_stats us ON us.user_id = u.id
             WHERE u.is_active = 1
             ORDER BY u.name ASC'
        );
        $users = array_map('public_user', $stmt->fetchAll());
        send_json(['success' => true, 'users' => $users]);
    }

    if (count($segments) === 1 && ctype_digit($segments[0])) {
        $userId = (int) $segments[0];

        if ($method === 'GET') {
            $row = fetch_user_by_id($userId);
            if (!$row) {
                error_json('User not found', 404);
            }
            send_json(['success' => true, 'user' => public_user($row)]);
        }

        if ($method === 'PUT') {
            if ($authUser['role'] !== 'admin' && (int) $authUser['id'] !== $userId) {
                error_json('Admin access required', 403);
            }

            $body = request_body();
            $stmt = db()->prepare(
                'UPDATE users
                 SET name = :name, phone = :phone, avatar = :avatar, role = :role, updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                'name' => trim((string) ($body['name'] ?? $authUser['name'])),
                'phone' => trim((string) ($body['phone'] ?? '')) ?: null,
                'avatar' => trim((string) ($body['avatar'] ?? '')),
                'role' => $authUser['role'] === 'admin' && !empty($body['role']) ? $body['role'] : fetch_user_by_id($userId)['role'],
                'id' => $userId,
            ]);

            $row = fetch_user_by_id($userId);
            send_json(['success' => true, 'user' => public_user($row)]);
        }

        if ($method === 'DELETE') {
            require_role(['admin']);
            db()->prepare('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = :id')->execute(['id' => $userId]);
            send_json(['success' => true, 'message' => 'User deactivated']);
        }
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'earnings' && $method === 'PUT') {
        require_role(['admin', 'manager']);
        $body = request_body();
        $earnings = $body['earnings'] ?? [];
        $stmt = db()->prepare(
            'INSERT INTO user_earnings (user_id, total, this_month, this_week)
             VALUES (:user_id, :total, :this_month, :this_week)
             ON DUPLICATE KEY UPDATE total = VALUES(total), this_month = VALUES(this_month), this_week = VALUES(this_week)'
        );
        $stmt->execute([
            'user_id' => (int) $segments[0],
            'total' => (float) ($earnings['total'] ?? 0),
            'this_month' => (float) ($earnings['thisMonth'] ?? 0),
            'this_week' => (float) ($earnings['thisWeek'] ?? 0),
        ]);
        $row = fetch_user_by_id((int) $segments[0]);
        send_json(['success' => true, 'user' => public_user($row)]);
    }

    error_json('User route not found', 404);
}

function handle_lead_routes(string $method, array $segments): void
{
    $user = current_user();

    if ($method === 'GET' && !$segments) {
        [$page, $limit, $offset] = paginate();
        $where = ['l.is_active = 1'];
        $params = [];

        if ($user['role'] === 'member') {
            $where[] = 'l.assigned_to_user_id = :assigned_member';
            $params['assigned_member'] = $user['id'];
        } elseif (($assignedTo = query_param('assignedTo')) !== null) {
            $where[] = 'l.assigned_to_user_id = :assigned_to';
            $params['assigned_to'] = (int) $assignedTo;
        }

        foreach (['status', 'source', 'priority', 'webinarStatus'] as $field) {
            $value = query_param($field);
            if ($value !== null) {
                $column = match ($field) {
                    'webinarStatus' => 'l.webinar_status',
                    default => 'l.' . $field,
                };
                $paramKey = str_replace('.', '_', $field);
                $where[] = $column . ' = :' . $paramKey;
                $params[$paramKey] = $value;
            }
        }

        $search = query_param('search');
        if ($search !== null) {
            $where[] = '(l.name LIKE :search OR l.phone LIKE :search OR l.email LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }

        $followupFrom = query_param('followupFrom');
        if ($followupFrom !== null) {
            $where[] = 'l.next_followup_date >= :followup_from';
            $params['followup_from'] = start_of_day($followupFrom);
        }
        $followupTo = query_param('followupTo');
        if ($followupTo !== null) {
            $where[] = 'l.next_followup_date <= :followup_to';
            $params['followup_to'] = end_of_day($followupTo);
        }

        $sortMap = [
            'followup_asc' => 'l.next_followup_date ASC',
            'followup_desc' => 'l.next_followup_date DESC',
            'created_desc' => 'l.created_at DESC',
            'created_asc' => 'l.created_at ASC',
            'name_asc' => 'l.name ASC',
            'deal_desc' => 'l.deal_value DESC',
        ];
        $sortBy = query_param('sortBy', 'created_desc');
        $order = $sortMap[$sortBy] ?? $sortMap['created_desc'];

        $countSql = 'SELECT COUNT(*) FROM leads l WHERE ' . implode(' AND ', $where);
        $countStmt = db()->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = 'SELECT l.*,
                       atu.id AS assigned_to_id, atu.name AS assigned_to_name, atu.email AS assigned_to_email, atu.phone AS assigned_to_phone, atu.avatar AS assigned_to_avatar, atu.role AS assigned_to_role,
                       abu.id AS assigned_by_id, abu.name AS assigned_by_name, abu.email AS assigned_by_email, abu.phone AS assigned_by_phone, abu.avatar AS assigned_by_avatar, abu.role AS assigned_by_role
                FROM leads l
                LEFT JOIN users atu ON atu.id = l.assigned_to_user_id
                LEFT JOIN users abu ON abu.id = l.assigned_by_user_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY ' . $order . '
                LIMIT ' . $limit . ' OFFSET ' . $offset;
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $leads = [];
        foreach ($rows as $row) {
            $leads[] = serialize_lead($row, [], []);
        }

        send_json([
            'success' => true,
            'leads' => $leads,
            'total' => $total,
            'page' => $page,
            'pages' => $limit > 0 ? (int) ceil($total / $limit) : 1,
        ]);
    }

    if ($method === 'GET' && $segments === ['today-calling']) {
        $where = ['l.is_active = 1', 'l.next_followup_date >= :today_start', 'l.next_followup_date <= :today_end'];
        $params = [
            'today_start' => start_of_day(),
            'today_end' => end_of_day(),
        ];
        if ($user['role'] === 'member') {
            $where[] = 'l.assigned_to_user_id = :assigned_to';
            $params['assigned_to'] = $user['id'];
        }

        $sql = 'SELECT l.*,
                       atu.id AS assigned_to_id, atu.name AS assigned_to_name, atu.email AS assigned_to_email, atu.phone AS assigned_to_phone, atu.avatar AS assigned_to_avatar, atu.role AS assigned_to_role,
                       abu.id AS assigned_by_id, abu.name AS assigned_by_name, abu.email AS assigned_by_email, abu.phone AS assigned_by_phone, abu.avatar AS assigned_by_avatar, abu.role AS assigned_by_role
                FROM leads l
                LEFT JOIN users atu ON atu.id = l.assigned_to_user_id
                LEFT JOIN users abu ON abu.id = l.assigned_by_user_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY FIELD(l.priority, "high", "medium", "low"), l.next_followup_date ASC';
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        send_json(['success' => true, 'leads' => array_map(fn($row) => serialize_lead($row, [], []), $rows)]);
    }

    if ($method === 'POST' && !$segments) {
        $body = request_body();
        $stmt = db()->prepare(
            'INSERT INTO leads
             (name, phone, alternate_phone, email, city, state, source, status, priority, assigned_to_user_id, assigned_by_user_id, assigned_at,
              webinar_status, webinar_link, next_followup_date, latest_remark, deal_value, commission, product, notes, is_active, created_at, updated_at)
             VALUES
             (:name, :phone, :alternate_phone, :email, :city, :state, :source, :status, :priority, :assigned_to_user_id, :assigned_by_user_id, :assigned_at,
              :webinar_status, :webinar_link, :next_followup_date, :latest_remark, :deal_value, :commission, :product, :notes, 1, NOW(), NOW())'
        );

        $assignedTo = !empty($body['assignedTo']) ? (int) $body['assignedTo'] : null;
        $stmt->execute([
            'name' => trim((string) ($body['name'] ?? '')),
            'phone' => trim((string) ($body['phone'] ?? '')),
            'alternate_phone' => trim((string) ($body['alternatePhone'] ?? '')) ?: null,
            'email' => trim((string) ($body['email'] ?? '')) ?: null,
            'city' => trim((string) ($body['city'] ?? '')) ?: null,
            'state' => trim((string) ($body['state'] ?? '')) ?: null,
            'source' => trim((string) ($body['source'] ?? 'manual')) ?: 'manual',
            'status' => trim((string) ($body['status'] ?? 'new')) ?: 'new',
            'priority' => trim((string) ($body['priority'] ?? 'medium')) ?: 'medium',
            'assigned_to_user_id' => $assignedTo,
            'assigned_by_user_id' => $user['id'],
            'assigned_at' => $assignedTo ? now_sql() : null,
            'webinar_status' => trim((string) ($body['webinarStatus'] ?? 'not_invited')) ?: 'not_invited',
            'webinar_link' => trim((string) ($body['webinarLink'] ?? '')) ?: null,
            'next_followup_date' => mysql_datetime($body['nextFollowupDate'] ?? null),
            'latest_remark' => trim((string) ($body['latestRemark'] ?? '')) ?: null,
            'deal_value' => (float) ($body['dealValue'] ?? 0),
            'commission' => (float) ($body['commission'] ?? 0),
            'product' => trim((string) ($body['product'] ?? '')) ?: null,
            'notes' => trim((string) ($body['notes'] ?? '')) ?: null,
        ]);

        $leadId = (int) db()->lastInsertId();

        if ($assignedTo) {
            sync_user_stat($assignedTo, 'total_leads', 1);
            create_notification([
                'user_id' => $assignedTo,
                'type' => 'lead_assigned',
                'title' => 'New Lead Assigned',
                'message' => 'Lead "' . trim((string) ($body['name'] ?? '')) . '" has been assigned to you',
                'related_lead_id' => $leadId,
            ]);
        }

        $lead = fetch_lead_rows([$leadId])[$leadId] ?? null;
        send_json(['success' => true, 'lead' => $lead], 201);
    }

    if ($method === 'POST' && $segments === ['bulk-import']) {
        require_role(['admin', 'manager']);
        $body = request_body();
        $rows = $body['leads'] ?? [];
        if (!is_array($rows)) {
            error_json('No leads provided', 400);
        }

        $headers = ['name', 'phone', 'alternate_phone', 'email', 'city', 'state', 'product', 'notes'];
        $normalized = [];
        foreach ($rows as $lead) {
            $normalized[] = [
                $lead['name'] ?? '',
                $lead['phone'] ?? '',
                $lead['alternatePhone'] ?? '',
                $lead['email'] ?? '',
                $lead['city'] ?? '',
                $lead['state'] ?? '',
                $lead['product'] ?? '',
                $lead['notes'] ?? '',
            ];
        }

        $result = import_lead_rows($headers, $normalized);
        send_json([
            'success' => true,
            'message' => sprintf('Import complete: %d created, %d updated, %d skipped', $result['created'], $result['updated'], $result['skipped']),
        ]);
    }

    if (count($segments) === 1 && ctype_digit($segments[0])) {
        $leadId = (int) $segments[0];

        if ($method === 'GET') {
            $lead = fetch_lead_rows([$leadId])[$leadId] ?? null;
            if (!$lead) {
                error_json('Lead not found', 404);
            }
            send_json(['success' => true, 'lead' => $lead]);
        }

        if ($method === 'PUT') {
            $body = request_body();
            $currentStmt = db()->prepare('SELECT * FROM leads WHERE id = :id LIMIT 1');
            $currentStmt->execute(['id' => $leadId]);
            $current = $currentStmt->fetch();
            if (!$current) {
                error_json('Lead not found', 404);
            }

            $newStatus = trim((string) ($body['status'] ?? $current['status']));
            $newAssignedTo = array_key_exists('assignedTo', $body) ? (!empty($body['assignedTo']) ? (int) $body['assignedTo'] : null) : $current['assigned_to_user_id'];
            $newCalledAt = mysql_datetime($body['lastCalledAt'] ?? $current['last_called_at']);
            $newCallCount = $current['call_count'] + (!empty($body['lastCalledAt']) ? 1 : 0);

            $stmt = db()->prepare(
                'UPDATE leads
                 SET name = :name, phone = :phone, alternate_phone = :alternate_phone, email = :email, city = :city, state = :state,
                     source = :source, status = :status, priority = :priority, assigned_to_user_id = :assigned_to_user_id,
                     webinar_status = :webinar_status, webinar_link = :webinar_link, call_count = :call_count,
                     last_called_at = :last_called_at, next_followup_date = :next_followup_date, latest_remark = :latest_remark,
                     deal_value = :deal_value, commission = :commission, product = :product, notes = :notes, updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                'name' => trim((string) ($body['name'] ?? $current['name'])),
                'phone' => trim((string) ($body['phone'] ?? $current['phone'])),
                'alternate_phone' => trim((string) ($body['alternatePhone'] ?? $current['alternate_phone'])) ?: null,
                'email' => trim((string) ($body['email'] ?? $current['email'])) ?: null,
                'city' => trim((string) ($body['city'] ?? $current['city'])) ?: null,
                'state' => trim((string) ($body['state'] ?? $current['state'])) ?: null,
                'source' => trim((string) ($body['source'] ?? $current['source'])) ?: 'manual',
                'status' => $newStatus,
                'priority' => trim((string) ($body['priority'] ?? $current['priority'])) ?: 'medium',
                'assigned_to_user_id' => $newAssignedTo,
                'webinar_status' => trim((string) ($body['webinarStatus'] ?? $current['webinar_status'])) ?: $current['webinar_status'],
                'webinar_link' => trim((string) ($body['webinarLink'] ?? $current['webinar_link'])) ?: null,
                'call_count' => $newCallCount,
                'last_called_at' => $newCalledAt,
                'next_followup_date' => mysql_datetime($body['nextFollowupDate'] ?? $current['next_followup_date']),
                'latest_remark' => trim((string) ($body['latestRemark'] ?? $current['latest_remark'])) ?: null,
                'deal_value' => (float) ($body['dealValue'] ?? $current['deal_value']),
                'commission' => (float) ($body['commission'] ?? $current['commission']),
                'product' => trim((string) ($body['product'] ?? $current['product'])) ?: null,
                'notes' => trim((string) ($body['notes'] ?? $current['notes'])) ?: null,
                'id' => $leadId,
            ]);

            if ($current['status'] !== 'converted' && $newStatus === 'converted' && $newAssignedTo) {
                sync_user_stat((int) $newAssignedTo, 'converted_leads', 1);
            }

            $lead = fetch_lead_rows([$leadId])[$leadId] ?? null;
            send_json(['success' => true, 'lead' => $lead]);
        }

        if ($method === 'DELETE') {
            require_role(['admin', 'manager']);
            db()->prepare('UPDATE leads SET is_active = 0, updated_at = NOW() WHERE id = :id')->execute(['id' => $leadId]);
            send_json(['success' => true, 'message' => 'Lead deleted']);
        }
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'remark' && $method === 'POST') {
        $leadId = (int) $segments[0];
        $body = request_body();
        $text = trim((string) ($body['text'] ?? ''));
        if ($text === '') {
            error_json('Remark text is required', 400);
        }

        db()->prepare('INSERT INTO lead_remarks (lead_id, added_by_user_id, text, added_at) VALUES (:lead_id, :added_by_user_id, :text, NOW())')->execute([
            'lead_id' => $leadId,
            'added_by_user_id' => $user['id'],
            'text' => $text,
        ]);
        db()->prepare('UPDATE leads SET latest_remark = :text, updated_at = NOW() WHERE id = :id')->execute([
            'text' => $text,
            'id' => $leadId,
        ]);

        $lead = fetch_lead_rows([$leadId])[$leadId] ?? null;
        send_json(['success' => true, 'lead' => $lead]);
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'assign' && $method === 'PUT') {
        require_role(['admin', 'manager']);
        $leadId = (int) $segments[0];
        $body = request_body();
        $assignedTo = (int) ($body['assignedTo'] ?? 0);
        if ($assignedTo <= 0) {
            error_json('Assigned user is required', 400);
        }

        db()->prepare(
            'UPDATE leads
             SET assigned_to_user_id = :assigned_to, assigned_by_user_id = :assigned_by, assigned_at = NOW(), updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'assigned_to' => $assignedTo,
            'assigned_by' => $user['id'],
            'id' => $leadId,
        ]);

        sync_user_stat($assignedTo, 'total_leads', 1);
        $lead = fetch_lead_rows([$leadId])[$leadId] ?? null;
        if ($lead) {
            create_notification([
                'user_id' => $assignedTo,
                'type' => 'lead_assigned',
                'title' => 'Lead Assigned',
                'message' => 'Lead "' . $lead['name'] . '" has been assigned to you',
                'related_lead_id' => $leadId,
            ]);
        }

        send_json(['success' => true, 'lead' => $lead]);
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'webinar' && $method === 'PUT') {
        $leadId = (int) $segments[0];
        $body = request_body();
        $status = trim((string) ($body['webinarStatus'] ?? 'not_invited')) ?: 'not_invited';

        db()->prepare(
            'UPDATE leads
             SET webinar_status = :status, webinar_seen_at = :webinar_seen_at, updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'status' => $status,
            'webinar_seen_at' => $status === 'attended' ? now_sql() : null,
            'id' => $leadId,
        ]);

        $lead = fetch_lead_rows([$leadId])[$leadId] ?? null;
        send_json(['success' => true, 'lead' => $lead]);
    }

    error_json('Lead route not found', 404);
}

function handle_followup_routes(string $method, array $segments): void
{
    $user = current_user();

    if ($method === 'GET' && !$segments) {
        [$page, $limit, $offset] = paginate();
        $where = ['1 = 1'];
        $params = [];

        if ($user['role'] === 'member') {
            $where[] = 'f.assigned_to_user_id = :assigned_member';
            $params['assigned_member'] = $user['id'];
        } elseif (($assignedTo = query_param('assignedTo')) !== null) {
            $where[] = 'f.assigned_to_user_id = :assigned_to';
            $params['assigned_to'] = (int) $assignedTo;
        }

        if (($status = query_param('status')) !== null) {
            $where[] = 'f.status = :status';
            $params['status'] = $status;
        }

        if (($date = query_param('date')) !== null) {
            $where[] = 'f.scheduled_date >= :date_start AND f.scheduled_date <= :date_end';
            $params['date_start'] = start_of_day($date);
            $params['date_end'] = end_of_day($date);
        }

        $countStmt = db()->prepare('SELECT COUNT(*) FROM followups f WHERE ' . implode(' AND ', $where));
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $followups = fetch_followups($where, $params, 'f.scheduled_date ASC', $limit, $offset);
        send_json(['success' => true, 'followups' => $followups, 'total' => $total]);
    }

    if ($method === 'GET' && $segments === ['today']) {
        $where = ['f.scheduled_date >= :today_start', 'f.scheduled_date <= :today_end'];
        $params = ['today_start' => start_of_day(), 'today_end' => end_of_day()];
        if ($user['role'] === 'member') {
            $where[] = 'f.assigned_to_user_id = :assigned_to';
            $params['assigned_to'] = $user['id'];
        }

        $followups = fetch_followups($where, $params, 'f.scheduled_date ASC');
        $stats = [
            'total' => count($followups),
            'completed' => count(array_filter($followups, fn($item) => $item['status'] === 'completed')),
            'pending' => count(array_filter($followups, fn($item) => $item['status'] === 'pending')),
            'missed' => count(array_filter($followups, fn($item) => $item['status'] === 'missed')),
        ];
        send_json(['success' => true, 'followups' => $followups, 'stats' => $stats]);
    }

    if ($method === 'GET' && $segments === ['missed']) {
        db()->prepare('UPDATE followups SET status = "missed", updated_at = NOW() WHERE scheduled_date < NOW() AND status = "pending"')->execute();

        $where = ['f.scheduled_date < NOW()', 'f.status = "missed"'];
        $params = [];
        if ($user['role'] === 'member') {
            $where[] = 'f.assigned_to_user_id = :assigned_to';
            $params['assigned_to'] = $user['id'];
        }

        $followups = fetch_followups($where, $params, 'f.scheduled_date DESC', 50);
        send_json(['success' => true, 'followups' => $followups, 'count' => count($followups)]);
    }

    if ($method === 'GET' && $segments === ['stats']) {
        db()->prepare('UPDATE followups SET status = "missed", updated_at = NOW() WHERE scheduled_date < NOW() AND status = "pending"')->execute();

        $assignedClause = $user['role'] === 'member' ? ' AND assigned_to_user_id = :user_id' : '';
        $params = $user['role'] === 'member' ? ['user_id' => $user['id']] : [];

        $todayStmt = db()->prepare(
            'SELECT status, COUNT(*) AS count
             FROM followups
             WHERE scheduled_date >= :today_start AND scheduled_date <= :today_end' . $assignedClause . '
             GROUP BY status'
        );
        $todayParams = array_merge($params, ['today_start' => start_of_day(), 'today_end' => end_of_day()]);
        $todayStmt->execute($todayParams);
        $todayStats = $todayStmt->fetchAll();

        $weekStmt = db()->prepare(
            'SELECT COUNT(*) FROM followups
             WHERE status = "completed" AND scheduled_date >= :week_start' . $assignedClause
        );
        $weekStmt->execute(array_merge($params, ['week_start' => date('Y-m-d 00:00:00', strtotime('monday this week'))]));
        $weekCompleted = (int) $weekStmt->fetchColumn();

        $monthStmt = db()->prepare(
            'SELECT COUNT(*) FROM followups
             WHERE status = "completed" AND scheduled_date >= :month_start' . $assignedClause
        );
        $monthStmt->execute(array_merge($params, ['month_start' => date('Y-m-01 00:00:00')]));
        $monthCompleted = (int) $monthStmt->fetchColumn();

        $missedStmt = db()->prepare(
            'SELECT COUNT(*) FROM followups
             WHERE status = "missed" AND scheduled_date < :today_start' . $assignedClause
        );
        $missedStmt->execute(array_merge($params, ['today_start' => start_of_day()]));
        $totalMissed = (int) $missedStmt->fetchColumn();

        $todayMap = ['total' => 0, 'completed' => 0, 'pending' => 0, 'missed' => 0];
        foreach ($todayStats as $row) {
            $todayMap[$row['status']] = (int) $row['count'];
            $todayMap['total'] += (int) $row['count'];
        }

        send_json([
            'success' => true,
            'today' => $todayMap,
            'weekCompleted' => $weekCompleted,
            'monthCompleted' => $monthCompleted,
            'totalMissed' => $totalMissed,
        ]);
    }

    if ($method === 'POST' && !$segments) {
        $body = request_body();
        $leadId = (int) ($body['lead'] ?? 0);
        $assignedTo = (int) ($body['assignedTo'] ?? 0);
        $scheduledDate = mysql_datetime($body['scheduledDate'] ?? null);
        if ($leadId <= 0 || $assignedTo <= 0 || !$scheduledDate) {
            error_json('Lead, assigned user and scheduled date are required', 400);
        }

        $stmt = db()->prepare(
            'INSERT INTO followups
             (lead_id, assigned_to_user_id, assigned_by_user_id, scheduled_date, scheduled_time, status, type, remark, priority, created_at, updated_at)
             VALUES
             (:lead_id, :assigned_to_user_id, :assigned_by_user_id, :scheduled_date, :scheduled_time, "pending", :type, :remark, :priority, NOW(), NOW())'
        );
        $stmt->execute([
            'lead_id' => $leadId,
            'assigned_to_user_id' => $assignedTo,
            'assigned_by_user_id' => $user['id'],
            'scheduled_date' => $scheduledDate,
            'scheduled_time' => date('H:i', strtotime($scheduledDate)),
            'type' => trim((string) ($body['type'] ?? 'call')) ?: 'call',
            'remark' => trim((string) ($body['remark'] ?? '')) ?: null,
            'priority' => trim((string) ($body['priority'] ?? 'medium')) ?: 'medium',
        ]);
        $followupId = (int) db()->lastInsertId();

        db()->prepare('UPDATE leads SET next_followup_date = :next_followup_date, followup_count = followup_count + 1, updated_at = NOW() WHERE id = :id')->execute([
            'next_followup_date' => $scheduledDate,
            'id' => $leadId,
        ]);
        sync_user_stat($assignedTo, 'total_followups', 1);
        create_notification([
            'user_id' => $assignedTo,
            'type' => 'upcoming_followup',
            'title' => 'New Followup Scheduled',
            'message' => 'Followup scheduled for ' . date('d M Y, h:i A', strtotime($scheduledDate)),
            'related_followup_id' => $followupId,
        ]);

        $followups = fetch_followups(['f.id = :id'], ['id' => $followupId]);
        send_json(['success' => true, 'followup' => $followups[0] ?? null], 201);
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'complete' && $method === 'PUT') {
        $followupId = (int) $segments[0];
        $body = request_body();
        $stmt = db()->prepare('SELECT * FROM followups WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $followupId]);
        $followup = $stmt->fetch();
        if (!$followup) {
            error_json('Followup not found', 404);
        }

        $outcome = trim((string) ($body['outcome'] ?? ''));
        $remark = trim((string) ($body['remark'] ?? ''));
        $duration = (int) ($body['duration'] ?? 0);
        $nextFollowupDate = mysql_datetime($body['nextFollowupDate'] ?? null);
        $nextFollowupType = trim((string) ($body['nextFollowupType'] ?? 'call')) ?: 'call';

        db()->prepare(
            'UPDATE followups
             SET status = "completed", outcome = :outcome, remark = :remark, duration = :duration, completed_at = NOW(), completed_by_user_id = :completed_by_user_id, updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'outcome' => $outcome ?: null,
            'remark' => $remark ?: null,
            'duration' => $duration,
            'completed_by_user_id' => $user['id'],
            'id' => $followupId,
        ]);

        $statusMap = [
            'interested' => 'interested',
            'not_interested' => 'not_interested',
            'nurturing' => 'nurturing',
            'converted' => 'converted',
        ];

        $leadUpdates = ['last_followup_date = NOW()', 'call_count = call_count + 1', 'updated_at = NOW()'];
        $leadParams = ['id' => $followup['lead_id']];
        if (isset($statusMap[$outcome])) {
            $leadUpdates[] = 'status = :status';
            $leadParams['status'] = $statusMap[$outcome];
        }
        if ($remark !== '') {
            $leadUpdates[] = 'latest_remark = :latest_remark';
            $leadParams['latest_remark'] = $remark;
        }
        if ($nextFollowupDate) {
            $leadUpdates[] = 'next_followup_date = :next_followup_date';
            $leadParams['next_followup_date'] = $nextFollowupDate;
        }

        $leadSql = 'UPDATE leads SET ' . implode(', ', $leadUpdates) . ' WHERE id = :id';
        db()->prepare($leadSql)->execute($leadParams);

        if ($remark !== '') {
            db()->prepare('INSERT INTO lead_remarks (lead_id, added_by_user_id, text, added_at) VALUES (:lead_id, :added_by_user_id, :text, NOW())')->execute([
                'lead_id' => $followup['lead_id'],
                'added_by_user_id' => $user['id'],
                'text' => $remark,
            ]);
        }

        sync_user_stat((int) $user['id'], 'completed_followups', 1);
        if ($outcome === 'converted' && !empty($followup['assigned_to_user_id'])) {
            sync_user_stat((int) $followup['assigned_to_user_id'], 'converted_leads', 1);
        }

        if ($nextFollowupDate && !empty($followup['assigned_to_user_id'])) {
            db()->prepare(
                'INSERT INTO followups
                 (lead_id, assigned_to_user_id, assigned_by_user_id, scheduled_date, scheduled_time, status, type, priority, created_at, updated_at)
                 VALUES (:lead_id, :assigned_to_user_id, :assigned_by_user_id, :scheduled_date, :scheduled_time, "pending", :type, :priority, NOW(), NOW())'
            )->execute([
                'lead_id' => $followup['lead_id'],
                'assigned_to_user_id' => $followup['assigned_to_user_id'],
                'assigned_by_user_id' => $user['id'],
                'scheduled_date' => $nextFollowupDate,
                'scheduled_time' => date('H:i', strtotime($nextFollowupDate)),
                'type' => $nextFollowupType,
                'priority' => $followup['priority'],
            ]);
        }

        $followups = fetch_followups(['f.id = :id'], ['id' => $followupId]);
        send_json(['success' => true, 'followup' => $followups[0] ?? null]);
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'reschedule' && $method === 'PUT') {
        $followupId = (int) $segments[0];
        $body = request_body();
        $rescheduledTo = mysql_datetime($body['rescheduledTo'] ?? null);
        if (!$rescheduledTo) {
            error_json('New date is required', 400);
        }

        db()->prepare(
            'UPDATE followups
             SET status = "rescheduled", rescheduled_to = :rescheduled_to, rescheduled_reason = :rescheduled_reason, scheduled_date = :scheduled_date, scheduled_time = :scheduled_time, updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'rescheduled_to' => $rescheduledTo,
            'rescheduled_reason' => trim((string) ($body['rescheduledReason'] ?? '')) ?: null,
            'scheduled_date' => $rescheduledTo,
            'scheduled_time' => date('H:i', strtotime($rescheduledTo)),
            'id' => $followupId,
        ]);

        $leadId = db()->prepare('SELECT lead_id FROM followups WHERE id = :id LIMIT 1');
        $leadId->execute(['id' => $followupId]);
        $leadId = (int) $leadId->fetchColumn();
        if ($leadId) {
            db()->prepare('UPDATE leads SET next_followup_date = :next_followup_date, updated_at = NOW() WHERE id = :id')->execute([
                'next_followup_date' => $rescheduledTo,
                'id' => $leadId,
            ]);
        }

        $followups = fetch_followups(['f.id = :id'], ['id' => $followupId]);
        send_json(['success' => true, 'followup' => $followups[0] ?? null]);
    }

    error_json('Followup route not found', 404);
}

function handle_dashboard_routes(string $method, array $segments): void
{
    $user = current_user();
    $isAdmin = $user['role'] !== 'member';

    if ($method === 'GET' && $segments === ['stats']) {
        $leadFilter = $isAdmin ? '' : ' AND assigned_to_user_id = :user_id';
        $followupFilter = $isAdmin ? '' : ' AND assigned_to_user_id = :user_id';
        $messageFilter = ['user_id' => $user['id']];

        $params = $isAdmin ? [] : ['user_id' => $user['id']];
        $todayStart = start_of_day();
        $todayEnd = end_of_day();
        $monthStart = date('Y-m-01 00:00:00');
        $weekStart = date('Y-m-d 00:00:00', strtotime('monday this week'));

        $stats = [];
        $queries = [
            'totalLeads' => ['SELECT COUNT(*) FROM leads WHERE is_active = 1' . $leadFilter, $params],
            'newLeads' => ['SELECT COUNT(*) FROM leads WHERE is_active = 1 AND status = "new"' . $leadFilter, $params],
            'interestedLeads' => ['SELECT COUNT(*) FROM leads WHERE is_active = 1 AND status = "interested"' . $leadFilter, $params],
            'convertedLeads' => ['SELECT COUNT(*) FROM leads WHERE is_active = 1 AND status = "converted"' . $leadFilter, $params],
            'todayFollowups' => ['SELECT COUNT(*) FROM followups WHERE scheduled_date >= :today_start AND scheduled_date <= :today_end' . $followupFilter, array_merge($params, ['today_start' => $todayStart, 'today_end' => $todayEnd])],
            'pendingFollowups' => ['SELECT COUNT(*) FROM followups WHERE status = "pending" AND scheduled_date >= :today_start AND scheduled_date <= :today_end' . $followupFilter, array_merge($params, ['today_start' => $todayStart, 'today_end' => $todayEnd])],
            'missedFollowups' => ['SELECT COUNT(*) FROM followups WHERE status = "missed"' . $followupFilter, $params],
            'monthLeads' => ['SELECT COUNT(*) FROM leads WHERE is_active = 1 AND created_at >= :month_start' . $leadFilter, array_merge($params, ['month_start' => $monthStart])],
            'weekLeads' => ['SELECT COUNT(*) FROM leads WHERE is_active = 1 AND created_at >= :week_start' . $leadFilter, array_merge($params, ['week_start' => $weekStart])],
            'notSeenWebinar' => ['SELECT COUNT(*) FROM leads WHERE is_active = 1 AND webinar_status IN ("not_invited", "missed", "invited")' . $leadFilter, $params],
            'unreadMessages' => ['SELECT COUNT(*) FROM messages WHERE to_user_id = :user_id AND is_read = 0', ['user_id' => $user['id']]],
        ];

        foreach ($queries as $key => [$sql, $sqlParams]) {
            $stmt = db()->prepare($sql);
            $stmt->execute($sqlParams);
            $stats[$key] = (int) $stmt->fetchColumn();
        }

        $stats['conversionRate'] = $stats['totalLeads'] > 0 ? number_format(($stats['convertedLeads'] / $stats['totalLeads']) * 100, 1, '.', '') : 0;

        send_json(['success' => true, 'stats' => $stats]);
    }

    if ($method === 'GET' && $segments === ['growth-chart']) {
        $period = query_param('period', 'month');
        $userId = query_param('userId');
        $targetUser = $isAdmin && $userId ? (int) $userId : (int) $user['id'];
        $applyLeadFilter = !($isAdmin && !$userId);
        $dateFormat = $period === 'year' ? '%Y-%m' : '%Y-%m-%d';
        $days = $period === 'week' ? 7 : ($period === 'year' ? 365 : 30);
        $startDate = date('Y-m-d 00:00:00', strtotime('-' . $days . ' days'));

        $leadWhere = 'is_active = 1 AND created_at >= :start_date';
        $leadParams = ['start_date' => $startDate];
        if ($applyLeadFilter) {
            $leadWhere .= ' AND assigned_to_user_id = :assigned_to';
            $leadParams['assigned_to'] = $targetUser;
        }

        $stmt = db()->prepare(
            'SELECT DATE_FORMAT(created_at, "' . $dateFormat . '") AS _id, COUNT(*) AS count
             FROM leads
             WHERE ' . $leadWhere . '
             GROUP BY DATE_FORMAT(created_at, "' . $dateFormat . '")
             ORDER BY _id ASC'
        );
        $stmt->execute($leadParams);
        $leadsData = $stmt->fetchAll();

        $followWhere = 'status = "completed" AND completed_at IS NOT NULL AND completed_at >= :start_date';
        $followParams = ['start_date' => $startDate];
        if (!($isAdmin && !$userId)) {
            $followWhere .= ' AND assigned_to_user_id = :assigned_to';
            $followParams['assigned_to'] = $targetUser;
        }
        $stmt = db()->prepare(
            'SELECT DATE_FORMAT(completed_at, "' . $dateFormat . '") AS _id, COUNT(*) AS count
             FROM followups
             WHERE ' . $followWhere . '
             GROUP BY DATE_FORMAT(completed_at, "' . $dateFormat . '")
             ORDER BY _id ASC'
        );
        $stmt->execute($followParams);
        $followupsData = $stmt->fetchAll();

        $convWhere = 'is_active = 1 AND status = "converted" AND updated_at >= :start_date';
        $convParams = ['start_date' => $startDate];
        if ($applyLeadFilter) {
            $convWhere .= ' AND assigned_to_user_id = :assigned_to';
            $convParams['assigned_to'] = $targetUser;
        }
        $stmt = db()->prepare(
            'SELECT DATE_FORMAT(updated_at, "' . $dateFormat . '") AS _id, COUNT(*) AS count
             FROM leads
             WHERE ' . $convWhere . '
             GROUP BY DATE_FORMAT(updated_at, "' . $dateFormat . '")
             ORDER BY _id ASC'
        );
        $stmt->execute($convParams);
        $conversionsData = $stmt->fetchAll();

        send_json(compact('success', 'leadsData', 'followupsData', 'conversionsData') + ['success' => true]);
    }

    if ($method === 'GET' && $segments === ['team-performance']) {
        $membersStmt = db()->query(
            'SELECT u.*, ue.total AS earnings_total, ue.this_month AS earnings_this_month, ue.this_week AS earnings_this_week
             FROM users u
             LEFT JOIN user_earnings ue ON ue.user_id = u.id
             WHERE u.is_active = 1
             ORDER BY u.name ASC'
        );
        $members = $membersStmt->fetchAll();
        $todayStart = start_of_day();
        $todayEnd = end_of_day();

        $performance = [];
        foreach ($members as $member) {
            $memberId = (int) $member['id'];
            $counts = [];
            foreach ([
                'totalLeads' => 'SELECT COUNT(*) FROM leads WHERE assigned_to_user_id = :user_id AND is_active = 1',
                'converted' => 'SELECT COUNT(*) FROM leads WHERE assigned_to_user_id = :user_id AND status = "converted"',
                'followupsToday' => 'SELECT COUNT(*) FROM followups WHERE assigned_to_user_id = :user_id AND scheduled_date >= :today_start AND scheduled_date <= :today_end',
                'completedToday' => 'SELECT COUNT(*) FROM followups WHERE assigned_to_user_id = :user_id AND status = "completed" AND completed_at >= :today_start',
                'missed' => 'SELECT COUNT(*) FROM followups WHERE assigned_to_user_id = :user_id AND status = "missed"',
            ] as $key => $sql) {
                $stmt = db()->prepare($sql);
                $stmt->execute([
                    'user_id' => $memberId,
                    'today_start' => $todayStart,
                    'today_end' => $todayEnd,
                ]);
                $counts[$key] = (int) $stmt->fetchColumn();
            }

            $performance[] = [
                '_id' => (string) $member['id'],
                'name' => $member['name'],
                'email' => $member['email'],
                'avatar' => $member['avatar'] ?? '',
                'role' => $member['role'],
                'totalLeads' => $counts['totalLeads'],
                'converted' => $counts['converted'],
                'followupsToday' => $counts['followupsToday'],
                'completedToday' => $counts['completedToday'],
                'missed' => $counts['missed'],
                'conversionRate' => $counts['totalLeads'] > 0 ? number_format(($counts['converted'] / $counts['totalLeads']) * 100, 1, '.', '') : '0.0',
                'earnings' => [
                    'total' => (float) ($member['earnings_total'] ?? 0),
                    'thisMonth' => (float) ($member['earnings_this_month'] ?? 0),
                    'thisWeek' => (float) ($member['earnings_this_week'] ?? 0),
                ],
            ];
        }

        send_json(['success' => true, 'performance' => $performance]);
    }

    if ($method === 'GET' && $segments === ['notifications']) {
        $stmt = db()->prepare(
            'SELECT n.*, l.name AS lead_name, l.phone AS lead_phone
             FROM notifications n
             LEFT JOIN leads l ON l.id = n.related_lead_id
             WHERE n.user_id = :user_id
             ORDER BY n.created_at DESC
             LIMIT 20'
        );
        $stmt->execute(['user_id' => $user['id']]);
        $notifications = [];
        foreach ($stmt->fetchAll() as $row) {
            $notifications[] = [
                '_id' => (string) $row['id'],
                'type' => $row['type'],
                'title' => $row['title'],
                'message' => $row['message'],
                'isRead' => (bool) $row['is_read'],
                'readAt' => $row['read_at'],
                'createdAt' => $row['created_at'],
                'relatedLead' => $row['related_lead_id'] ? [
                    '_id' => (string) $row['related_lead_id'],
                    'name' => $row['lead_name'],
                    'phone' => $row['lead_phone'],
                ] : null,
            ];
        }

        $countStmt = db()->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = 0');
        $countStmt->execute(['user_id' => $user['id']]);
        $unreadCount = (int) $countStmt->fetchColumn();

        send_json(['success' => true, 'notifications' => $notifications, 'unreadCount' => $unreadCount]);
    }

    if ($method === 'PUT' && $segments === ['notifications', 'read']) {
        db()->prepare('UPDATE notifications SET is_read = 1, read_at = NOW(), updated_at = NOW() WHERE user_id = :user_id AND is_read = 0')->execute([
            'user_id' => $user['id'],
        ]);
        send_json(['success' => true, 'message' => 'All notifications marked as read']);
    }

    if ($method === 'GET' && $segments === ['lead-status-chart']) {
        $sql = 'SELECT status AS _id, COUNT(*) AS count FROM leads WHERE is_active = 1';
        $params = [];
        if (!$isAdmin) {
            $sql .= ' AND assigned_to_user_id = :user_id';
            $params['user_id'] = $user['id'];
        }
        $sql .= ' GROUP BY status';

        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        send_json(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    error_json('Dashboard route not found', 404);
}

function handle_webinar_routes(string $method, array $segments): void
{
    $user = current_user();

    if ($method === 'GET' && !$segments) {
        $stmt = db()->query(
            'SELECT w.*, u.id AS created_by_id, u.name AS created_by_name
             FROM webinars w
             LEFT JOIN users u ON u.id = w.created_by_user_id
             ORDER BY w.scheduled_at DESC'
        );
        $webinars = [];
        foreach ($stmt->fetchAll() as $row) {
            $attStmt = db()->prepare(
                'SELECT wa.*, l.name AS lead_name, l.phone AS lead_phone, u.name AS marked_by_name
                 FROM webinar_attendees wa
                 LEFT JOIN leads l ON l.id = wa.lead_id
                 LEFT JOIN users u ON u.id = wa.marked_by_user_id
                 WHERE wa.webinar_id = :webinar_id
                 ORDER BY wa.id ASC'
            );
            $attStmt->execute(['webinar_id' => $row['id']]);
            $attendees = [];
            $attendedIds = [];
            foreach ($attStmt->fetchAll() as $attendee) {
                if ($attendee['status'] === 'attended') {
                    $attendedIds[] = (int) $attendee['lead_id'];
                }
                $attendees[] = [
                    '_id' => (string) $attendee['id'],
                    'lead' => [
                        '_id' => (string) $attendee['lead_id'],
                        'name' => $attendee['lead_name'],
                        'phone' => $attendee['lead_phone'],
                    ],
                    'status' => $attendee['status'],
                    'markedBy' => $attendee['marked_by_user_id'] ? [
                        '_id' => (string) $attendee['marked_by_user_id'],
                        'name' => $attendee['marked_by_name'],
                    ] : null,
                    'markedAt' => $attendee['marked_at'],
                ];
            }

            if ($attendedIds) {
                $params = [];
                $in = bind_in_clause($params, $attendedIds, 'attended_');
                $countSql = 'SELECT COUNT(*) FROM leads WHERE is_active = 1 AND id NOT IN (' . $in . ')';
                $countStmt = db()->prepare($countSql);
                $countStmt->execute($params);
                $notSeenCount = (int) $countStmt->fetchColumn();
            } else {
                $countStmt = db()->query('SELECT COUNT(*) FROM leads WHERE is_active = 1');
                $notSeenCount = (int) $countStmt->fetchColumn();
            }

            $webinars[] = [
                '_id' => (string) $row['id'],
                'title' => $row['title'],
                'description' => $row['description'],
                'scheduledAt' => $row['scheduled_at'],
                'duration' => (int) $row['duration'],
                'link' => $row['link'],
                'youtubeLink' => $row['youtube_link'],
                'zoomLink' => $row['zoom_link'],
                'platform' => $row['platform'],
                'status' => $row['status'],
                'createdBy' => $row['created_by_id'] ? ['_id' => (string) $row['created_by_id'], 'name' => $row['created_by_name']] : null,
                'attendees' => $attendees,
                'totalInvited' => (int) $row['total_invited'],
                'totalAttended' => (int) $row['total_attended'],
                'notes' => $row['notes'],
                'notSeenCount' => $notSeenCount,
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at'],
            ];
        }
        send_json(['success' => true, 'webinars' => $webinars]);
    }

    if ($method === 'GET' && $segments === ['not-seen-leads']) {
        $sql = 'SELECT id, name, phone, email, city, webinar_status FROM leads WHERE is_active = 1 AND webinar_status IN ("not_invited", "missed", "invited") LIMIT 200';
        $stmt = db()->query($sql);
        $leads = [];
        foreach ($stmt->fetchAll() as $row) {
            $leads[] = [
                '_id' => (string) $row['id'],
                'name' => $row['name'],
                'phone' => $row['phone'],
                'email' => $row['email'],
                'city' => $row['city'],
                'webinarStatus' => $row['webinar_status'],
            ];
        }
        send_json(['success' => true, 'leads' => $leads, 'count' => count($leads)]);
    }

    if ($method === 'POST' && !$segments) {
        require_role(['admin', 'manager']);
        $body = request_body();
        $stmt = db()->prepare(
            'INSERT INTO webinars
             (title, description, scheduled_at, duration, link, youtube_link, zoom_link, platform, status, created_by_user_id, notes, total_invited, total_attended, created_at, updated_at)
             VALUES (:title, :description, :scheduled_at, :duration, :link, :youtube_link, :zoom_link, :platform, :status, :created_by_user_id, :notes, 0, 0, NOW(), NOW())'
        );
        $stmt->execute([
            'title' => trim((string) ($body['title'] ?? '')),
            'description' => trim((string) ($body['description'] ?? '')) ?: null,
            'scheduled_at' => mysql_datetime($body['scheduledAt'] ?? null),
            'duration' => (int) ($body['duration'] ?? 60),
            'link' => trim((string) ($body['link'] ?? '')) ?: null,
            'youtube_link' => trim((string) ($body['youtubeLink'] ?? '')) ?: null,
            'zoom_link' => trim((string) ($body['zoomLink'] ?? '')) ?: null,
            'platform' => trim((string) ($body['platform'] ?? 'zoom')) ?: 'zoom',
            'status' => trim((string) ($body['status'] ?? 'upcoming')) ?: 'upcoming',
            'created_by_user_id' => $user['id'],
            'notes' => trim((string) ($body['notes'] ?? '')) ?: null,
        ]);
        send_json(['success' => true, 'webinar' => ['_id' => (string) db()->lastInsertId()]], 201);
    }

    if (count($segments) === 1 && ctype_digit($segments[0])) {
        $webinarId = (int) $segments[0];

        if ($method === 'PUT') {
            require_role(['admin', 'manager']);
            $body = request_body();
            db()->prepare(
                'UPDATE webinars
                 SET title = :title, description = :description, scheduled_at = :scheduled_at, duration = :duration,
                     link = :link, youtube_link = :youtube_link, zoom_link = :zoom_link, platform = :platform,
                     status = :status, notes = :notes, updated_at = NOW()
                 WHERE id = :id'
            )->execute([
                'title' => trim((string) ($body['title'] ?? '')),
                'description' => trim((string) ($body['description'] ?? '')) ?: null,
                'scheduled_at' => mysql_datetime($body['scheduledAt'] ?? null),
                'duration' => (int) ($body['duration'] ?? 60),
                'link' => trim((string) ($body['link'] ?? '')) ?: null,
                'youtube_link' => trim((string) ($body['youtubeLink'] ?? '')) ?: null,
                'zoom_link' => trim((string) ($body['zoomLink'] ?? '')) ?: null,
                'platform' => trim((string) ($body['platform'] ?? 'zoom')) ?: 'zoom',
                'status' => trim((string) ($body['status'] ?? 'upcoming')) ?: 'upcoming',
                'notes' => trim((string) ($body['notes'] ?? '')) ?: null,
                'id' => $webinarId,
            ]);
            send_json(['success' => true, 'webinar' => ['_id' => (string) $webinarId]]);
        }

        if ($method === 'DELETE') {
            require_role(['admin', 'manager']);
            db()->prepare('DELETE FROM webinars WHERE id = :id')->execute(['id' => $webinarId]);
            send_json(['success' => true, 'message' => 'Webinar deleted']);
        }
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'mark-attendance' && $method === 'PUT') {
        $webinarId = (int) $segments[0];
        $body = request_body();
        $leadId = (int) ($body['leadId'] ?? 0);
        $status = trim((string) ($body['status'] ?? 'invited')) ?: 'invited';

        $checkStmt = db()->prepare('SELECT id FROM webinar_attendees WHERE webinar_id = :webinar_id AND lead_id = :lead_id LIMIT 1');
        $checkStmt->execute(['webinar_id' => $webinarId, 'lead_id' => $leadId]);
        $existingId = $checkStmt->fetchColumn();

        if ($existingId) {
            db()->prepare(
                'UPDATE webinar_attendees
                 SET status = :status, marked_by_user_id = :marked_by_user_id, marked_at = NOW()
                 WHERE id = :id'
            )->execute([
                'status' => $status,
                'marked_by_user_id' => $user['id'],
                'id' => $existingId,
            ]);
        } else {
            db()->prepare(
                'INSERT INTO webinar_attendees (webinar_id, lead_id, status, marked_by_user_id, marked_at)
                 VALUES (:webinar_id, :lead_id, :status, :marked_by_user_id, NOW())'
            )->execute([
                'webinar_id' => $webinarId,
                'lead_id' => $leadId,
                'status' => $status,
                'marked_by_user_id' => $user['id'],
            ]);
        }

        db()->prepare(
            'UPDATE webinars
             SET total_attended = (SELECT COUNT(*) FROM webinar_attendees WHERE webinar_id = :webinar_id AND status = "attended"),
                 total_invited = (SELECT COUNT(*) FROM webinar_attendees WHERE webinar_id = :webinar_id),
                 updated_at = NOW()
             WHERE id = :webinar_id'
        )->execute(['webinar_id' => $webinarId]);

        $leadWebinarStatus = $status === 'attended' ? 'attended' : ($status === 'registered' ? 'registered' : 'invited');
        db()->prepare(
            'UPDATE leads
             SET webinar_status = :webinar_status, webinar_seen_at = :webinar_seen_at, updated_at = NOW()
             WHERE id = :lead_id'
        )->execute([
            'webinar_status' => $leadWebinarStatus,
            'webinar_seen_at' => $status === 'attended' ? now_sql() : null,
            'lead_id' => $leadId,
        ]);

        send_json(['success' => true, 'webinar' => ['_id' => (string) $webinarId]]);
    }

    if (count($segments) === 2 && ctype_digit($segments[0]) && $segments[1] === 'send-invites' && $method === 'POST') {
        require_role(['admin', 'manager']);
        error_json('WhatsApp integration is unavailable on PHP/MySQL shared hosting. Attendance and webinar data still work normally.', 400);
    }

    error_json('Webinar route not found', 404);
}

function handle_message_routes(string $method, array $segments): void
{
    $user = current_user();

    if ($method === 'GET' && !$segments) {
        $withUser = query_param('with');
        if ($withUser !== null) {
            $stmt = db()->prepare(
                'SELECT m.*,
                        fu.id AS from_id, fu.name AS from_name, fu.avatar AS from_avatar, fu.role AS from_role,
                        tu.id AS to_id, tu.name AS to_name, tu.avatar AS to_avatar, tu.role AS to_role
                 FROM messages m
                 INNER JOIN users fu ON fu.id = m.from_user_id
                 INNER JOIN users tu ON tu.id = m.to_user_id
                 WHERE (m.from_user_id = :current_user AND m.to_user_id = :with_user)
                    OR (m.from_user_id = :with_user_b AND m.to_user_id = :current_user_b)
                 ORDER BY m.created_at ASC
                 LIMIT 200'
            );
            $stmt->execute([
                'current_user' => $user['id'],
                'with_user' => (int) $withUser,
                'with_user_b' => (int) $withUser,
                'current_user_b' => $user['id'],
            ]);
            db()->prepare('UPDATE messages SET is_read = 1, updated_at = NOW() WHERE from_user_id = :from_user_id AND to_user_id = :to_user_id AND is_read = 0')->execute([
                'from_user_id' => (int) $withUser,
                'to_user_id' => $user['id'],
            ]);
        } else {
            $stmt = db()->prepare(
                'SELECT m.*,
                        fu.id AS from_id, fu.name AS from_name, fu.avatar AS from_avatar, fu.role AS from_role,
                        tu.id AS to_id, tu.name AS to_name, tu.avatar AS to_avatar, tu.role AS to_role
                 FROM messages m
                 INNER JOIN users fu ON fu.id = m.from_user_id
                 INNER JOIN users tu ON tu.id = m.to_user_id
                 WHERE m.from_user_id = :user_id OR m.to_user_id = :user_id_b
                 ORDER BY m.created_at ASC
                 LIMIT 200'
            );
            $stmt->execute([
                'user_id' => $user['id'],
                'user_id_b' => $user['id'],
            ]);
        }

        $messages = [];
        foreach ($stmt->fetchAll() as $row) {
            $messages[] = [
                '_id' => (string) $row['id'],
                'from' => [
                    '_id' => (string) $row['from_id'],
                    'name' => $row['from_name'],
                    'avatar' => $row['from_avatar'] ?? '',
                    'role' => $row['from_role'],
                ],
                'to' => [
                    '_id' => (string) $row['to_id'],
                    'name' => $row['to_name'],
                    'avatar' => $row['to_avatar'] ?? '',
                    'role' => $row['to_role'],
                ],
                'type' => $row['type'],
                'content' => $row['content'],
                'audioUrl' => $row['audio_url'],
                'isRead' => (bool) $row['is_read'],
                'whatsappSent' => (bool) $row['whatsapp_sent'],
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at'],
            ];
        }

        send_json(['success' => true, 'messages' => $messages]);
    }

    if ($method === 'GET' && $segments === ['unread-count']) {
        $stmt = db()->prepare('SELECT COUNT(*) FROM messages WHERE to_user_id = :user_id AND is_read = 0');
        $stmt->execute(['user_id' => $user['id']]);
        send_json(['success' => true, 'count' => (int) $stmt->fetchColumn()]);
    }

    if ($method === 'POST' && $segments === ['send']) {
        $body = request_body();
        $toUserId = (int) ($body['toUserId'] ?? 0);
        $content = trim((string) ($body['content'] ?? ''));
        if ($toUserId <= 0 || $content === '') {
            error_json('Recipient and content required', 400);
        }

        $check = db()->prepare('SELECT id, name, avatar, role FROM users WHERE id = :id LIMIT 1');
        $check->execute(['id' => $toUserId]);
        $toUser = $check->fetch();
        if (!$toUser) {
            error_json('User not found', 404);
        }

        db()->prepare(
            'INSERT INTO messages (from_user_id, to_user_id, type, content, audio_url, is_read, whatsapp_sent, created_at, updated_at)
             VALUES (:from_user_id, :to_user_id, "text", :content, NULL, 0, 0, NOW(), NOW())'
        )->execute([
            'from_user_id' => $user['id'],
            'to_user_id' => $toUserId,
            'content' => $content,
        ]);
        $messageId = (int) db()->lastInsertId();

        send_json([
            'success' => true,
            'message' => [
                '_id' => (string) $messageId,
                'from' => min_user($user),
                'to' => [
                    '_id' => (string) $toUser['id'],
                    'name' => $toUser['name'],
                    'avatar' => $toUser['avatar'] ?? '',
                    'role' => $toUser['role'],
                ],
                'type' => 'text',
                'content' => $content,
                'audioUrl' => null,
                'isRead' => false,
                'whatsappSent' => false,
                'createdAt' => now_sql(),
            ],
            'whatsappSent' => false,
        ], 201);
    }

    if ($method === 'POST' && $segments === ['send-voice']) {
        $toUserId = (int) ($_POST['toUserId'] ?? 0);
        if ($toUserId <= 0 || empty($_FILES['audio'])) {
            error_json('Recipient and audio required', 400);
        }

        $file = $_FILES['audio'];
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            error_json('Failed to upload audio', 400);
        }

        $extension = '.webm';
        $mime = $file['type'] ?? '';
        if (strpos($mime, 'ogg') !== false) {
            $extension = '.ogg';
        } elseif (strpos($mime, 'mp4') !== false) {
            $extension = '.mp4';
        }

        $filename = 'voice_' . time() . '_' . bin2hex(random_bytes(4)) . $extension;
        $diskPath = app_config()['app']['uploads_disk_path'] . $filename;
        if (!move_uploaded_file($file['tmp_name'], $diskPath)) {
            error_json('Failed to store audio file', 500);
        }

        $audioUrl = app_config()['app']['uploads_public_path'] . $filename;
        db()->prepare(
            'INSERT INTO messages (from_user_id, to_user_id, type, content, audio_url, is_read, whatsapp_sent, created_at, updated_at)
             VALUES (:from_user_id, :to_user_id, "voice", NULL, :audio_url, 0, 0, NOW(), NOW())'
        )->execute([
            'from_user_id' => $user['id'],
            'to_user_id' => $toUserId,
            'audio_url' => $audioUrl,
        ]);
        $messageId = (int) db()->lastInsertId();

        send_json([
            'success' => true,
            'message' => [
                '_id' => (string) $messageId,
                'from' => min_user($user),
                'to' => ['_id' => (string) $toUserId],
                'type' => 'voice',
                'content' => null,
                'audioUrl' => $audioUrl,
                'isRead' => false,
                'whatsappSent' => false,
                'createdAt' => now_sql(),
            ],
            'whatsappSent' => false,
        ], 201);
    }

    error_json('Message route not found', 404);
}

function handle_meeting_routes(string $method, array $segments): void
{
    $user = current_user();

    if ($method === 'GET' && !$segments) {
        $stmt = db()->prepare(
            'SELECT DISTINCT m.*,
                    ou.id AS organizer_id, ou.name AS organizer_name, ou.avatar AS organizer_avatar
             FROM meetings m
             LEFT JOIN users ou ON ou.id = m.organizer_user_id
             LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id
             WHERE m.organizer_user_id = :user_id OR mp.user_id = :user_id_b
             ORDER BY m.scheduled_at DESC'
        );
        $stmt->execute(['user_id' => $user['id'], 'user_id_b' => $user['id']]);

        $meetings = [];
        foreach ($stmt->fetchAll() as $row) {
            $pStmt = db()->prepare(
                'SELECT u.id, u.name, u.avatar, u.role
                 FROM meeting_participants mp
                 INNER JOIN users u ON u.id = mp.user_id
                 WHERE mp.meeting_id = :meeting_id
                 ORDER BY u.name ASC'
            );
            $pStmt->execute(['meeting_id' => $row['id']]);
            $participants = [];
            foreach ($pStmt->fetchAll() as $participant) {
                $participants[] = [
                    '_id' => (string) $participant['id'],
                    'name' => $participant['name'],
                    'avatar' => $participant['avatar'] ?? '',
                    'role' => $participant['role'],
                ];
            }

            $meetings[] = [
                '_id' => (string) $row['id'],
                'title' => $row['title'],
                'scheduledAt' => $row['scheduled_at'],
                'duration' => (int) $row['duration'],
                'meetingLink' => $row['meeting_link'],
                'platform' => $row['platform'],
                'organizer' => [
                    '_id' => (string) $row['organizer_id'],
                    'name' => $row['organizer_name'],
                    'avatar' => $row['organizer_avatar'] ?? '',
                ],
                'participants' => $participants,
                'status' => $row['status'],
                'notes' => $row['notes'],
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at'],
            ];
        }
        send_json(['success' => true, 'meetings' => $meetings]);
    }

    if ($method === 'POST' && !$segments) {
        $body = request_body();
        $stmt = db()->prepare(
            'INSERT INTO meetings
             (title, scheduled_at, duration, meeting_link, platform, organizer_user_id, status, notes, created_at, updated_at)
             VALUES (:title, :scheduled_at, :duration, :meeting_link, :platform, :organizer_user_id, :status, :notes, NOW(), NOW())'
        );
        $stmt->execute([
            'title' => trim((string) ($body['title'] ?? '')),
            'scheduled_at' => mysql_datetime($body['scheduledAt'] ?? null),
            'duration' => (int) ($body['duration'] ?? 30),
            'meeting_link' => trim((string) ($body['meetingLink'] ?? '')) ?: null,
            'platform' => trim((string) ($body['platform'] ?? 'zoom')) ?: 'zoom',
            'organizer_user_id' => $user['id'],
            'status' => trim((string) ($body['status'] ?? 'scheduled')) ?: 'scheduled',
            'notes' => trim((string) ($body['notes'] ?? '')) ?: null,
        ]);
        $meetingId = (int) db()->lastInsertId();

        foreach (($body['participants'] ?? []) as $participantId) {
            db()->prepare('INSERT IGNORE INTO meeting_participants (meeting_id, user_id, created_at) VALUES (:meeting_id, :user_id, NOW())')->execute([
                'meeting_id' => $meetingId,
                'user_id' => (int) $participantId,
            ]);
        }

        send_json(['success' => true, 'meeting' => ['_id' => (string) $meetingId]], 201);
    }

    if (count($segments) === 1 && ctype_digit($segments[0])) {
        $meetingId = (int) $segments[0];

        if ($method === 'PUT') {
            $body = request_body();
            $stmt = db()->prepare(
                'UPDATE meetings
                 SET title = :title, scheduled_at = :scheduled_at, duration = :duration, meeting_link = :meeting_link,
                     platform = :platform, status = :status, notes = :notes, updated_at = NOW()
                 WHERE id = :id AND organizer_user_id = :organizer_user_id'
            );
            $stmt->execute([
                'title' => trim((string) ($body['title'] ?? '')),
                'scheduled_at' => mysql_datetime($body['scheduledAt'] ?? null),
                'duration' => (int) ($body['duration'] ?? 30),
                'meeting_link' => trim((string) ($body['meetingLink'] ?? '')) ?: null,
                'platform' => trim((string) ($body['platform'] ?? 'zoom')) ?: 'zoom',
                'status' => trim((string) ($body['status'] ?? 'scheduled')) ?: 'scheduled',
                'notes' => trim((string) ($body['notes'] ?? '')) ?: null,
                'id' => $meetingId,
                'organizer_user_id' => $user['id'],
            ]);
            if ($stmt->rowCount() === 0) {
                error_json('Meeting not found', 404);
            }

            db()->prepare('DELETE FROM meeting_participants WHERE meeting_id = :meeting_id')->execute(['meeting_id' => $meetingId]);
            foreach (($body['participants'] ?? []) as $participantId) {
                db()->prepare('INSERT IGNORE INTO meeting_participants (meeting_id, user_id, created_at) VALUES (:meeting_id, :user_id, NOW())')->execute([
                    'meeting_id' => $meetingId,
                    'user_id' => (int) $participantId,
                ]);
            }

            send_json(['success' => true, 'meeting' => ['_id' => (string) $meetingId]]);
        }

        if ($method === 'DELETE') {
            $stmt = db()->prepare('DELETE FROM meetings WHERE id = :id AND organizer_user_id = :organizer_user_id');
            $stmt->execute(['id' => $meetingId, 'organizer_user_id' => $user['id']]);
            if ($stmt->rowCount() === 0) {
                error_json('Meeting not found', 404);
            }
            send_json(['success' => true]);
        }
    }

    error_json('Meeting route not found', 404);
}

function handle_sheet_routes(string $method, array $segments): void
{
    require_role(['admin', 'manager']);

    if ($method === 'POST' && $segments === ['sync']) {
        $sheetId = trim((string) (request_body()['sheetId'] ?? ''));
        if ($sheetId === '') {
            error_json('Sheet ID is required', 400);
        }

        $rows = read_csv_from_sheet($sheetId);
        if (count($rows) < 2) {
            send_json(['success' => true, 'created' => 0, 'updated' => 0, 'skipped' => 0]);
        }

        $headers = array_shift($rows);
        $result = import_lead_rows($headers, $rows, $sheetId);
        send_json(['success' => true] + $result);
    }

    if ($method === 'GET' && $segments === ['preview']) {
        $sheetId = trim((string) query_param('sheetId', ''));
        if ($sheetId === '') {
            error_json('Sheet ID is required', 400);
        }

        $rows = read_csv_from_sheet($sheetId);
        if (!$rows) {
            send_json(['success' => true, 'data' => ['headers' => [], 'rows' => [], 'totalRows' => 0]]);
        }

        $headers = $rows[0];
        $previewRows = array_slice($rows, 1, 10);
        send_json([
            'success' => true,
            'data' => [
                'headers' => $headers,
                'rows' => $previewRows,
                'totalRows' => max(0, count($rows) - 1),
            ],
        ]);
    }

    if ($method === 'POST' && $segments === ['upload-csv']) {
        $body = request_body();
        $headers = $body['headers'] ?? [];
        $rows = $body['rows'] ?? [];
        if (!$headers || !$rows) {
            error_json('No data provided', 400);
        }

        $result = import_lead_rows($headers, $rows);
        send_json(['success' => true] + $result);
    }

    error_json('Sheets route not found', 404);
}

function handle_whatsapp_routes(string $method, array $segments): void
{
    current_user();

    if ($method === 'GET' && $segments === ['status']) {
        send_json([
            'success' => true,
            'status' => 'unsupported',
            'available' => false,
            'connected' => false,
            'message' => 'WhatsApp browser automation is not available on PHP/MySQL shared hosting.',
        ]);
    }

    if ($method === 'POST' && in_array($segments[0] ?? '', ['init', 'disconnect', 'send', 'send-bulk'], true)) {
        error_json('WhatsApp integration is unavailable on PHP/MySQL shared hosting.', 400);
    }

    error_json('WhatsApp route not found', 404);
}
