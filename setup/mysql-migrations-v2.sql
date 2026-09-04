-- ============================================================
-- Oasis Suite - Phase 2: Finance, Invoices, Inventory, Integration
-- تشغيل هذا الملف بعد mysql-schema.sql و mysql-migrations.sql
-- ============================================================

-- 1) مصروفات (فواتير خارجة)
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

-- 2) بنوك وحسابات بنكية
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
  KEY idx_bank_accounts_branch (branch),
  CONSTRAINT fk_bank_accounts_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
);

-- 3) سندات قبض (ربط بالفاتورة وتحديث المدفوع)
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
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_receipt_vouchers_invoice (invoice_id),
  KEY idx_receipt_vouchers_date (voucher_date),
  KEY idx_receipt_vouchers_branch (branch),
  CONSTRAINT fk_receipt_vouchers_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

-- 4) سندات صرف (ربط بمصروف أو عام)
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
  KEY idx_payment_vouchers_branch (branch),
  CONSTRAINT fk_payment_vouchers_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
);

-- 5) بنود الفاتورة (فاتورة متعددة البنود)
CREATE TABLE IF NOT EXISTS invoice_lines (
  id VARCHAR(36) PRIMARY KEY,
  invoice_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NULL,
  product_name VARCHAR(191) NOT NULL DEFAULT '',
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invoice_lines_invoice (invoice_id),
  CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_lines_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 6) الفواتير: خصم وضريبة
ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(12,2) NULL;
ALTER TABLE invoices ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN auto_stock_deduct TINYINT(1) NOT NULL DEFAULT 1;

-- 7) مستودعات ومخزون حسب مستودع
CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_warehouses_branch (branch)
);

CREATE TABLE IF NOT EXISTS product_warehouse_stock (
  product_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, warehouse_id),
  KEY idx_pws_warehouse (warehouse_id),
  CONSTRAINT fk_pws_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pws_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- 8) حركات المخزون: مستودع + تكلفة وحدة (لمتوسط السعر)
ALTER TABLE stock_movements ADD COLUMN warehouse_id VARCHAR(36) NULL;
ALTER TABLE stock_movements ADD COLUMN unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 9) جدول تدقيق (Audit)
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(36) PRIMARY KEY,
  table_name VARCHAR(191) NOT NULL,
  record_id VARCHAR(36) NOT NULL,
  action VARCHAR(20) NOT NULL,
  user_id VARCHAR(36) NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_table_record (table_name, record_id),
  KEY idx_audit_created (created_at)
);

-- 10) مشتريات وربطها بالمخزون
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

-- 11) مرتجعات وربطها بالمخزون/الفواتير
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
