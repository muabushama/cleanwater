# إعداد قاعدة البيانات وسيرفر Node.js - خطوة بخطوة

## الجزء 1: إنشاء قاعدة بيانات MySQL

### إذا كان عندك MySQL على جهازك (XAMPP / WAMP / MySQL Server):

1. افتح **phpMyAdmin** أو **MySQL Command Line** أو أي برنامج يتصل بـ MySQL.

2. **أنشئ قاعدة بيانات جديدة:**
   ```sql
   CREATE DATABASE oasis_suite CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **شغّل ملف الجداول الكامل (للمشروع من الصفر):**
   - من phpMyAdmin: اختر قاعدة البيانات `oasis_suite` ثم تبويب **استيراد (Import)** واختر الملف:
     ```
     setup/mysql-schema.sql
     ```
   - أو من سطر الأوامر (Command Line):
     ```bash
     mysql -u root -p oasis_suite < setup/mysql-schema.sql
     ```
     (غيّر `root` و`-p` حسب اسم المستخدم وكلمة المرور عندك)

بعد تشغيل `mysql-schema.sql` ستكون عندك كل الجداول والحقول المطلوبة، منها:
- `areas`
- `stock_movements`
- `inventory_categories`
- تحديثات على `invoices` (quantity, product_id, rep_names)
- تحديثات على `customers` (area_id)
- تحديثات على `work_orders` (area_id)
- تحديثات على `maintenance` (next_dates)
- وتحديثات على `candle_changes` (candle8, candle9, candle10) وغيرها.

---

### إذا كانت عندك قاعدة بيانات قديمة (كانت شغالة قبل التحديث):

1. **لا تشغّل `mysql-schema.sql` من أول لآخر** عشان ما يحصلش تعارض (جداول موجودة).

2. شغّل فقط ملف **التحديثات**:
   ```
   setup/mysql-migrations.sql
   ```
   - من phpMyAdmin: اختر قاعدة البيانات ثم **استيراد** واختر `mysql-migrations.sql`.
   - أو من سطر الأوامر:
     ```bash
     mysql -u root -p oasis_suite < setup/mysql-migrations.sql
     ```

3. **مهم:** إذا ظهرت رسالة خطأ مثل "Duplicate column name" معناه العمود موجود فعلاً؛ تخطى السطر اللي سبب الخطأ واستمر. لو حابب تتأكد، شغّل كل أمر `ALTER TABLE` و `CREATE TABLE` في الملف واحد واحد وتجاهل أي خطأ "column/table already exists".

---

## الجزء 2: ربط السيرفر (Node.js) بقاعدة MySQL

1. ادخل مجلد السيرفر:
   ```bash
   cd server
   ```

2. **أنشئ أو عدّل ملف `.env`** داخل مجلد `server` (بجانب `package.json`) بالمحتوى التالي، وعدّل القيم حسب إعدادات MySQL عندك:

   ```env
   PORT=3001
   NODE_ENV=development

   # قاعدة البيانات - غيّر القيم حسب السيرفر عندك
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=كلمة_مرور_MySQL
   MYSQL_DATABASE=oasis_suite

   # للواجهة الأمامية (الموقع)
   CLIENT_ORIGIN=http://localhost:8080

   # كلمة سر لتوقيع الجلسات (غيّرها في الإنتاج)
   JWT_SECRET=غيّر-هذه-القيمة-لقيمة-سرية-طويلة
   ```

   - **على Hostinger:** استخدم بيانات MySQL اللي يعطيك إياها (Host, User, Password, Database) وضَعها في `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.
   - **CLIENT_ORIGIN:** عنوان موقع الواجهة (مثلاً `https://yourdomain.com` على الاستضافة).

3. تثبيت الحزم (لو لسه ما عملتش):
   ```bash
   npm install
   ```

4. تشغيل السيرفر:
   - للتطوير (مع إعادة التشغيل تلقائي عند التعديل):
     ```bash
     npm run dev
     ```
   - للإنتاج (مثلاً على السيرفر):
     ```bash
     npm start
     ```

إذا السيرفر شغال بدون أخطاء، فهو مربوط بقاعدة MySQL. أي خطأ "ECONNREFUSED" أو "Access denied" معناه إما MySQL مش شغال أو بيانات `.env` (Host, User, Password, Database) غلط.

---

## الجزء 3: التأكد من الجداول والحقول

بعد تشغيل `mysql-schema.sql` (أو `mysql-migrations.sql` للقواعد القديمة) تأكد من التالي:

| المطلوب | كيف تتأكد |
|--------|------------|
| جدول `areas` | `SHOW TABLES LIKE 'areas';` أو من phpMyAdmin تشوف جدول باسم `areas`. |
| جدول `stock_movements` | `SHOW TABLES LIKE 'stock_movements';` |
| جدول `inventory_categories` | `SHOW TABLES LIKE 'inventory_categories';` |
| في `invoices`: quantity, product_id, rep_names | `DESCRIBE invoices;` وتشوف الأعمدة. |
| في `customers`: area_id | `DESCRIBE customers;` |
| في `work_orders`: area_id | `DESCRIBE work_orders;` |
| في `maintenance`: next_dates | `DESCRIBE maintenance;` |

إذا كل دي موجودة، يبقى المخطط مطابق للمخطط الحالي والجداول جاهزة للاستخدام.

---

## ملخص سريع

| الخطوة | الأمر / الإجراء |
|--------|------------------|
| 1 | إنشاء قاعدة بيانات `oasis_suite`. |
| 2 | استيراد `setup/mysql-schema.sql` (مشروع جديد) أو `setup/mysql-migrations.sql` (قاعدة قديمة). |
| 3 | إنشاء/تعديل `server/.env` ببيانات MySQL و CLIENT_ORIGIN و JWT_SECRET. |
| 4 | من مجلد `server`: `npm install` ثم `npm run dev` أو `npm start`. |

بعد كده الواجهة الأمامية (من مجلد `dist` أو بـ `npm run dev` من المجلد الرئيسي) تتصل بالسيرفر على `http://localhost:3001` (أو على البورت اللي حاططه في `PORT` داخل `.env`).
