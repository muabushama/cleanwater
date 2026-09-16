<?php

declare(strict_types=1);

$configPath = __DIR__ . '/config.local.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'API config file is missing.']);
    exit;
}

$config = require $configPath;

date_default_timezone_set($config['timezone'] ?? 'UTC');

$jsonFields = [
    'customer_devices' => ['candles'],
    'work_orders' => ['items', 'previous_visits'],
    'maintenance' => ['next_dates'],
    'purchases' => ['items'],
    'station_maintenance' => ['product_lines', 'changed_candles'],
];

$defaultCandles = [
    ['name' => 'الشمعة الأولى', 'type' => 'عادي درجة اولى', 'price' => 30, 'duration_months' => 3],
    ['name' => 'الشمعة الثانية', 'type' => 'عادي درجة اولى', 'price' => 30, 'duration_months' => 6],
    ['name' => 'الشمعة الثالثة', 'type' => 'عادي درجة اولى', 'price' => 30, 'duration_months' => 9],
    ['name' => 'الشمعة الرابعة', 'type' => 'عادي درجة اولى', 'price' => 30, 'duration_months' => 24],
    ['name' => 'الشمعة الخامسة', 'type' => 'عادي درجة اولى', 'price' => 30, 'duration_months' => 12],
    ['name' => 'الشمعة السادسة', 'type' => 'عادي درجة اولى', 'price' => 30, 'duration_months' => 24],
    ['name' => 'الشمعة السابعة', 'type' => 'عادي درجة اولى', 'price' => 30, 'duration_months' => 24],
];

$tableRules = [
    'users' => ['authRequired' => false, 'select' => 'admin', 'insert' => 'admin', 'update' => 'admin', 'delete' => 'admin'],
    'profiles' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'admin', 'update' => 'auth', 'delete' => 'admin'],
    'user_roles' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'admin', 'update' => 'admin', 'delete' => 'admin'],
    'customers' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'products' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'admin', 'update' => 'auth', 'delete' => 'auth'],
    'customer_devices' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'candle_changes' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'installments' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'invoices' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'maintenance' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'work_orders' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'rep_locations' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'admin', 'delete' => 'admin'],
    'system_settings' => ['authRequired' => true, 'select' => 'admin', 'insert' => 'admin', 'update' => 'admin', 'delete' => 'admin'],
    // جداول إضافية مستخدمة في التطبيق ويجب السماح بها أيضاً
    'areas' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'stock_movements' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'admin', 'delete' => 'auth'],
    'inventory_categories' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'admin', 'update' => 'admin', 'delete' => 'admin'],
    'expenses' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'purchases' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'returns' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'receipt_vouchers' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'payment_vouchers' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'banks' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'bank_accounts' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'invoice_lines' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'stations' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'station_maintenance' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'station_contract_installments' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'candle_types' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'rep_inventory' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
    'rep_inventory_transfers' => ['authRequired' => true, 'select' => 'auth', 'insert' => 'auth', 'update' => 'auth', 'delete' => 'admin'],
];

$deleteAllOrder = [
    'candle_changes',
    'installments',
    'invoices',
    'maintenance',
    'work_orders',
    'customer_devices',
    'customers',
    'rep_locations',
    'products',
];

$assignableRoles = ['admin', 'sales_rep', 'customer_service', 'warehouse_keeper'];

function sendJson(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function persistAuthCookie(?string $token): void
{
    $options = [
        'expires' => $token === null ? time() - 3600 : time() + (7 * 24 * 60 * 60),
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ];

    setcookie('oasis_token', $token ?? '', $options);
}

function getAllowedOrigins(array $config): array
{
    $raw = (string)($config['client_origin'] ?? '');
    $items = array_filter(array_map('trim', explode(',', $raw)));
    return array_values($items);
}

function sendCorsHeaders(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = getAllowedOrigins($config);
    if ($origin !== '' && (empty($allowedOrigins) || in_array($origin, $allowedOrigins, true))) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}

function base64UrlEncode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64UrlDecode(string $value): string
{
    $padding = strlen($value) % 4;
    if ($padding > 0) {
        $value .= str_repeat('=', 4 - $padding);
    }
    return base64_decode(strtr($value, '-_', '+/')) ?: '';
}

function generateUuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function makeToken(array $user, array $config): string
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload = [
        'sub' => $user['id'],
        'email' => $user['email'],
        'iat' => time(),
        'exp' => time() + (7 * 24 * 60 * 60),
    ];

    $headerEncoded = base64UrlEncode(json_encode($header));
    $payloadEncoded = base64UrlEncode(json_encode($payload));
    $signature = hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, $config['jwt_secret'], true);

    return $headerEncoded . '.' . $payloadEncoded . '.' . base64UrlEncode($signature);
}

function verifyToken(string $token, array $config): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;
    $expected = base64UrlEncode(hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, $config['jwt_secret'], true));
    if (!hash_equals($expected, $signatureEncoded)) {
        return null;
    }

    $payload = json_decode(base64UrlDecode($payloadEncoded), true);
    if (!is_array($payload)) {
        return null;
    }

    if (($payload['exp'] ?? 0) < time()) {
        return null;
    }

    return $payload;
}

