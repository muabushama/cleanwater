import { companyInfo } from '@/data/demo-data';
import { PRINT_INK_CSS } from '@/lib/printInk';

export function formatWorkOrderPrintPrice(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0 EGP';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} EGP`;
}

const escapeHtml = (s: string) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function printAssetUrl(asset: string) {
  const u = String(asset || '');
  if (!u) return u;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  if (u.startsWith('/')) return `${window.location.origin}${u}`;
  return u;
}

export function printHtmlDocument(html: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const done = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => iframe.remove(), 2000);
  };

  const imgs = Array.from(doc.images || []);
  if (imgs.length === 0) {
    setTimeout(done, 450);
  } else {
    let pending = imgs.length;
    const tick = () => {
      pending -= 1;
      if (pending <= 0) setTimeout(done, 250);
    };
    imgs.forEach((img) => {
      if (img.complete) tick();
      else {
        img.addEventListener('load', tick);
        img.addEventListener('error', tick);
      }
    });
  }
  setTimeout(done, 2200);
}

type PrintItem = { description?: string; value?: number | string; product_name?: string; qty?: number; unit_price?: number };

function normalizeItems(raw: unknown): PrintItem[] {
  if (Array.isArray(raw)) return raw as PrintItem[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function buildWorkOrderPrintHtml(opts: {
  orderCodeLabel: string;
  customerName: string;
  phones: string;
  visitDate: string;
  address: string;
  region: string;
  technician: string;
  warrantyLabel: string;
  locationUrl: string;
  notes: string;
  items: PrintItem[] | unknown;
  transportCost: number;
  total: number;
  logoSrc: string;
}): string {
  const items = normalizeItems(opts.items);
  const tableRows = items
    .map((item) => {
      const rawDesc = String(item.description || item.product_name || '').trim();
      const isProduct = /^المنتج\s*:/i.test(rawDesc);
      const value = Number(item.value) || Number(item.unit_price) || 0;
      if (isProduct && value <= 0) return '';
      const desc = isProduct ? '—' : (rawDesc || '—');
      return `<tr><td class="c1">${escapeHtml(desc)}</td><td class="c2" dir="ltr">${escapeHtml(formatWorkOrderPrintPrice(value))}</td></tr>`;
    })
    .filter(Boolean)
    .join('');
  const transportCost = Number(opts.transportCost) || 0;
  const sheet = `
      <div class="work-form">
        <div class="head">
          <div class="logo-wrap">
            <img src="${escapeHtml(opts.logoSrc)}" alt="logo" />
            <div class="small">
              <div class="brand">كلين ووتر</div>
              <div>لتكنولوجيا معالجة مياه الشرب</div>
              <div>خدمة العملاء: ${escapeHtml(companyInfo.customerService.join(' - '))}</div>
            </div>
          </div>
          <div class="title-wrap">
            <div class="title">أمر شغل</div>
            <div class="code">الكود: ${escapeHtml(opts.orderCodeLabel || '-')}</div>
          </div>
        </div>
        <table class="meta"><tbody>
          <tr><td><b>اسم العميل:</b> ${escapeHtml(opts.customerName || '-')}</td><td class="phone-cell" dir="ltr"><b>التليفون:</b> ${escapeHtml(opts.phones || '-')}</td><td><b>التاريخ:</b> ${escapeHtml(opts.visitDate || '-')}</td></tr>
          <tr><td><b>العنوان:</b> ${escapeHtml(opts.address || '-')}</td><td><b>المنطقة:</b> ${escapeHtml(opts.region || '-')}</td><td><b>الفني:</b> ${escapeHtml(opts.technician || '-')}</td></tr>
          <tr><td><b>حالة الضمان:</b> ${escapeHtml(opts.warrantyLabel || '-')}</td><td><b>لينك الموقع:</b> ${escapeHtml(opts.locationUrl || '-')}</td><td></td></tr>
        </tbody></table>
        <table class="items"><thead><tr><th>البيان</th><th>القيمة</th></tr></thead><tbody>
          ${tableRows}
          ${transportCost > 0 ? `<tr><td class="c1"><b>مواصلات</b></td><td class="c2" dir="ltr">${escapeHtml(formatWorkOrderPrintPrice(transportCost))}</td></tr>` : ''}
          <tr><td class="c1"><b>الإجمالي</b></td><td class="c2" dir="ltr"><b>${escapeHtml(formatWorkOrderPrintPrice(opts.total))}</b></td></tr>
        </tbody></table>
        <div class="notes"><b>ملاحظات:</b> ${escapeHtml(opts.notes || '-')}</div>
        <div class="signs">
          <div><p>خدمة العملاء</p><span>التوقيع</span></div>
          <div><p>توقيع العميل</p><span>التوقيع</span></div>
          <div><p>توقيع الفني</p><span>التوقيع</span></div>
        </div>
        <div class="foot">
          <p>${escapeHtml(companyInfo.branches.join(' | '))}</p>
          <p>خدمة العملاء: ${escapeHtml(companyInfo.customerService.join(' - '))}</p>
          <p>الخط الساخن: ${escapeHtml(companyInfo.hotline)} | إدارة الفنيين: ${escapeHtml(companyInfo.techManagement)}</p>
        </div>
      </div>`;

  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title>أمر شغل ${escapeHtml(opts.orderCodeLabel || '')}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; font-family: Cairo, Tahoma, sans-serif; }
        ${PRINT_INK_CSS}
        body { margin: 0; padding: 8px; color: #000; font-weight: 700; font-size: 20px; }
        .wo-copy { page-break-inside: avoid; margin-bottom: 6px; }
        .work-form { width: 100%; border: 2px solid #000; padding: 10px; }
        .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
        .logo-wrap { display:flex; align-items:center; gap:12px; }
        .logo-wrap img { width: 96px; height: 96px; border: 2px solid #000; padding: 3px; object-fit: contain; }
        .small { font-size: 19px; line-height: 1.45; font-weight: 700; color: #000; }
        .brand { font-size: 25px; font-weight: 900; line-height: 1.15; color: #000; }
        .title-wrap { text-align:center; }
        .title { border:2px solid #000; padding:6px 28px; font-size:31px; font-weight:900; color: #000; }
        .code { font-size: 20px; margin-top:4px; font-weight: 800; color: #000; }
        table { width:100%; border-collapse:collapse; font-size: 20px; font-weight: 700; color: #000; }
        .meta td, .items td, .items th { border:1px solid #000; padding:7px 10px; }
        .meta .phone-cell { font-size: 21px; font-weight: 800; letter-spacing: 0.02em; unicode-bidi: plaintext; white-space: normal; word-break: break-word; }
        .items th { font-weight:800; text-align:right; }
        .items .c2 { width:160px; text-align:center; font-family: Arial, Tahoma, sans-serif; }
        .notes { border:1px solid #000; margin-top:6px; padding:7px 10px; font-size: 19px; min-height:32px; }
        .signs { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center; margin-top:10px; font-size:18px; }
        .signs p { margin:0 0 26px; font-weight:700; }
        .signs span { display:block; border-top:1px dashed #000; padding-top:3px; }
        .foot { border-top:1px solid #000; margin-top:8px; padding-top:6px; text-align:center; font-size:16px; line-height:1.45; }
        .copy-separator { border: none; border-top: 2px dashed #000; margin: 8px 0; }
        @media print { @page { size: A4; margin: 6mm; } body { padding: 0; } .wo-copy { page-break-inside: avoid; overflow: visible; } }
      </style></head><body>
      <div class="wo-copy">${sheet}</div>
      <hr class="copy-separator" />
      <div class="wo-copy">${sheet}</div>
      </body></html>`;
}
