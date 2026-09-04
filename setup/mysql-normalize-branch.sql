-- تطبيع عمود branch بعد ترقيات أو استيراد من بيئات أخرى.
-- السبب الشائع لاختفاء «العملاء / المناطق / الفواتير» من الشاشة: قيمة branch في DB لا تطابق الاسم العربي المعروض في التطبيق (مثل main، فارغ، أو إملاء مختلف).
-- شغّل هذا الملف مرة على قاعدة MySQL الاحتياطي أولاً ثم الإنتاج.

-- فرع الإسكندرية (القيمة الافتراضية التاريخية)
UPDATE customers SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default', 'alex', 'alexandria');
UPDATE areas SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE products SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE invoices SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE customer_devices SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE maintenance SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE work_orders SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE stock_movements SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE purchases SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE returns SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE expenses SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE receipt_vouchers SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE payment_vouchers SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE banks SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
UPDATE bank_accounts SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');

-- stations (إن وجد الجدول)
UPDATE stations SET branch = 'فرع الإسكندرية' WHERE branch IS NULL OR TRIM(branch) = '' OR LOWER(TRIM(branch)) IN ('main', 'default');
