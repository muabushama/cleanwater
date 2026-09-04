-- إنشاء جدول المحطات
CREATE TABLE IF NOT EXISTS stations (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  customer_id VARCHAR(36) DEFAULT NULL,
  customer_name VARCHAR(255) DEFAULT NULL,
  area VARCHAR(255) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  station_type VARCHAR(100) DEFAULT 'تحلية',
  capacity VARCHAR(100) DEFAULT NULL,
  install_date DATE DEFAULT NULL,
  contract_type VARCHAR(100) DEFAULT 'بدون عقد',
  contract_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  contract_duration_months INT NOT NULL DEFAULT 0,
  contract_start_date DATE DEFAULT NULL,
  contract_end_date DATE DEFAULT NULL,
  contract_first_visit_date DATE DEFAULT NULL,
  contract_installments_count INT NOT NULL DEFAULT 0,
  contract_installment_interval_months INT NOT NULL DEFAULT 1,
  contract_first_installment_date DATE DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'نشطة',
  notes TEXT DEFAULT NULL,
  branch VARCHAR(100) DEFAULT 'main',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stations_branch (branch),
  INDEX idx_stations_status (status),
  INDEX idx_stations_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS station_contract_installments (
  id VARCHAR(36) PRIMARY KEY,
  station_id VARCHAR(36) NOT NULL,
  installment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(100) NOT NULL DEFAULT 'معلق',
  collection_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_station_contract_installments_station (station_id),
  INDEX idx_station_contract_installments_date (installment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_station_maintenance_station (station_id),
  INDEX idx_station_maintenance_date (maintenance_date),
  INDEX idx_station_maintenance_branch (branch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
