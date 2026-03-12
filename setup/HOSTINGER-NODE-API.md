# تشغيل الـ API (Node.js) على Hostinger وحل 404

الخطأ **404** على `/api/query/...` و `/api/auth/...` معناه إن طلبات الواجهة بتوصل للسيرفر لكن **مفيش تطبيق Node شغال يرد على مسار `/api`**. الاستضافة بتخدم الموقع الثابت (الواجهة) فقط.

الحل: إنشاء تطبيق **Node.js** على Hostinger وربطه بالدومين (أو ساب دومين) ثم جعل الواجهة تتصل به.

---

## الطريقة 1: استخدام ساب دومين للـ API (مُفضّل على Hostinger)

### الخطوة 1: إنشاء تطبيق Node.js

1. ادخل **لوحة تحكم Hostinger** → **Advanced** → **Node.js** (أو **Node.js Applications**).
2. اضغط **Create Application** أو **Add Node.js App**.
3. املأ:
   - **Application name:** مثلاً `oasis-api`
   - **Node version:** 18 أو 20
   - **Application root:** المسار اللي هترفع فيه مجلد السيرفر، مثلاً `oasis-api` أو `api` (المسار الكامل يظهر في Hostinger، غالباً داخل `domains/flaater.com/` أو `public_html/../`)
   - **Application startup file:** `src/index.js` (نسبة لـ Application root، يعني المسار النهائي يكون مثل `.../oasis-api/src/index.js`)
   - **Application URL:** اختر إنشاء ساب دومين، مثلاً **`api.flaater.com`** (لو الدومين الرئيسي هو flaater.com).

4. احفظ/أنشئ التطبيق.

### الخطوة 2: رفع ملفات السيرفر

1. من جهازك، المجلد اللي فيه **السيرفر** هو: `server/` (فيه `package.json`, `src/`, …).
2. من **File Manager** في Hostinger ادخل إلى **Application root** اللي حددته (مثلاً `oasis-api`).
3. ارفع كل محتويات مجلد `server/` **داخل** هذا المجلد بحيث يصير عندك:
   - `oasis-api/package.json`
   - `oasis-api/src/index.js`
   - `oasis-api/src/config.js`
   - `oasis-api/src/schema.js`
   - `oasis-api/src/routes/query.js`
   - … إلخ.
4. في نفس المجلد (Application root) نفّذ من Hostinger **Terminal** أو من أوامر التشغيل:
   ```bash
   npm install
   ```
   (أو من واجهة Hostinger إن وُجدت خيار "Run npm install".)

### الخطوة 3: متغيرات البيئة (Environment Variables)

في إعدادات تطبيق Node.js على Hostinger اضبط:

| المتغير | القيمة (مثال) |
|--------|----------------|
| `MYSQL_HOST` | عنوان MySQL (غالباً `localhost` أو كما في Hostinger) |
| `MYSQL_USER` | اسم مستخدم قاعدة البيانات |
| `MYSQL_PASSWORD` | كلمة مرور القاعدة |
| `MYSQL_DATABASE` | اسم قاعدة البيانات |
| `JWT_SECRET` | سلسلة عشوائية قوية |
| `CLIENT_ORIGIN` | `https://flaater.com` |
| `PORT` | اتركه فارغ أو ضعه كما يطلبه Hostinger (غالباً يتعيّن تلقائياً) |

احفظ ثم **أعد تشغيل** التطبيق (Restart).

### الخطوة 4: ربط الواجهة بالـ API

بما إن الـ API هيكون على **`https://api.flaater.com`** والسيرفر يقدّم المسارات تحت `/api`، إذن الرابط الكامل لطلبات الواجهة يكون: **`https://api.flaater.com/api/...`**

عدّل ملف **`app-config.js`** في `public_html` على السيرفر (أو في المشروع ثم أعد البناء وارفع الـ dist) ليكون:

```js
window.__APP_CONFIG__ = {
  apiBaseUrl: "https://api.flaater.com/api",
};
```

احفظ الملف ثم حدّث الموقع (Ctrl+F5) وجرّب إضافة منطقة أو قسم مخزون.

### الخطوة 5: التأكد أن الـ API شغال

افتح في المتصفح:

- **https://api.flaater.com/api/health**

المفروض يرجع: `{"ok":true}`. لو رجع خطأ أو 404، راجع:
- إن التطبيق Node **Running** من لوحة Hostinger.
- إن **Application startup file** مضبوط على `src/index.js` نسبة لـ Application root.
- إنك رفعت ملفات السيرفر في المسار الصحيح ونفذت `npm install`.

---

## الطريقة 2: نفس الدومين مع Proxy (إن وُجد على خطتك)

بعض خطط Hostinger تدعم **إعادة توجيه (Proxy)** مسار معيّن إلى تطبيق Node. في هذه الحالة:

- تطبيق Node يعمل على بورت داخلي (مثلاً 3001).
- تُضبط إعادة التوجيه بحيث: `https://flaater.com/api/*` → `http://localhost:3001/api/*`.

لو خطتك تدعم ذلك، من لوحة Hostinger ابحث عن:
- **Proxy** أو **Reverse proxy** أو **Redirects** لربط `/api` بتطبيق Node.

بعدها اترك في `app-config.js`:

```js
window.__APP_CONFIG__ = { apiBaseUrl: "/api" };
```

---

## ملخص سريع (للساب دومين)

1. إنشاء Node.js Application وربطها بـ **api.flaater.com**.
2. رفع محتويات مجلد **server/** إلى Application root وتشغيل **npm install**.
3. ضبط **Environment Variables** (MySQL و JWT و CLIENT_ORIGIN).
4. **Restart** التطبيق.
5. تعديل **app-config.js** إلى: `apiBaseUrl: "https://api.flaater.com/api"`.
6. فتح **https://api.flaater.com/api/health** للتأكد ثم تجربة الواجهة.

بعد ذلك طلبات `/api/query/inventory_categories/select` و `/api/query/areas/select` و `/api/auth/verify-delete-password` هتطلع من الـ 404 وتشتغل لو التطبيق والبيانات مضبوطين.
