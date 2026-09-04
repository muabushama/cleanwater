-- حقول إضافية للمنتجات (SKU، باركود، وحدة، مورد، وصف)
-- شغّل الملف مرة واحدة على نفس قاعدة MySQL الخاصة بالـ API.
-- إذا ظهر خطأ "Duplicate column" تجاهل السطر المعني (العمود موجود مسبقاً).

ALTER TABLE products ADD COLUMN sku_code VARCHAR(64) NULL COMMENT 'كود الصنف';
ALTER TABLE products ADD COLUMN barcode VARCHAR(128) NULL COMMENT 'باركود';
ALTER TABLE products ADD COLUMN unit VARCHAR(32) NULL DEFAULT 'قطعة' COMMENT 'الوحدة';
ALTER TABLE products ADD COLUMN supplier_name VARCHAR(191) NULL COMMENT 'المورد';
ALTER TABLE products ADD COLUMN description TEXT NULL COMMENT 'وصف / ملاحظات';

-- فهارس اختيارية (تجاهل إن وُجدت):
-- CREATE INDEX idx_products_sku ON products (sku_code(32));
-- CREATE INDEX idx_products_barcode ON products (barcode(64));
