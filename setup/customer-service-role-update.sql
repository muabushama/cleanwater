ALTER TABLE user_roles
MODIFY COLUMN role ENUM('admin', 'sales_rep', 'customer_service') NOT NULL;
