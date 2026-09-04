CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(191) NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  avatar_url TEXT NULL,
  branch_id VARCHAR(50) NOT NULL DEFAULT '1',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('admin', 'sales_rep', 'customer_service', 'warehouse_keeper', 'staff') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_roles_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id VARCHAR(36) NOT NULL,
  permission_key VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_key),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  phone1 VARCHAR(50) NOT NULL DEFAULT '',
  phone2 VARCHAR(50) NOT NULL DEFAULT '',
  whatsapp VARCHAR(50) NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  region VARCHAR(191) NOT NULL DEFAULT '',
  area_id VARCHAR(36) NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  customer_type VARCHAR(50) NOT NULL DEFAULT 'sales',
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customers_branch (branch),
  KEY idx_customers_name (name),
  KEY idx_customers_phone1 (phone1),
  KEY idx_customers_customer_type (customer_type),
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  category VARCHAR(191) NOT NULL DEFAULT 'فلاتر مياه',
  classification VARCHAR(191) NOT NULL DEFAULT 'منزلي',
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  price1 DECIMAL(12,2) NOT NULL DEFAULT 0,
  price2 DECIMAL(12,2) NOT NULL DEFAULT 0,
  price3 DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 5,
  warranty INT NOT NULL DEFAULT 12,
  image TEXT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  storage_location VARCHAR(191) NOT NULL DEFAULT 'المخزن الرئيسي',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_products_name (name),
  KEY idx_products_branch (branch),
  KEY idx_products_category (category)
);

