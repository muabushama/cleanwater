# Oasis Suite

تطبيق `React + Vite + TypeScript` في الواجهة مع `PHP + MySQL` في الخلفية، مناسب للنشر المباشر على `Hostinger`.

## هيكل المشروع

- `src/`: الواجهة الأمامية
- `public/api/`: API جديد يعمل بـ `PHP`
- `setup/mysql-schema.sql`: مخطط قاعدة البيانات على `MySQL`
- `public/app-config.js`: إعداد عنوان الـ API وقت التشغيل

## التشغيل المحلي

1. ثبّت اعتماديات الواجهة:

```bash
npm install
```

2. أنشئ قاعدة `MySQL` ونفّذ الملف `setup/mysql-schema.sql`.

3. حدّث ملف `public/api/config.local.php` ببيانات قاعدة البيانات.

4. أنشئ `.env` من `.env.example` إذا كنت تريد عنوان API مختلفًا في التطوير.

5. شغّل الواجهة:

```bash
npm run dev
```

## الإعدادات

### الواجهة

ملف `.env.example` للواجهة:

```env
VITE_API_BASE_URL="http://localhost:3001/api"
```

يمكنك أيضًا التحكم بعنوان الـ API بعد البناء من خلال `public/app-config.js` أو `dist/app-config.js`:

```js
window.__APP_CONFIG__ = {
  apiBaseUrl: "/api",
};
```

### الخادم

ملف `public/api/config.example.php`:

```php
<?php

return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'your_database_name',
    'db_user' => 'your_database_user',
    'db_password' => 'your_database_password',
    'jwt_secret' => 'change-this-secret',
    'client_origin' => 'https://your-domain.com,https://www.your-domain.com',
    'public_base_url' => 'https://your-domain.com',
    'timezone' => 'UTC',
];
```

الملف الفعلي المستخدم في النشر هو `public/api/config.local.php`.

## أول تشغيل

إذا لم يكن هناك أي أدمن في قاعدة البيانات، ستظهر شاشة إعداد أول أدمن تلقائيًا داخل صفحة الدخول. بعد إنشائه، سيتم تخزين كلمة المرور نفسها أيضًا ككلمة سر افتراضية لميزة `حذف جميع البيانات` حتى تغيّرها من داخل التطبيق.

## الأدوار المتاحة

- `admin`: وصول كامل للنظام
- `sales_rep`: دخول مباشر إلى صفحة المندوب وصلاحيات التوصيل
- `customer_service`: لوحة خدمة العملاء وصفحات المتابعة والعملاء والفواتير والصيانة وأوامر العمل والزيارات

إذا كانت قاعدة البيانات أنشئت قبل إضافة دور `customer_service`، شغّل الملف `setup/customer-service-role-update.sql` مرة واحدة داخل `phpMyAdmin`.

## النشر على Hostinger

راجع الملف `setup/DEPLOYMENT-GUIDE.md` للحصول على خطوات النشر الكاملة للواجهة والـ API و`MySQL` على `Hostinger`.