function getBearerToken(): ?string
{
    $headersToCheck = [
        $_SERVER['HTTP_AUTHORIZATION'] ?? null,
        $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null,
        $_SERVER['Authorization'] ?? null,
        $_SERVER['HTTP_X_AUTHORIZATION'] ?? null,
    ];

    if (function_exists('getallheaders')) {
        $allHeaders = getallheaders();
        foreach (['Authorization', 'authorization'] as $key) {
            if (!empty($allHeaders[$key])) {
                $headersToCheck[] = $allHeaders[$key];
            }
        }
    }

    if (function_exists('apache_request_headers')) {
        $apacheHeaders = apache_request_headers();
        foreach (['Authorization', 'authorization'] as $key) {
            if (!empty($apacheHeaders[$key])) {
                $headersToCheck[] = $apacheHeaders[$key];
            }
        }
    }

    foreach ($headersToCheck as $header) {
        if (!is_string($header) || $header === '') {
            continue;
        }

        if (preg_match('/Bearer\s+(.+)/i', $header, $matches) === 1) {
            return trim($matches[1]);
        }
    }

    if (!empty($_COOKIE['oasis_token']) && is_string($_COOKIE['oasis_token'])) {
        return trim($_COOKIE['oasis_token']);
    }

    return null;
}

function db(array $config): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']);
    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    oasisEnsureMysqlSchema($pdo);

    return $pdo;
}

/**
 * إضافة أعمدة/جداول ناقصة (مثل sku_code) — يُنفَّذ مرة واحدة لكل عملية PHP.
 */
