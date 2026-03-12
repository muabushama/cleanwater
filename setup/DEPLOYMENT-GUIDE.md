# دليل النشر على Hostinger مع PHP وMySQL

## نظرة عامة

النسخة الحالية تعمل بالكامل على `Hostinger` نفسه بدون `Node.js` أو `Railway`:

- الواجهة `dist/` على `Hostinger`
- الـ API داخل `public/api/` ويعمل بـ `PHP`
- قاعدة البيانات `MySQL` على `Hostinger`

## الخطوة 1: إنشاء قاعدة MySQL

1. افتح لوحة `Hostinger`
2. ادخل إلى `Databases -> MySQL Databases`
3. أنشئ قاعدة جديدة ومستخدم جديد
4. احفظ:
   - `DB name`
   - `DB user`
   - `DB password`
   - `DB host`

## الخطوة 2: تجهيز الجداول

1. افتح `phpMyAdmin`
2. اختر قاعدة البيانات الجديدة
3. افتح تبويب `SQL`
4. انسخ كل محتوى الملف `setup/mysql-schema.sql`
5. نفّذه بالكامل
6. إذا كانت قاعدة البيانات الحالية أقدم من إضافة دور خدمة العملاء، نفّذ أيضًا الملف `setup/customer-service-role-update.sql`

## الخطوة 3: تجهيز إعدادات الـ API

حدّث الملف `public/api/config.local.php` بهذه القيم:

```php
<?php

return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'YOUR_MYSQL_DATABASE',
    'db_user' => 'YOUR_MYSQL_USER',
    'db_password' => 'YOUR_MYSQL_PASSWORD',
    'jwt_secret' => 'PUT_A_LONG_RANDOM_SECRET_HERE',
    'client_origin' => 'https://YOUR_DOMAIN,https://www.YOUR_DOMAIN',
    'public_base_url' => 'https://YOUR_DOMAIN',
    'timezone' => 'UTC',
];
```

## الخطوة 4: بناء الواجهة

من جذر المشروع:

```bash
npm install
npm run build
```

## الخطوة 5: ضبط عنوان الـ API

قبل رفع الواجهة، افتح الملف `dist/app-config.js` وتأكد أنه:

```js
window.__APP_CONFIG__ = {
  apiBaseUrl: "/api",
};
```

## الخطوة 6: رفع الواجهة والـ API

1. افتح `File Manager` في `Hostinger`
2. ادخل إلى `public_html`
3. ارفع كل محتويات مجلد `dist/` وليس المجلد نفسه

الملفات المهمة:

- `index.html`
- `.htaccess`
- `app-config.js`
- `assets/`
- `api/`
- `uploads/`

## الخطوة 7: إعداد رفع الصور

الصور الآن تُرفع من خلال الـ API إلى مجلد `uploads` داخل `public_html`.

لذلك تأكد من:

1. أن مجلد `public_html/uploads` موجود
2. أن PHP لديه صلاحية كتابة داخل `uploads`

روابط الصور ستخرج تلقائيًا بناءً على `PUBLIC_BASE_URL`.

## الخطوة 8: اختبار الـ API

بعد الرفع افتح:

```text
https://YOUR_DOMAIN/api/health
```

لو ظهر:

```json
{"ok":true}
```

فكل شيء صحيح.

## الخطوة 9: أول تشغيل للنظام

إذا كانت قاعدة البيانات جديدة ولا يوجد أدمن:

1. افتح الموقع
2. ستظهر شاشة إعداد الأدمن الأول تلقائيًا
3. أدخل:
   - الاسم
   - البريد الإلكتروني
   - كلمة المرور
   - الفرع
4. بعد الحفظ سيتم تسجيل الدخول مباشرة

## الخطوة 10: الأدوار المتاحة

شاشة الدخول تدعم الآن:

- `أدمن`
- `مندوب`
- `خدمة عملاء`

توجيه كل دور:

- `أدمن`: يدخل إلى النظام الكامل
- `مندوب`: يدخل إلى صفحة المندوب وصلاحيات التوصيل
- `خدمة عملاء`: يدخل إلى لوحة خدمة العملاء وصفحات المتابعة والعمليات اليومية

## الخطوة 11: إضافة مندوبين واستخدام النظام

بعد دخول الأدمن:

1. اذهب إلى صفحة `المناديب`
2. أنشئ حسابات المندوبين من داخل التطبيق
3. ابدأ إدخال العملاء والمنتجات وأوامر الشغل

## ملاحظات مهمة

- التتبع المباشر لم يعد يعتمد على `Supabase Realtime`، وتم استبداله بتحديث دوري `polling`
- صور المنتجات لم تعد تعتمد على `Supabase Storage`
- النسخ الاحتياطي، إنشاء المندوبين، وكلمة سر حذف البيانات أصبحت عبر الـ API الجديد
- فعّل `SSL/HTTPS` للموقع
- لو غيّرت كلمة سر قاعدة البيانات، حدّث `public/api/config.local.php`
- الملف `public/api/config.local.php` يحتوي بيانات حساسة، فلا تشاركه علنًا
- لو لم يعمل تسجيل حساب خدمة العملاء على قاعدة قديمة، شغّل `setup/customer-service-role-update.sql` مرة واحدة
