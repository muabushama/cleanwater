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
  const popup = window.open('', '_blank', 'width=920,height=1240');
  if (popup && !popup.closed) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    let printed = false;
    const run = () => {
      if (printed) return;
      printed = true;
      try {
        popup.focus();
        popup.print();
      } catch {
        /* ignore */
      }
    };
    popup.onload = () => setTimeout(run, 350);
    popup.onafterprint = () => {
      try { popup.close(); } catch { /* ignore */ }
    };
    setTimeout(run, 900);
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '210mm',
    height: '297mm',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
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
    setTimeout(() => iframe.remove(), 2500);
  };

  const imgs = Array.from(doc.images || []);
  if (imgs.length === 0) {
    setTimeout(done, 500);
  } else {
    let pending = imgs.length;
    const tick = () => {
      pending -= 1;
      if (pending <= 0) setTimeout(done, 300);
    };
    imgs.forEach((img) => {
      if (img.complete) tick();
      else {
        img.addEventListener('load', tick);
        img.addEventListener('error', tick);
      }
    });
  }
  setTimeout(done, 2500);
}

type PrintItem = {
  description?: string;
  value?: number | string;
  product_name?: string;
  name?: string;
  qty?: number;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
  price?: number;
  amount?: number;
};

export function parseWorkOrderItems(raw: unknown): PrintItem[] {
  let value: unknown = raw;
  for (let i = 0; i < 3; i += 1) {
    if (typeof value !== 'string') break;
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value as PrintItem[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('description' in obj || 'product_name' in obj || 'value' in obj || 'line_total' in obj) {
      return [obj as PrintItem];
    }
    const numericValues = Object.values(obj);
    if (numericValues.length && numericValues.every((x) => x && typeof x === 'object')) {
      return numericValues as PrintItem[];
    }
  }
  return [];
}

function itemAmount(item: PrintItem): number {
  const qty = Math.max(1, Number(item.qty) || Number(item.quantity) || 1);
  const unit = Number(item.unit_price) || Number(item.price) || 0;
  return Number(item.value) || Number(item.line_total) || Number(item.amount) || (unit * qty) || 0;
}

function printDescription(item: PrintItem): string {
  const raw = String(item.description || item.product_name || item.name || '').trim();
  if (!raw) return '';
  if (/^المنتج\s*:/i.test(raw)) return '';
  return raw;
}

export function resolveWorkOrderPrintItems(opts: {
  items?: unknown;
  productName?: string;
  price1?: unknown;
  price2?: unknown;
  price3?: unknown;
  total?: unknown;
  transportCost?: unknown;
}): { rows: PrintItem[]; total: number } {
  const transport = Number(opts.transportCost) || 0;
  const parsed = parseWorkOrderItems(opts.items).filter((item) => {
    const desc = printDescription(item);
    const amount = itemAmount(item);
    return desc || amount > 0;
  });
  const itemsSum = parsed.reduce((s, item) => s + itemAmount(item), 0);
  const fallbackPrice =
    Number(opts.total) ||
    (Number(opts.price1) || 0) + (Number(opts.price2) || 0) + (Number(opts.price3) || 0) ||
    Number(opts.price1) ||
    0;
  const total = (Number(opts.total) || 0) > 0 ? Number(opts.total) : Math.max(0, itemsSum + transport, fallbackPrice);
  if (parsed.length === 0 && fallbackPrice > 0) {
    return { rows: [{ description: '', value: fallbackPrice - transport }], total };
  }
  return { rows: parsed, total };
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
  productName?: string;
  price1?: unknown;
  price2?: unknown;
  price3?: unknown;
}): string {
  const resolved = resolveWorkOrderPrintItems({
    items: opts.items,
    productName: opts.productName,
    price1: opts.price1,
    price2: opts.price2,
    price3: opts.price3,
    total: opts.total,
    transportCost: opts.transportCost,
  });
  const tableRows = resolved.rows
    .map((item) => {
      const desc = printDescription(item) || '—';
      const value = itemAmount(item);
      return `<tr><td class="c1">${escapeHtml(desc)}</td><td class="c2" dir="ltr">${escapeHtml(formatWorkOrderPrintPrice(value))}</td></tr>`;
    })
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
          <tr><td class="c1"><b>الإجمالي</b></td><td class="c2" dir="ltr"><b>${escapeHtml(formatWorkOrderPrintPrice(resolved.total))}</b></td></tr>
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
