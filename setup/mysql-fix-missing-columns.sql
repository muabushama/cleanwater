-- ============================================================
-- إصلاح الأعمدة الناقصة — نسخة آمنة تتجاهل الأعمدة الموجودة
-- الصق في phpMyAdmin واضغط Go
-- ============================================================

DROP PROCEDURE IF EXISTS _fix_columns;

DELIMITER $$
CREATE PROCEDURE _fix_columns()
BEGIN

  -- invoices: أعمدة أساسية
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='quantity') THEN
    ALTER TABLE invoices ADD COLUMN quantity INT NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='product_id') THEN
    ALTER TABLE invoices ADD COLUMN product_id VARCHAR(36) NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='rep_names') THEN
    ALTER TABLE invoices ADD COLUMN rep_names JSON NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='due_date') THEN
    ALTER TABLE invoices ADD COLUMN due_date DATE NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='delivery_status') THEN
    ALTER TABLE invoices ADD COLUMN delivery_status VARCHAR(50) NOT NULL DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='notes') THEN
    ALTER TABLE invoices ADD COLUMN notes TEXT NULL;
  END IF;

  -- invoices: خصم وضريبة ومخزون
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='subtotal') THEN
    ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(12,2) NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='discount_percent') THEN
    ALTER TABLE invoices ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='discount_amount') THEN
    ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='tax_percent') THEN
    ALTER TABLE invoices ADD COLUMN tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='tax_amount') THEN
    ALTER TABLE invoices ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='auto_stock_deduct') THEN
    ALTER TABLE invoices ADD COLUMN auto_stock_deduct TINYINT(1) NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='invoice_direction') THEN
    ALTER TABLE invoices ADD COLUMN invoice_direction VARCHAR(50) NOT NULL DEFAULT 'مبيعات';
  END IF;

  -- stock_movements: unit_cost
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_movements') THEN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_movements' AND COLUMN_NAME='unit_cost') THEN
      ALTER TABLE stock_movements ADD COLUMN unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0;
    END IF;
  END IF;

  -- invoices: technician
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='technician') THEN
    ALTER TABLE invoices ADD COLUMN technician VARCHAR(191) NULL;
  END IF;

  -- customers: phone2 (رقم اضافي)
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers') THEN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND COLUMN_NAME='phone2') THEN
      ALTER TABLE customers ADD COLUMN phone2 VARCHAR(50) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND COLUMN_NAME='customer_code') THEN
      ALTER TABLE customers ADD COLUMN customer_code VARCHAR(64) NULL;
    END IF;
  END IF;

  -- returns: supplier return columns
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='returns') THEN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='returns' AND COLUMN_NAME='return_type') THEN
      ALTER TABLE returns ADD COLUMN return_type VARCHAR(50) NOT NULL DEFAULT 'customer';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='returns' AND COLUMN_NAME='supplier_name') THEN
      ALTER TABLE returns ADD COLUMN supplier_name VARCHAR(191) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='returns' AND COLUMN_NAME='supplier_phone') THEN
      ALTER TABLE returns ADD COLUMN supplier_phone VARCHAR(50) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='returns' AND COLUMN_NAME='reason') THEN
      ALTER TABLE returns ADD COLUMN reason TEXT NULL;
    END IF;
  END IF;

  -- stock_movements: movement_date, storage_location
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_movements') THEN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_movements' AND COLUMN_NAME='movement_date') THEN
      ALTER TABLE stock_movements ADD COLUMN movement_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_movements' AND COLUMN_NAME='storage_location') THEN
      ALTER TABLE stock_movements ADD COLUMN storage_location VARCHAR(64) NULL;
    END IF;
  END IF;

  -- invoice_lines: total column (may use 'total' instead of 'line_total')
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoice_lines') THEN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoice_lines' AND COLUMN_NAME='total') THEN
      ALTER TABLE invoice_lines ADD COLUMN total DECIMAL(12,2) NOT NULL DEFAULT 0;
    END IF;
  END IF;

  -- stations: أعمدة إضافية
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations') THEN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='area') THEN
      ALTER TABLE stations ADD COLUMN area VARCHAR(191) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='address') THEN
      ALTER TABLE stations ADD COLUMN address TEXT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='station_type') THEN
      ALTER TABLE stations ADD COLUMN station_type VARCHAR(100) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='capacity') THEN
      ALTER TABLE stations ADD COLUMN capacity VARCHAR(191) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='install_date') THEN
      ALTER TABLE stations ADD COLUMN install_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='customer_phone') THEN
      ALTER TABLE stations ADD COLUMN customer_phone VARCHAR(50) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='customer_address') THEN
      ALTER TABLE stations ADD COLUMN customer_address TEXT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='warranty_months') THEN
      ALTER TABLE stations ADD COLUMN warranty_months INT NOT NULL DEFAULT 12;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='warranty_end') THEN
      ALTER TABLE stations ADD COLUMN warranty_end DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_type') THEN
      ALTER TABLE stations ADD COLUMN contract_type VARCHAR(100) NOT NULL DEFAULT 'بدون عقد';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_value') THEN
      ALTER TABLE stations ADD COLUMN contract_value DECIMAL(12,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_duration_months') THEN
      ALTER TABLE stations ADD COLUMN contract_duration_months INT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_start_date') THEN
      ALTER TABLE stations ADD COLUMN contract_start_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_end_date') THEN
      ALTER TABLE stations ADD COLUMN contract_end_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_first_visit_date') THEN
      ALTER TABLE stations ADD COLUMN contract_first_visit_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_installments_count') THEN
      ALTER TABLE stations ADD COLUMN contract_installments_count INT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_installment_interval_months') THEN
      ALTER TABLE stations ADD COLUMN contract_installment_interval_months INT NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND COLUMN_NAME='contract_first_installment_date') THEN
      ALTER TABLE stations ADD COLUMN contract_first_installment_date DATE NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_devices') THEN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_devices' AND COLUMN_NAME='contract_value') THEN
      ALTER TABLE customer_devices ADD COLUMN contract_value DECIMAL(12,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_devices' AND COLUMN_NAME='contract_duration_months') THEN
      ALTER TABLE customer_devices ADD COLUMN contract_duration_months INT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_devices' AND COLUMN_NAME='contract_start_date') THEN
      ALTER TABLE customer_devices ADD COLUMN contract_start_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_devices' AND COLUMN_NAME='contract_end_date') THEN
      ALTER TABLE customer_devices ADD COLUMN contract_end_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_devices' AND COLUMN_NAME='contract_first_visit_date') THEN
      ALTER TABLE customer_devices ADD COLUMN contract_first_visit_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_devices' AND COLUMN_NAME='contract_installment_interval_months') THEN
      ALTER TABLE customer_devices ADD COLUMN contract_installment_interval_months INT NOT NULL DEFAULT 1;
    END IF;
  END IF;

END$$
DELIMITER ;

CALL _fix_columns();
DROP PROCEDURE IF EXISTS _fix_columns;

-- ===== جداول جديدة (لو مش موجودة) =====

CREATE TABLE IF NOT EXISTS areas (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  parent_id VARCHAR(36) NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_areas_branch (branch),
  KEY idx_areas_parent (parent_id)
);

CREATE TABLE IF NOT EXISTS station_contract_installments (
  id VARCHAR(36) PRIMARY KEY,
  station_id VARCHAR(36) NOT NULL,
  installment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(100) NOT NULL DEFAULT 'معلق',
  collection_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_station_contract_installments_station (station_id),
  KEY idx_station_contract_installments_date (installment_date)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  type VARCHAR(50) NOT NULL DEFAULT 'sale',
  quantity INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY,
  expense_number VARCHAR(191) NOT NULL,
  category VARCHAR(191) NOT NULL DEFAULT 'عام',
  payee_name VARCHAR(191) NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  bank_account_id VARCHAR(36) NULL,
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_expenses_branch (branch),
  KEY idx_expenses_date (expense_date),
  KEY idx_expenses_category (category)
);

CREATE TABLE IF NOT EXISTS receipt_vouchers (
  id VARCHAR(36) PRIMARY KEY,
  voucher_number VARCHAR(191) NOT NULL,
  voucher_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  invoice_id VARCHAR(36) NULL,
  customer_name VARCHAR(191) NOT NULL DEFAULT '',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
  bank_account_id VARCHAR(36) NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_receipt_vouchers_invoice (invoice_id),
  KEY idx_receipt_vouchers_date (voucher_date),
  KEY idx_receipt_vouchers_branch (branch)
);

CREATE TABLE IF NOT EXISTS payment_vouchers (
  id VARCHAR(36) PRIMARY KEY,
  voucher_number VARCHAR(191) NOT NULL,
  voucher_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  expense_id VARCHAR(36) NULL,
  payee_name VARCHAR(191) NOT NULL DEFAULT '',
  bank_account_id VARCHAR(36) NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payment_vouchers_expense (expense_id),
  KEY idx_payment_vouchers_date (voucher_date),
  KEY idx_payment_vouchers_branch (branch)
);

CREATE TABLE IF NOT EXISTS banks (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_banks_branch (branch)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id VARCHAR(36) PRIMARY KEY,
  bank_id VARCHAR(36) NOT NULL,
  account_name VARCHAR(191) NOT NULL,
  account_number VARCHAR(191) NOT NULL DEFAULT '',
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bank_accounts_bank (bank_id),
  KEY idx_bank_accounts_branch (branch)
);

CREATE TABLE IF NOT EXISTS stations (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  customer_id VARCHAR(36) NULL,
  customer_name VARCHAR(191) NOT NULL DEFAULT '',
  customer_phone VARCHAR(50) NULL,
  customer_address TEXT NULL,
  area VARCHAR(191) NULL,
  address TEXT NULL,
  station_type VARCHAR(100) NULL,
  capacity VARCHAR(191) NULL,
  install_date DATE NULL,
  warranty_months INT NOT NULL DEFAULT 12,
  warranty_end DATE NULL,
  location TEXT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stations_branch (branch)
);

CREATE TABLE IF NOT EXISTS station_maintenance (
  id VARCHAR(36) PRIMARY KEY,
  station_id VARCHAR(36) NOT NULL,
  maintenance_date DATE NOT NULL,
  maintenance_type VARCHAR(100) NOT NULL DEFAULT 'صيانة دورية',
  description TEXT NULL,
  parts_used TEXT NULL,
  parts_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_sale DECIMAL(12,2) NOT NULL DEFAULT 0,
  collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  product_lines JSON NULL,
  changed_candles JSON NULL,
  technician VARCHAR(191) NULL,
  notes TEXT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_station_maint_station (station_id),
  KEY idx_station_maint_date (maintenance_date),
  KEY idx_station_maint_branch (branch)
);

ALTER TABLE station_maintenance ADD COLUMN IF NOT EXISTS total_sale DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE station_maintenance ADD COLUMN IF NOT EXISTS product_lines JSON NULL;
ALTER TABLE station_maintenance ADD COLUMN IF NOT EXISTS changed_candles JSON NULL;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id VARCHAR(36) PRIMARY KEY,
  invoice_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invoice_lines_invoice (invoice_id)
);

CREATE TABLE IF NOT EXISTS candle_types (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  duration_months INT NOT NULL DEFAULT 3,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_candle_types_branch (branch)
);

CREATE TABLE IF NOT EXISTS rep_inventory (
  id VARCHAR(36) PRIMARY KEY,
  rep_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rep_inventory_rep (rep_id),
  KEY idx_rep_inventory_product (product_id),
  KEY idx_rep_inventory_branch (branch)
);

CREATE TABLE IF NOT EXISTS rep_inventory_transfers (
  id VARCHAR(36) PRIMARY KEY,
  from_type VARCHAR(50) NOT NULL DEFAULT 'main',
  to_rep_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rep_transfers_rep (to_rep_id),
  KEY idx_rep_transfers_product (product_id)
);