CREATE TABLE IF NOT EXISTS customer_devices (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  device_type VARCHAR(191) NOT NULL DEFAULT '',
  serial_number VARCHAR(191) NOT NULL DEFAULT '',
  customer_code VARCHAR(191) NOT NULL DEFAULT '',
  install_date DATE NULL,
  contract_type VARCHAR(100) NOT NULL DEFAULT 'كاش',
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  contract_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  contract_duration_months INT NOT NULL DEFAULT 0,
  contract_start_date DATE NULL,
  contract_end_date DATE NULL,
  contract_first_visit_date DATE NULL,
  contract_installment_interval_months INT NOT NULL DEFAULT 1,
  installments_count INT NOT NULL DEFAULT 0,
  installment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  first_installment_date DATE NULL,
  warranty_months INT NOT NULL DEFAULT 12,
  warranty_status VARCHAR(100) NOT NULL DEFAULT 'ساري',
  ad_source VARCHAR(191) NOT NULL DEFAULT '',
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  notes TEXT NULL,
  candles JSON NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer_devices_customer (customer_id),
  KEY idx_customer_devices_branch (branch),
  CONSTRAINT fk_customer_devices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_devices_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS candle_changes (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  change_date DATE NOT NULL,
  candle1 TINYINT(1) NOT NULL DEFAULT 0,
  candle2 TINYINT(1) NOT NULL DEFAULT 0,
  candle3 TINYINT(1) NOT NULL DEFAULT 0,
  candle4 TINYINT(1) NOT NULL DEFAULT 0,
  candle5 TINYINT(1) NOT NULL DEFAULT 0,
  candle6 TINYINT(1) NOT NULL DEFAULT 0,
  candle7 TINYINT(1) NOT NULL DEFAULT 0,
  candle8 TINYINT(1) NOT NULL DEFAULT 0,
  candle9 TINYINT(1) NOT NULL DEFAULT 0,
  candle10 TINYINT(1) NOT NULL DEFAULT 0,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(100) NOT NULL DEFAULT 'تمت',
  technician VARCHAR(191) NOT NULL DEFAULT '',
  tds_reading VARCHAR(191) NOT NULL DEFAULT '',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_candle_changes_device (device_id),
  CONSTRAINT fk_candle_changes_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_candle_changes_device FOREIGN KEY (device_id) REFERENCES customer_devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS installments (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  installment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(100) NOT NULL DEFAULT 'معلق',
  collection_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_installments_device (device_id),
  KEY idx_installments_date (installment_date),
  CONSTRAINT fk_installments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_installments_device FOREIGN KEY (device_id) REFERENCES customer_devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  invoice_number VARCHAR(191) NOT NULL,
  customer_name VARCHAR(191) NOT NULL,
  customer_id VARCHAR(36) NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  product_id VARCHAR(36) NULL,
  quantity INT NOT NULL DEFAULT 1,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(100) NOT NULL DEFAULT 'pending',
  type VARCHAR(100) NOT NULL DEFAULT 'cash',
  date DATE NOT NULL,
  rep_name VARCHAR(191) NOT NULL DEFAULT '',
  rep_names JSON NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  due_date DATE NULL,
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  subtotal DECIMAL(12,2) NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  auto_stock_deduct TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invoices_branch (branch),
  KEY idx_invoices_customer (customer_name),
  KEY idx_invoices_date (date),
  KEY idx_invoices_product (product_id),
  KEY idx_invoices_due_date (due_date),
  KEY idx_invoices_delivery_status (delivery_status),
  KEY idx_invoices_status (status),
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoices_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance (
  id VARCHAR(36) PRIMARY KEY,
  customer_name VARCHAR(191) NOT NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  type VARCHAR(191) NOT NULL DEFAULT 'تغيير شمعات',
  next_date DATE NOT NULL,
  next_dates JSON NULL,
  status VARCHAR(100) NOT NULL DEFAULT 'upcoming',
  technician VARCHAR(191) NOT NULL DEFAULT '',
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_maintenance_branch (branch),
  KEY idx_maintenance_date (next_date),
  CONSTRAINT fk_maintenance_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_orders (
  id VARCHAR(36) PRIMARY KEY,
  order_code VARCHAR(191) NOT NULL,
  customer_name VARCHAR(191) NOT NULL,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  region VARCHAR(191) NOT NULL DEFAULT '',
  area_id VARCHAR(36) NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  status VARCHAR(100) NOT NULL DEFAULT 'pending',
  delivery_status VARCHAR(100) NOT NULL DEFAULT 'pending',
  visit_date VARCHAR(100) NOT NULL DEFAULT '',
  visit_time VARCHAR(100) NOT NULL DEFAULT '',
  install_date VARCHAR(100) NOT NULL DEFAULT '',
  warranty_status VARCHAR(100) NOT NULL DEFAULT 'ساري',
  warranty_until VARCHAR(100) NOT NULL DEFAULT '',
  technician VARCHAR(191) NOT NULL DEFAULT '',
  assigned_rep VARCHAR(36) NULL,
  customer_code VARCHAR(191) NOT NULL DEFAULT '',
  customer_id_num INT NOT NULL DEFAULT 0,
  location_url TEXT NULL,
  notes TEXT NULL,
  items JSON NULL,
  previous_visits JSON NULL,
  price1 DECIMAL(12,2) NOT NULL DEFAULT 0,
  price2 DECIMAL(12,2) NOT NULL DEFAULT 0,
  price3 DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  transport_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_work_orders_branch (branch),
  KEY idx_work_orders_assigned_rep (assigned_rep),
  CONSTRAINT fk_work_orders_assigned_rep FOREIGN KEY (assigned_rep) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_work_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rep_locations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  latitude DOUBLE NOT NULL,
  longitude DOUBLE NOT NULL,
  accuracy DOUBLE NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rep_locations_user_time (user_id, recorded_at),
  CONSTRAINT fk_rep_locations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS areas (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  parent_id VARCHAR(36) NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_areas_branch (branch),
  KEY idx_areas_parent (parent_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  type VARCHAR(50) NOT NULL DEFAULT 'sale',
  quantity INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  movement_date DATE NULL,
  warehouse_id VARCHAR(36) NULL,
  technician_user_id VARCHAR(36) NULL,
  reference_type VARCHAR(50) NULL,
  reference_id VARCHAR(36) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stock_movements_product (product_id),
  KEY idx_stock_movements_branch (branch),
  KEY idx_stock_movements_created (created_at)
);

CREATE TABLE IF NOT EXISTS inventory_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  icon_key VARCHAR(50) NOT NULL DEFAULT 'default',
  parent_id VARCHAR(36) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inv_cat_parent (parent_id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id VARCHAR(36) PRIMARY KEY,
  purchase_number VARCHAR(191) NOT NULL,
  supplier_name VARCHAR(191) NOT NULL DEFAULT '',
  product_id VARCHAR(36) NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  invoice_file_url TEXT NULL,
  rep_name VARCHAR(191) NULL,
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_purchases_branch (branch),
  KEY idx_purchases_date (purchase_date),
  KEY idx_purchases_product (product_id)
);

CREATE TABLE IF NOT EXISTS returns (
  id VARCHAR(36) PRIMARY KEY,
  return_number VARCHAR(191) NOT NULL,
  invoice_id VARCHAR(36) NULL,
  customer_name VARCHAR(191) NOT NULL DEFAULT '',
  product_id VARCHAR(36) NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  quantity INT NOT NULL DEFAULT 1,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  return_date DATE NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  rep_name VARCHAR(191) NULL,
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_returns_branch (branch),
  KEY idx_returns_date (return_date),
  KEY idx_returns_product (product_id),
  KEY idx_returns_invoice (invoice_id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  `key` VARCHAR(191) PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO system_settings (`key`, `value`)
VALUES ('delete_password', 'change_me')
ON DUPLICATE KEY UPDATE `value` = `value`;
