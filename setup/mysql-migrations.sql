-- Migration: Add fields and tables for Oasis Suite enhancements
-- Run once after main schema. If a column already exists, skip that statement or run the block that applies.

-- Invoices: quantity, product_id for stock deduction; rep_names for multiple reps
ALTER TABLE invoices ADD COLUMN quantity INT NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN product_id VARCHAR(36) NULL;
ALTER TABLE invoices ADD COLUMN rep_names JSON NULL;
ALTER TABLE invoices ADD KEY idx_invoices_product (product_id);
ALTER TABLE invoices ADD KEY idx_invoices_date (date);
-- If KEY already exists, ignore error

-- Candle_changes: 3 more candles (8,9,10)
ALTER TABLE candle_changes ADD COLUMN candle8 TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE candle_changes ADD COLUMN candle9 TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE candle_changes ADD COLUMN candle10 TINYINT(1) NOT NULL DEFAULT 0;

-- Areas: main and sub areas per branch
CREATE TABLE IF NOT EXISTS areas (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  parent_id VARCHAR(36) NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_areas_branch (branch),
  KEY idx_areas_parent (parent_id)
);

-- Maintenance: multiple next dates (JSON array of date strings)
ALTER TABLE maintenance ADD COLUMN next_dates JSON NULL;

-- Customers: area_id for region/area
ALTER TABLE customers ADD COLUMN area_id VARCHAR(36) NULL;
ALTER TABLE customers ADD KEY idx_customers_phone1 (phone1);

-- Work_orders: area_id
ALTER TABLE work_orders ADD COLUMN area_id VARCHAR(36) NULL;

-- Products: branch so each branch has its own stock
ALTER TABLE products ADD COLUMN branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية';
ALTER TABLE products ADD KEY idx_products_branch (branch);
ALTER TABLE products ADD KEY idx_products_category (category);

-- Stock movements for كشف حركة منتج
CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  branch VARCHAR(191) NOT NULL DEFAULT 'فرع الإسكندرية',
  type VARCHAR(50) NOT NULL DEFAULT 'sale',
  quantity INT NOT NULL DEFAULT 0,
  reference_type VARCHAR(50) NULL,
  reference_id VARCHAR(36) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stock_movements_product (product_id),
  KEY idx_stock_movements_branch (branch),
  KEY idx_stock_movements_created (created_at)
);

-- Inventory categories (icons)
CREATE TABLE IF NOT EXISTS inventory_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  icon_key VARCHAR(50) NOT NULL DEFAULT 'default',
  parent_id VARCHAR(36) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inv_cat_parent (parent_id)
);
