# نشر Oasis Suite على Hostinger

## قبل الرفع — ضبط كل شيء

1. **تحديث ملفات dist (الواجهة الجاهزة للنشر)**
   ```bash
   npm install
   npm run build
   ```
   بعدها يكون مجلد `dist/` جاهزًا للرفع (يحتوي على `index.html`، `assets/`، `app-config.js`، إلخ).

2. **ضبط عنوان الـ API للواجهة**
   - إذا كان سيرفر الـ API (Node.js) على نفس الدومين مع proxy: اترك `dist/app-config.js` كما هو:
     ```js
     window.__APP_CONFIG__ = { apiBaseUrl: "/api" };
     ```
   - إذا كان الـ API على **ساب دومين** (مثلاً api.flaater.com)، عدّل في `public_html/app-config.js` على السيرفر:
     ```js
     window.__APP_CONFIG__ = { apiBaseUrl: "https://api.flaater.com/api" };
     ```
   - للتفاصيل الكاملة (إنشاء تطبيق Node، رفع السيرفر، متغيرات البيئة): راجع **`setup/HOSTINGER-NODE-API.md`**.

3. **قاعدة البيانات**
   - نفّذ في phpMyAdmin على Hostinger:
     - `setup/mysql-schema.sql` (إنشاء الجداول).
     - `setup/mysql-migrations.sql` إن وُجدت قاعدة قديمة (تجاهل أخطاء "column exists" إن ظهرت).

4. **سيرفر Node.js على Hostinger**
   - اربط التطبيق (Node.js Application) بمجلد المشروع واختر نقطة التشغيل من مجلد `server/` (مثلاً `server/src/index.js` أو حسب إعداد Hostinger).
   - عيّن متغيرات البيئة:
     - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
     - `JWT_SECRET` (قيمة سرية قوية)
     - `CLIENT_ORIGIN` (رابط الواجهة، مثلاً `https://yourdomain.com`)

---

## رفع الواجهة (Frontend)

- ارفع **كل محتويات** مجلد `dist/` إلى الاستضافة الثابتة (مثلاً `public_html` أو المسار المخصص للويب).
- لا ترفع المجلد `dist` نفسه؛ ارفع ما بداخله فقط حتى يكون `index.html` في جذر المسار.

الملفات/المجلدات المهمة بعد البناء:
- `index.html`
- `app-config.js`
- `assets/` (ملفات JS و CSS والصور)
- إن وُجدت: `.htaccess`، `api/`، `uploads/` (حسب طريقة النشر)

---

## استمرارية البيانات والفرع

- كل فرع يرى بياناته فقط (فواتير، عملاء، صيانة، أوامر عمل، مناطق) حسب الفرع المسجل في البروفايل.

## ميزات النظام

- **المخزون**: أقسام بأيقونات + إدارة أقسام (inventory_categories).
- **التقارير**: كشف حساب عميل، حركة منتج، زيارات عميل.
- **التعديل/الحذف**: يتطلب كلمة مرور الحذف (من إعدادات النسخ الاحتياطي).
- **المناطق**: صفحة المناطق وربطها بالعملاء وأوامر العمل.
- **الصيانة**: تواريخ قادمة إضافية (متعددة)، وتواريخ الصيانة من أوامر العمل تظهر في الصيانة والزيارات.