function oasisEnsureMysqlSchema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $creates = [
        "CREATE TABLE IF NOT EXISTS areas (id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL, parent_id VARCHAR(36) NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_areas_branch (branch), KEY idx_areas_parent (parent_id))",
        "CREATE TABLE IF NOT EXISTS stock_movements (id VARCHAR(36) PRIMARY KEY, product_id VARCHAR(36) NOT NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية', type VARCHAR(50) NOT NULL DEFAULT 'sale', quantity INT NOT NULL DEFAULT 0, unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0, movement_date DATE NULL, warehouse_id VARCHAR(36) NULL, technician_user_id VARCHAR(36) NULL, reference_type VARCHAR(50) NULL, reference_id VARCHAR(36) NULL, notes TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_sm_product (product_id), KEY idx_sm_branch (branch))",
        "CREATE TABLE IF NOT EXISTS inventory_categories (id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL, icon_key VARCHAR(50) NOT NULL DEFAULT 'default', parent_id VARCHAR(36) NULL, sort_order INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_inv_cat_parent (parent_id))",
        "CREATE TABLE IF NOT EXISTS stations (id VARCHAR(36) PRIMARY KEY, name VARCHAR(191) NOT NULL, customer_id VARCHAR(36) NULL, customer_name VARCHAR(191) NOT NULL DEFAULT '', customer_phone VARCHAR(50) NULL, customer_address TEXT NULL, area VARCHAR(191) NULL, address TEXT NULL, station_type VARCHAR(100) NULL, capacity VARCHAR(191) NULL, install_date DATE NULL, warranty_months INT NOT NULL DEFAULT 12, warranty_end DATE NULL, contract_type VARCHAR(100) NOT NULL DEFAULT 'بدون عقد', contract_value DECIMAL(12,2) NOT NULL DEFAULT 0, contract_duration_months INT NOT NULL DEFAULT 0, contract_start_date DATE NULL, contract_end_date DATE NULL, contract_first_visit_date DATE NULL, contract_installments_count INT NOT NULL DEFAULT 0, contract_installment_interval_months INT NOT NULL DEFAULT 1, contract_first_installment_date DATE NULL, location TEXT NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية', status VARCHAR(50) NOT NULL DEFAULT 'active', notes TEXT NULL, created_by VARCHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_stations_branch (branch))",
        "CREATE TABLE IF NOT EXISTS station_maintenance (id VARCHAR(36) PRIMARY KEY, station_id VARCHAR(36) NOT NULL, maintenance_date DATE NOT NULL, maintenance_type VARCHAR(100) NOT NULL DEFAULT 'صيانة دورية', description TEXT NULL, parts_used TEXT NULL, parts_cost DECIMAL(12,2) NOT NULL DEFAULT 0, labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0, total_cost DECIMAL(12,2) NOT NULL DEFAULT 0, total_sale DECIMAL(12,2) NOT NULL DEFAULT 0, collected DECIMAL(12,2) NOT NULL DEFAULT 0, product_lines JSON NULL, changed_candles JSON NULL, technician VARCHAR(191) NULL, notes TEXT NULL, branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_station_maint_station (station_id), KEY idx_station_maint_date (maintenance_date), KEY idx_station_maint_branch (branch))",
        "CREATE TABLE IF NOT EXISTS station_contract_installments (id VARCHAR(36) PRIMARY KEY, station_id VARCHAR(36) NOT NULL, installment_date DATE NULL, amount DECIMAL(12,2) NOT NULL DEFAULT 0, status VARCHAR(100) NOT NULL DEFAULT 'معلق', collection_date DATE NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_sci_station (station_id))",
    ];
    foreach ($creates as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // ignore
        }
    }

    $alters = [
        ['products', 'sku_code', 'VARCHAR(64) NULL'],
        ['products', 'barcode', 'VARCHAR(128) NULL'],
        ['products', 'unit', "VARCHAR(32) NULL DEFAULT 'قطعة'"],
        ['products', 'supplier_name', 'VARCHAR(191) NULL'],
        ['products', 'description', 'TEXT NULL'],
        ['products', 'serial_number', 'INT NULL'],
        ['products', 'branch', "VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية'"],
        ['products', 'storage_location', "VARCHAR(191) NOT NULL DEFAULT 'المخزن الرئيسي'"],
        ['customers', 'customer_code', 'VARCHAR(64) NULL'],
        ['customers', 'customer_type', "VARCHAR(50) NOT NULL DEFAULT 'sales'"],
        ['customers', 'phone2', 'VARCHAR(50) NULL'],
        ['customers', 'area_id', 'VARCHAR(36) NULL'],
        ['invoices', 'quantity', 'INT NOT NULL DEFAULT 1'],
        ['invoices', 'product_id', 'VARCHAR(36) NULL'],
        ['invoices', 'rep_names', 'JSON NULL'],
        ['invoices', 'due_date', 'DATE NULL'],
        ['invoices', 'delivery_status', "VARCHAR(50) NOT NULL DEFAULT 'pending'"],
        ['invoices', 'notes', 'TEXT NULL'],
        ['invoices', 'subtotal', 'DECIMAL(12,2) NULL'],
        ['invoices', 'discount_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
        ['invoices', 'discount_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
        ['invoices', 'tax_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
        ['invoices', 'tax_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
        ['invoices', 'auto_stock_deduct', 'TINYINT(1) NOT NULL DEFAULT 1'],
        ['invoices', 'invoice_direction', "VARCHAR(50) NOT NULL DEFAULT 'مبيعات'"],
        ['invoices', 'technician', 'VARCHAR(191) NULL'],
        ['stock_movements', 'unit_cost', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
        ['stock_movements', 'movement_date', 'DATE NULL'],
        ['stock_movements', 'warehouse_id', 'VARCHAR(36) NULL'],
        ['stock_movements', 'technician_user_id', 'VARCHAR(36) NULL'],
        ['customer_devices', 'contract_value', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
        ['customer_devices', 'contract_duration_months', 'INT NOT NULL DEFAULT 0'],
        ['customer_devices', 'contract_start_date', 'DATE NULL'],
        ['customer_devices', 'contract_end_date', 'DATE NULL'],
        ['customer_devices', 'contract_first_visit_date', 'DATE NULL'],
        ['customer_devices', 'contract_installment_interval_months', 'INT NOT NULL DEFAULT 1'],
        ['customer_devices', 'first_installment_date', 'DATE NULL'],
        ['customer_devices', 'installments_count', 'INT NULL'],
        ['candle_changes', 'candle8', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['candle_changes', 'candle9', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['candle_changes', 'candle10', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['maintenance', 'next_dates', 'JSON NULL'],
        ['work_orders', 'area_id', 'VARCHAR(36) NULL'],
        ['station_maintenance', 'total_sale', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
        ['station_maintenance', 'product_lines', 'JSON NULL'],
        ['station_maintenance', 'changed_candles', 'JSON NULL'],
        ['purchases', 'paid', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
        ['purchases', 'remaining', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
        ['purchases', 'items', 'JSON NULL'],
        ['purchases', 'invoice_file_url', 'TEXT NULL'],
    ];
    foreach ($alters as [$t, $c, $ddl]) {
        try {
            $pdo->exec("ALTER TABLE `{$t}` ADD COLUMN `{$c}` {$ddl}");
        } catch (Throwable $e) {
            // ignore duplicate/missing table
        }
    }

    try {
        $pdo->exec("ALTER TABLE `user_roles` MODIFY COLUMN `role` ENUM('admin','sales_rep','customer_service','warehouse_keeper','staff') NOT NULL");
    } catch (Throwable $e) {
        // ignore
    }

    $GLOBALS['oasis_mysql_table_cols'] = [];
}

function oasisMysqlTableColumns(PDO $pdo, string $table): array
{
    if (!isset($GLOBALS['oasis_mysql_table_cols'])) {
        $GLOBALS['oasis_mysql_table_cols'] = [];
    }
    $key = $table;
    if (isset($GLOBALS['oasis_mysql_table_cols'][$key])) {
        return $GLOBALS['oasis_mysql_table_cols'][$key];
    }
    $safe = str_replace(['`', ';'], '', $table);
    try {
        $stmt = $pdo->query('SHOW COLUMNS FROM `' . $safe . '`');
        $rows = $stmt->fetchAll();
        $GLOBALS['oasis_mysql_table_cols'][$key] = array_map(static fn(array $r): string => (string)$r['Field'], $rows);
    } catch (Throwable $e) {
        $GLOBALS['oasis_mysql_table_cols'][$key] = [];
    }

    return $GLOBALS['oasis_mysql_table_cols'][$key];
}

function oasisFilterRowToTableColumns(PDO $pdo, string $table, array $row): array
{
    $cols = oasisMysqlTableColumns($pdo, $table);
    if ($cols === []) {
        return $row;
    }
    $flip = array_flip($cols);
    $out = [];
    foreach ($row as $k => $v) {
        if (isset($flip[(string)$k])) {
            $out[$k] = $v;
        }
    }

    return $out;
}

function parseJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function getCurrentUser(PDO $pdo, array $config): ?array
{
    $token = getBearerToken();
    if ($token === null) {
        return null;
    }

    $payload = verifyToken($token, $config);
    if (!is_array($payload) || empty($payload['sub'])) {
        return null;
    }

    return getUserWithProfile($pdo, (string)$payload['sub']);
}

function getUserRoles(PDO $pdo, string $userId): array
{
    $stmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
    $stmt->execute([$userId]);
    return array_map(static fn(array $row): string => (string)$row['role'], $stmt->fetchAll());
}

function getUserWithProfile(PDO $pdo, string $userId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT u.id, u.email, u.is_active, u.created_at, p.full_name, p.phone, p.avatar_url, p.branch_id
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         WHERE u.id = ?
         LIMIT 1'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'created_at' => $row['created_at'],
        'is_active' => (bool)$row['is_active'],
        'profile' => [
            'full_name' => $row['full_name'] ?? '',
            'phone' => $row['phone'] ?? '',
            'avatar_url' => $row['avatar_url'] ?? '',
            'branch_id' => $row['branch_id'] ?? '1',
        ],
        'roles' => getUserRoles($pdo, $row['id']),
    ];
}

function isAdmin(?array $user): bool
{
    return is_array($user) && in_array('admin', $user['roles'] ?? [], true);
}

function requireAuth(?array $user): void
{
    if ($user === null) {
        sendJson(401, ['error' => 'غير مصرح']);
    }
}

function requireAdminRole(?array $user): void
{
    requireAuth($user);
    if (!isAdmin($user)) {
        sendJson(403, ['error' => 'صلاحيات المدير مطلوبة']);
    }
}

function branchScopedTables(): array
{
    return [
        'customers',
        'products',
        'customer_devices',
        'invoices',
        'maintenance',
        'work_orders',
        'areas',
        'stock_movements',
        'purchases',
        'returns',
        'expenses',
        'banks',
        'bank_accounts',
        'receipt_vouchers',
        'payment_vouchers',
        'stations',
        'station_maintenance',
        'station_contract_installments',
        'candle_types',
        'rep_inventory',
    ];
}

function isBranchScopedTable(string $table): bool
{
    return in_array($table, branchScopedTables(), true);
}

function branchDisplayNameFromProfile(?string $branchId): string
{
    $id = ($branchId !== null && $branchId !== '') ? (string)$branchId : '1';
    $map = [
        '1' => 'فرع الإسكندرية',
        '2' => 'فرع الجيزة',
        'فرع الإسكندرية' => 'فرع الإسكندرية',
        'فرع الجيزة' => 'فرع الجيزة',
    ];

    return $map[$id] ?? ($id !== '' ? $id : 'فرع الإسكندرية');
}

function enforcedBranchName(?array $user): ?string
{
    if ($user === null || !isset($user['profile']['branch_id'])) {
        return null;
    }

    return branchDisplayNameFromProfile((string)$user['profile']['branch_id']);
}

/** Non-admin: force profile branch on queries. Admin: use filters from client (active branch in UI). */
function mergeBranchScopeFilters(?array $user, string $table, array $filters): array
{
    if (!isBranchScopedTable($table)) {
        return $filters;
    }
    if ($user === null || isAdmin($user)) {
        return $filters;
    }
    $forced = enforcedBranchName($user);
    if ($forced === null) {
        return $filters;
    }
    $out = [];
    foreach ($filters as $f) {
        if (is_array($f) && ($f['field'] ?? '') === 'branch' && ($f['operator'] ?? '') === 'eq') {
            continue;
        }
        $out[] = $f;
    }
    $out[] = ['field' => 'branch', 'operator' => 'eq', 'value' => $forced];

    return $out;
}

function applyBranchScopeToInsertRow(string $table, array $row, ?array $user): array
{
    if (!isBranchScopedTable($table) || $user === null || isAdmin($user)) {
        return $row;
    }
    $forced = enforcedBranchName($user);
    if ($forced === null) {
        return $row;
    }
    $row['branch'] = $forced;

    return $row;
}

function applyBranchScopeToUpdateValues(string $table, array $values, ?array $user): array
{
    if (!isBranchScopedTable($table) || $user === null || isAdmin($user)) {
        return $values;
    }
    $forced = enforcedBranchName($user);
    if ($forced === null) {
        return $values;
    }
    if (array_key_exists('branch', $values)) {
        $values['branch'] = $forced;
    }

    return $values;
}

function parseTableRow(string $table, array $row, array $jsonFields, array $defaultCandles): array
{
    foreach ($jsonFields[$table] ?? [] as $field) {
        $value = $row[$field] ?? null;
        if ($value === null || $value === '') {
            $row[$field] = $field === 'candles' ? $defaultCandles : [];
            continue;
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $row[$field] = is_array($decoded) ? $decoded : ($field === 'candles' ? $defaultCandles : []);
        }
    }

    return $row;
}

function stringifyTablePayload(string $table, array $payload, array $jsonFields, array $defaultCandles): array
{
    foreach ($jsonFields[$table] ?? [] as $field) {
        if (array_key_exists($field, $payload)) {
            $payload[$field] = json_encode($payload[$field] ?? ($field === 'candles' ? $defaultCandles : []), JSON_UNESCAPED_UNICODE);
        }
    }
    return $payload;
}

function buildWhere(array $filters): array
{
    $clauses = [];
    $params = [];

    foreach ($filters as $filter) {
        if (!is_array($filter) || empty($filter['field']) || empty($filter['operator'])) {
            continue;
        }

        $field = '`' . str_replace('`', '', (string)$filter['field']) . '`';
        $operator = (string)$filter['operator'];

        if ($operator === 'eq') {
            $clauses[] = $field . ' = ?';
            $params[] = $filter['value'] ?? null;
            continue;
        }

        if ($operator === 'neq') {
            $clauses[] = $field . ' <> ?';
            $params[] = $filter['value'] ?? null;
            continue;
        }

        if ($operator === 'in') {
            $values = is_array($filter['value'] ?? null) ? $filter['value'] : [];
            if ($values === []) {
                $clauses[] = '1 = 0';
            } else {
                $clauses[] = $field . ' IN (' . implode(', ', array_fill(0, count($values), '?')) . ')';
                foreach ($values as $value) {
                    $params[] = $value;
                }
            }
            continue;
        }

        if ($operator === 'not' && ($filter['comparator'] ?? '') === 'is') {
            if (($filter['value'] ?? null) === null) {
                $clauses[] = $field . ' IS NOT NULL';
            } else {
                $clauses[] = $field . ' <> ?';
                $params[] = $filter['value'];
            }
        }
    }

    return [
        'sql' => $clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses),
        'params' => $params,
    ];
}

function normalizeInsertRow(string $table, array $row, ?array $user, array $defaultCandles): array
{
    if (!isset($row['id']) || $row['id'] === '') {
        $row['id'] = generateUuid();
    }

    if (array_key_exists('created_by', $row) && ($row['created_by'] === null || $row['created_by'] === '') && $user !== null) {
        $row['created_by'] = $user['id'];
    }

    if ($table === 'customer_devices' && !array_key_exists('candles', $row)) {
        $row['candles'] = $defaultCandles;
    }

    if ($table === 'work_orders') {
        if (!array_key_exists('items', $row)) {
            $row['items'] = [];
        }
        if (!array_key_exists('previous_visits', $row)) {
            $row['previous_visits'] = [];
        }
    }

    return $row;
}

function validateMutation(string $table, array $row, ?array $user): void
{
    if ($table === 'rep_locations' && !isAdmin($user) && (($row['user_id'] ?? '') !== ($user['id'] ?? ''))) {
        sendJson(403, ['data' => null, 'error' => ['message' => 'غير مسموح بتسجيل موقع لمستخدم آخر']]);
    }

    if ($table === 'profiles' && !isAdmin($user) && isset($row['id']) && $row['id'] !== ($user['id'] ?? '')) {
        sendJson(403, ['data' => null, 'error' => ['message' => 'غير مسموح بتعديل ملف مستخدم آخر']]);
    }
}

function createInstallments(PDO $pdo, array $deviceRow): void
{
    if (($deviceRow['contract_type'] ?? '') !== 'تقسيط') {
        return;
    }

    $count = (int)($deviceRow['installments_count'] ?? 0);
    $amount = (float)($deviceRow['installment_amount'] ?? 0);
    if ($count <= 0 || $amount <= 0) {
        return;
    }

    $startDate = !empty($deviceRow['first_installment_date']) ? new DateTime((string)$deviceRow['first_installment_date']) : new DateTime();
    $stmt = $pdo->prepare(
        'INSERT INTO installments (id, customer_id, device_id, installment_date, amount, status)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    for ($index = 0; $index < $count; $index++) {
        $nextDate = clone $startDate;
        if ($index > 0) {
            $nextDate->modify('+' . $index . ' month');
        }

        $stmt->execute([
            generateUuid(),
            $deviceRow['customer_id'],
            $deviceRow['id'],
            $nextDate->format('Y-m-d'),
            $amount,
            'معلق',
        ]);
    }
}

function mapUserCreateError(Throwable $e): string
{
    $msg = $e->getMessage();
    if (str_contains($msg, 'Duplicate') || str_contains($msg, '1062')) {
        return 'البريد الإلكتروني مستخدم بالفعل';
    }
    if (str_contains($msg, 'Data truncated for column') || str_contains($msg, 'role')) {
        return 'نوع الصلاحية غير مدعوم في قاعدة البيانات — حدّث جدول user_roles';
    }
    return $msg !== '' ? $msg : 'تعذر إنشاء الحساب';
}

function createUser(PDO $pdo, string $email, string $password, string $fullName, string $branchId, string $phone, array $roles): array
{
    $userId = generateUuid();
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO users (id, email, password_hash, is_active) VALUES (?, ?, ?, 1)');
        $stmt->execute([$userId, strtolower($email), $passwordHash]);

        $stmt = $pdo->prepare('INSERT INTO profiles (id, full_name, phone, branch_id) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $fullName, $phone, $branchId]);

        $stmt = $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)');
        foreach ($roles as $role) {
            $stmt->execute([generateUuid(), $userId, $role]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $user = getUserWithProfile($pdo, $userId);
    if ($user === null) {
        throw new RuntimeException('Unable to load created user.');
    }

    return $user;
}

function upsertSetting(PDO $pdo, string $key, string $value): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$key, $value]);
}

sendCorsHeaders($config);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    sendJson(200, ['ok' => true]);
}

$pdo = db($config);
$user = getCurrentUser($pdo, $config);
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . ltrim($requestPath, '/');
$segments = array_values(array_filter(explode('/', trim($path, '/'))));
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = parseJsonBody();

try {
    if ($segments === ['api', 'health']) {
        $pdo->query('SELECT 1');
        sendJson(200, ['ok' => true]);
    }

    if ($segments === ['api', 'auth', 'setup-status'] && $method === 'GET') {
        $count = (int)$pdo->query("SELECT COUNT(*) FROM user_roles WHERE role = 'admin'")->fetchColumn();
        sendJson(200, ['needsSetup' => $count === 0]);
    }

    if ($segments === ['api', 'auth', 'setup-admin'] && $method === 'POST') {
        $count = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($count > 0) {
            sendJson(400, ['error' => 'تم إعداد النظام بالفعل']);
        }

        $email = trim((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $fullName = trim((string)($body['full_name'] ?? ''));
        $branchId = (string)($body['branch_id'] ?? '1');
        if ($email === '' || $password === '' || $fullName === '') {
            sendJson(400, ['error' => 'البيانات المطلوبة غير مكتملة']);
        }

        $newUser = createUser($pdo, $email, $password, $fullName, $branchId, '', ['admin']);
        upsertSetting($pdo, 'delete_password', $password);
        $token = makeToken($newUser, $config);
        persistAuthCookie($token);
        sendJson(200, ['token' => $token, 'user' => $newUser]);
    }

    if ($segments === ['api', 'auth', 'signup'] && $method === 'POST') {
        $anyUsers = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($anyUsers > 0) {
            sendJson(403, ['error' => 'إنشاء الحساب غير متاح من الواجهة الحالية. اطلب من الأدمن إنشاء الحساب من صفحة الموظفين.']);
        }

        $email = trim((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $fullName = trim((string)($body['options']['data']['full_name'] ?? ''));
        $branchId = (string)($body['options']['data']['branch_id'] ?? '1');
        $phone = trim((string)($body['options']['data']['phone'] ?? ''));
        $role = (string)($body['options']['data']['role'] ?? 'admin');
        if (!in_array($role, $assignableRoles, true)) {
            $role = 'admin';
        }
        if ($email === '' || $password === '') {
            sendJson(400, ['error' => 'البيانات المطلوبة غير مكتملة']);
        }

        try {
            $newUser = createUser($pdo, $email, $password, $fullName, $branchId, $phone, [$role]);
        } catch (Throwable $e) {
            sendJson(400, ['error' => mapUserCreateError($e)]);
        }
        if ($role === 'admin') {
            upsertSetting($pdo, 'delete_password', $password);
        }
        $token = makeToken($newUser, $config);
        persistAuthCookie($token);
        sendJson(200, ['token' => $token, 'user' => $newUser]);
    }

    if ($segments === ['api', 'auth', 'login'] && $method === 'POST') {
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        if ($email === '' || $password === '') {
            sendJson(400, ['error' => 'البريد الإلكتروني وكلمة المرور مطلوبان']);
        }

        $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $account = $stmt->fetch();
        if (!$account || !password_verify($password, (string)$account['password_hash'])) {
            sendJson(401, ['error' => 'بيانات الدخول غير صحيحة']);
        }

        $currentUser = getUserWithProfile($pdo, (string)$account['id']);
        if ($currentUser === null) {
            sendJson(401, ['error' => 'بيانات الدخول غير صحيحة']);
        }

        $token = makeToken($currentUser, $config);
        persistAuthCookie($token);
        sendJson(200, ['token' => $token, 'user' => $currentUser]);
    }

    if ($segments === ['api', 'auth', 'me'] && $method === 'GET') {
        requireAuth($user);
        sendJson(200, ['user' => $user]);
    }

    if ($segments === ['api', 'auth', 'logout'] && $method === 'POST') {
        requireAuth($user);
        persistAuthCookie(null);
        sendJson(200, ['success' => true]);
    }

    if ($segments === ['api', 'auth', 'create-rep'] && $method === 'POST') {
        requireAdminRole($user);

        $email = trim((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $fullName = trim((string)($body['full_name'] ?? ''));
        $branchId = (string)($body['branch_id'] ?? '1');
        $phone = trim((string)($body['phone'] ?? ''));

        if ($email === '' || $password === '' || $fullName === '') {
            sendJson(400, ['error' => 'البيانات المطلوبة غير مكتملة']);
        }

        try {
            $newUser = createUser($pdo, $email, $password, $fullName, $branchId, $phone, ['sales_rep']);
        } catch (Throwable $e) {
            sendJson(400, ['error' => mapUserCreateError($e)]);
        }
        sendJson(200, ['success' => true, 'user' => $newUser]);
    }

    if ($segments === ['api', 'auth', 'create-warehouse-keeper'] && $method === 'POST') {
        requireAdminRole($user);

        $email = trim((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $fullName = trim((string)($body['full_name'] ?? ''));
        $branchId = (string)($body['branch_id'] ?? '1');
        $phone = trim((string)($body['phone'] ?? ''));

        if ($email === '' || $password === '' || $fullName === '') {
            sendJson(400, ['error' => 'البيانات المطلوبة غير مكتملة']);
        }

        try {
            $newUser = createUser($pdo, $email, $password, $fullName, $branchId, $phone, ['warehouse_keeper']);
        } catch (Throwable $e) {
            sendJson(400, ['error' => mapUserCreateError($e)]);
        }
        sendJson(200, ['success' => true, 'user' => $newUser]);
    }

    if ($segments === ['api', 'auth', 'create-customer-service'] && $method === 'POST') {
        requireAdminRole($user);

        $email = trim((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $fullName = trim((string)($body['full_name'] ?? ''));
        $branchId = (string)($body['branch_id'] ?? '1');
        $phone = trim((string)($body['phone'] ?? ''));

        if ($email === '' || $password === '' || $fullName === '') {
            sendJson(400, ['error' => 'البيانات المطلوبة غير مكتملة']);
        }

        try {
            $newUser = createUser($pdo, $email, $password, $fullName, $branchId, $phone, ['customer_service']);
        } catch (Throwable $e) {
            sendJson(400, ['error' => mapUserCreateError($e)]);
        }
        sendJson(200, ['success' => true, 'user' => $newUser]);
    }

    if ($segments === ['api', 'auth', 'change-password'] && $method === 'POST') {
        requireAuth($user);

        $currentPassword = (string)($body['currentPassword'] ?? '');
        $newPassword = (string)($body['newPassword'] ?? '');
        if ($currentPassword === '' || $newPassword === '') {
            sendJson(400, ['error' => 'كلمتا المرور مطلوبة']);
        }

        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$user['id']]);
        $hash = (string)$stmt->fetchColumn();
        if ($hash === '' || !password_verify($currentPassword, $hash)) {
            sendJson(400, ['error' => 'كلمة المرور الحالية غير صحيحة']);
        }

        $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([password_hash($newPassword, PASSWORD_BCRYPT), $user['id']]);
        sendJson(200, ['success' => true]);
    }

    if (count($segments) === 3 && $segments[0] === 'api' && $segments[1] === 'functions' && $method === 'POST') {
        requireAdminRole($user);
        $functionName = $segments[2];

        if ($functionName === 'manage-users') {
            $action = (string)($body['action'] ?? '');
            $roleMap = [
                'create_rep' => 'sales_rep',
                'create_warehouse_keeper' => 'warehouse_keeper',
                'create_customer_service' => 'customer_service',
            ];
            if (!isset($roleMap[$action])) {
                sendJson(400, ['error' => 'Invalid action']);
            }

            $email = trim((string)($body['email'] ?? ''));
            $password = (string)($body['password'] ?? '');
            $fullName = trim((string)($body['full_name'] ?? ''));
            $branchId = (string)($body['branch_id'] ?? '1');
            $phone = trim((string)($body['phone'] ?? ''));
            if ($email === '' || $password === '' || $fullName === '') {
                sendJson(400, ['error' => 'البيانات المطلوبة غير مكتملة']);
            }

            try {
                $newUser = createUser($pdo, $email, $password, $fullName, $branchId, $phone, [$roleMap[$action]]);
            } catch (Throwable $e) {
                sendJson(400, ['error' => mapUserCreateError($e)]);
            }

            sendJson(200, ['success' => true, 'user' => $newUser]);
        }

        if ($functionName === 'manage-backup') {
            $action = (string)($body['action'] ?? '');

            if ($action === 'export') {
                $tables = ['customers', 'customer_devices', 'candle_changes', 'installments', 'invoices', 'maintenance', 'products', 'work_orders', 'profiles', 'rep_locations', 'user_roles'];
                $exportData = [];
                $totalRecords = 0;

                foreach ($tables as $table) {
                    $rows = $pdo->query('SELECT * FROM `' . $table . '`')->fetchAll();
                    $parsedRows = array_map(
                        static fn(array $row): array => parseTableRow($table, $row, $GLOBALS['jsonFields'], $GLOBALS['defaultCandles']),
                        $rows
                    );
                    $exportData[$table] = $parsedRows;
                    $totalRecords += count($parsedRows);
                }

                sendJson(200, [
                    'data' => $exportData,
                    'exported_at' => gmdate('c'),
                    'exported_by' => $user['email'],
                    'total_records' => $totalRecords,
                ]);
            }

            if ($action === 'delete-all') {
                $password = (string)($body['password'] ?? '');
                if ($password === '') {
                    sendJson(400, ['error' => 'كلمة السر مطلوبة']);
                }

                $stmt = $pdo->prepare("SELECT `value` FROM system_settings WHERE `key` = 'delete_password' LIMIT 1");
                $stmt->execute();
                $savedPassword = (string)$stmt->fetchColumn();
                if ($savedPassword !== $password) {
                    sendJson(400, ['error' => 'كلمة السر غير صحيحة']);
                }

                foreach ($deleteAllOrder as $table) {
                    $pdo->exec('DELETE FROM `' . $table . '`');
                }

                sendJson(200, ['success' => true, 'message' => 'تم مسح جميع البيانات بنجاح']);
            }

            if ($action === 'change-password') {
                $password = (string)($body['password'] ?? '');
                $newPassword = (string)($body['newPassword'] ?? '');
                if ($password === '' || $newPassword === '') {
                    sendJson(400, ['error' => 'كلمة السر الحالية والجديدة مطلوبة']);
                }

                $stmt = $pdo->prepare("SELECT `value` FROM system_settings WHERE `key` = 'delete_password' LIMIT 1");
                $stmt->execute();
                $savedPassword = (string)$stmt->fetchColumn();
                if ($savedPassword !== $password) {
                    sendJson(400, ['error' => 'كلمة السر الحالية غير صحيحة']);
                }

                upsertSetting($pdo, 'delete_password', $newPassword);
                sendJson(200, ['success' => true, 'message' => 'تم تغيير كلمة السر بنجاح']);
            }

            sendJson(400, ['error' => 'Invalid action']);
        }
    }

    if (count($segments) === 4 && $segments[0] === 'api' && $segments[1] === 'query' && $method === 'POST') {
        $table = $segments[2];
        $action = $segments[3];
        if (!isset($tableRules[$table])) {
            sendJson(404, ['data' => null, 'error' => ['message' => 'جدول غير مدعوم']]);
        }

        $rule = $tableRules[$table];
        if (($rule['authRequired'] ?? false) === true) {
            requireAuth($user);
        }

        if (($rule[$action] ?? '') === 'admin') {
            requireAdminRole($user);
        }

        if ($action === 'select') {
            $columns = (string)($body['columns'] ?? '*');
            $filters = is_array($body['filters'] ?? null) ? $body['filters'] : [];
            $filters = mergeBranchScopeFilters($user, $table, $filters);
            $order = is_array($body['order'] ?? null) ? $body['order'] : null;
            $limit = (int)($body['limit'] ?? 0);
            $where = buildWhere($filters);

            if ($table === 'rep_locations' && str_contains($columns, 'profiles:user_id(full_name)')) {
                $sql = 'SELECT rep_locations.*, profiles.full_name AS profile_full_name FROM rep_locations LEFT JOIN profiles ON profiles.id = rep_locations.user_id';
            } else {
                $sql = 'SELECT * FROM `' . $table . '`';
            }

            $sql .= $where['sql'];
            if (is_array($order) && !empty($order['field'])) {
                $field = '`' . str_replace('`', '', (string)$order['field']) . '`';
                $direction = (($order['ascending'] ?? true) === false) ? 'DESC' : 'ASC';
                $sql .= ' ORDER BY ' . $field . ' ' . $direction;
            }
            if ($limit > 0) {
                $sql .= ' LIMIT ' . $limit;
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($where['params']);
            $rows = $stmt->fetchAll();

            $parsed = [];
            foreach ($rows as $row) {
                $nextRow = parseTableRow($table, $row, $jsonFields, $defaultCandles);
                if ($table === 'rep_locations' && array_key_exists('profile_full_name', $nextRow)) {
                    $nextRow['profiles'] = $nextRow['profile_full_name'] !== null ? ['full_name' => $nextRow['profile_full_name']] : null;
                    unset($nextRow['profile_full_name']);
                }
                $parsed[] = $nextRow;
            }

            sendJson(200, ['data' => $parsed, 'error' => null]);
        }

        if ($action === 'insert') {
            $rows = $body['values'] ?? [];
            if (!is_array($rows) || array_keys($rows) !== range(0, count($rows) - 1)) {
                $rows = [$rows];
            }

            if ($rows === []) {
                sendJson(400, ['data' => null, 'error' => ['message' => 'No rows provided']]);
            }

            $pdo->beginTransaction();
            try {
                $resultRows = [];
                foreach ($rows as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $row = normalizeInsertRow($table, $row, $user, $defaultCandles);
                    $row = applyBranchScopeToInsertRow($table, $row, $user);
                    validateMutation($table, $row, $user);
                    $row = stringifyTablePayload($table, $row, $jsonFields, $defaultCandles);
                    $row = oasisFilterRowToTableColumns($pdo, $table, $row);
                    $columns = array_keys($row);
                    if ($columns === []) {
                        throw new RuntimeException('No valid columns for insert');
                    }
                    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                    $sql = 'INSERT INTO `' . $table . '` (' . implode(', ', array_map(static fn(string $col): string => '`' . $col . '`', $columns)) . ') VALUES (' . $placeholders . ')';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute(array_values($row));
                    if ($table === 'customer_devices') {
                        createInstallments($pdo, $row);
                    }
                    $resultRows[] = parseTableRow($table, $row, $jsonFields, $defaultCandles);
                }
                $pdo->commit();
                sendJson(200, ['data' => $resultRows, 'error' => null]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                sendJson(400, ['data' => null, 'error' => ['message' => $e->getMessage()]]);
            }
        }

        if ($action === 'update') {
            $values = is_array($body['values'] ?? null) ? $body['values'] : [];
            $values = applyBranchScopeToUpdateValues($table, $values, $user);
            validateMutation($table, $values, $user);
            $values = stringifyTablePayload($table, $values, $jsonFields, $defaultCandles);
            $values = oasisFilterRowToTableColumns($pdo, $table, $values);
            $fields = array_keys($values);
            if ($fields === []) {
                sendJson(400, ['data' => null, 'error' => ['message' => 'No values provided']]);
            }

            $scopedFilters = mergeBranchScopeFilters($user, $table, is_array($body['filters'] ?? null) ? $body['filters'] : []);
            $where = buildWhere($scopedFilters);
            $setClause = implode(', ', array_map(static fn(string $field): string => '`' . $field . '` = ?', $fields));
            $sql = 'UPDATE `' . $table . '` SET ' . $setClause . $where['sql'];

            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_merge(array_values($values), $where['params']));

            $selectStmt = $pdo->prepare('SELECT * FROM `' . $table . '`' . $where['sql']);
            $selectStmt->execute($where['params']);
            $rows = $selectStmt->fetchAll();
            $parsedRows = array_map(
                static fn(array $row): array => parseTableRow($table, $row, $GLOBALS['jsonFields'], $GLOBALS['defaultCandles']),
                $rows
            );

            sendJson(200, ['data' => $parsedRows, 'error' => null]);
        }

        if ($action === 'delete') {
            $scopedFilters = mergeBranchScopeFilters($user, $table, is_array($body['filters'] ?? null) ? $body['filters'] : []);
            $where = buildWhere($scopedFilters);
            if ($where['sql'] === '') {
                sendJson(400, ['data' => null, 'error' => ['message' => 'Delete requires filters']]);
            }

            $stmt = $pdo->prepare('DELETE FROM `' . $table . '`' . $where['sql']);
            $stmt->execute($where['params']);
            sendJson(200, ['data' => [], 'error' => null]);
        }

        sendJson(404, ['data' => null, 'error' => ['message' => 'Action not supported']]);
    }

    if (count($segments) === 4 && $segments[0] === 'api' && $segments[1] === 'storage' && $segments[3] === 'upload' && $method === 'POST') {
        requireAuth($user);

        $bucket = preg_replace('/[^a-zA-Z0-9_-]/', '', $segments[2]);
        if ($bucket === '') {
            sendJson(400, ['data' => null, 'error' => ['message' => 'Invalid bucket']]);
        }

        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            sendJson(400, ['data' => null, 'error' => ['message' => 'No file uploaded']]);
        }

        $uploadsRoot = realpath(__DIR__ . '/../uploads');
        if ($uploadsRoot === false) {
            $uploadsRoot = __DIR__ . '/../uploads';
        }

        $bucketDir = $uploadsRoot . DIRECTORY_SEPARATOR . $bucket;
        if (!is_dir($bucketDir) && !mkdir($bucketDir, 0775, true) && !is_dir($bucketDir)) {
            sendJson(500, ['data' => null, 'error' => ['message' => 'Unable to create upload directory']]);
        }

        $requestedPath = trim((string)($_POST['path'] ?? ''));
        $extension = pathinfo($_FILES['file']['name'] ?? '', PATHINFO_EXTENSION);
        $safeName = $requestedPath !== '' ? basename($requestedPath) : generateUuid() . ($extension !== '' ? '.' . $extension : '');
        $targetPath = $bucketDir . DIRECTORY_SEPARATOR . $safeName;

        if (!move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
            sendJson(500, ['data' => null, 'error' => ['message' => 'Unable to store file']]);
        }

        $publicBaseUrl = rtrim((string)$config['public_base_url'], '/');
        $publicUrl = $publicBaseUrl . '/uploads/' . $bucket . '/' . rawurlencode($safeName);

        sendJson(200, [
            'data' => [
                'path' => $safeName,
                'fullPath' => $bucket . '/' . $safeName,
                'publicUrl' => $publicUrl,
            ],
            'error' => null,
        ]);
    }

    sendJson(404, ['error' => 'Not found']);
} catch (Throwable $e) {
    sendJson(500, ['error' => $e->getMessage()]);
}
