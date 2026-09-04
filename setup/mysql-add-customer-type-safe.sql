-- إضافة عمود customer_type لجدول customers إن لم يكن موجوداً (يصلح خطأ INSERT)
SET @db := DATABASE();
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'customer_type'
    ),
    'SELECT ''skip customers.customer_type''',
    "ALTER TABLE customers ADD COLUMN customer_type VARCHAR(50) NOT NULL DEFAULT 'sales'"
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
