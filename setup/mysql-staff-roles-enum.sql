-- Ensure all staff roles are allowed when creating accounts
ALTER TABLE user_roles
MODIFY COLUMN role ENUM('admin', 'sales_rep', 'customer_service', 'warehouse_keeper', 'staff') NOT NULL;
