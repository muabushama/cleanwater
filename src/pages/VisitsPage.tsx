import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch } from '@/lib/branchFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatEGP, companyInfo } from '@/data/demo-data';
import { invoiceDebtRemaining } from '@/lib/invoiceBalance';
import { promptDeletePassword } from '@/lib/deletePassword';
import { workOrderPhonesForPrint } from '@/lib/workOrderPrintPhones';
import {
  getMaintenanceIntervalMonths,
  getNextMaintenanceDate,
  getNextMaintenanceDateStr,
  hasFutureMaintenanceVisit,
  maintenanceVisitStatus,
} from '@/lib/maintenanceSchedule';
import logo from '@/assets/logo.png';
import {
  Search, Phone, MapPin, Monitor, Wrench, CreditCard,
  Calendar, CheckCircle, Clock, AlertTriangle, Plus, User,
  Printer, FileWarning, Filter, Hash, MessageCircle, Send,
  Edit, Save, X, Trash2
} from 'lucide-react';

interface CustomerDevice {
  id: string;
  customer_id: string;
  product_name: string;
  device_type: string;
  serial_number: string;
  install_date: string | null;
  warranty_months: number;
  warranty_status: string;
  contract_type: string;
  selling_price: number;
  total_price: number;
  installments_count: number;
  installment_amount: number;
  candles: any[];
  branch: string;
  customer_code: string;
  notes: string;
  contract_installment_interval_months?: number;
}

interface Customer {
  id: string;
  name: string;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  address: string;
  region?: string;
  notes?: string;
}

interface CandleChange {
  id: string;
  device_id: string;
  change_date: string;
  candle1: boolean;
  candle2: boolean;
  candle3: boolean;
  candle4: boolean;
  candle5: boolean;
  candle6: boolean;
  candle7: boolean;
  candle8?: boolean;
  candle9?: boolean;
  candle10?: boolean;
  tds_reading: string;
  technician: string;
  cost: number;
  collected: number;
  remaining: number;
  notes: string;
  status: string;
}

type VisitFilter = 'all' | 'maintenance' | 'work_order' | 'installment' | 'breakdown' | 'overdue';

interface VisitsPageProps { embedded?: boolean }
export default function VisitsPage({ embedded }: VisitsPageProps = {}) {
  const formatDateDisplay = (v?: string) => {
    const raw = String(v || '').trim();
    if (!raw) return '-';
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return raw;
  };

  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<CustomerDevice[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<CustomerDevice | null>(null);
  const [candleChanges, setCandleChanges] = useState<CandleChange[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [lastCandleChangeByDevice, setLastCandleChangeByDevice] = useState<Record<string, string>>({});
  const [installments, setInstallments] = useState<any[]>([]);
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState('maintenance');
  const [visitType, setVisitType] = useState('زيارة صيانة');

  // Stats
  const [stats, setStats] = useState({ customers: 0, regions: 0, totalValue: 0 });
  const { branch } = useUserBranch();

  // Add maintenance form
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showContractDetails, setShowContractDetails] = useState(false);
  const [maintForm, setMaintForm] = useState({
    change_date: new Date().toISOString().split('T')[0],
    candle1: false, candle2: false, candle3: false, candle4: false,
    candle5: false, candle6: false, candle7: false,
    candle8: false, candle9: false, candle10: false,
    tds_reading: '', technician: '', cost: 0, collected: 0, notes: '',
  });
  const [breakdownForm, setBreakdownForm] = useState({
    next_date: new Date().toISOString().split('T')[0],
    type: 'عطل',
    technician: '',
    cost: 0,
    notes: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Edit states
  const [editingMaintId, setEditingMaintId] = useState<string | null>(null);
  const [editMaintForm, setEditMaintForm] = useState<Partial<CandleChange>>({});
  const [editingBreakdownId, setEditingBreakdownId] = useState<string | null>(null);
  const [editBreakdownForm, setEditBreakdownForm] = useState<any>({});
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editInstallmentForm, setEditInstallmentForm] = useState<any>({});

  // Edit customer/device
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editCustomerForm, setEditCustomerForm] = useState<Partial<Customer>>({});
  const [editingDevice, setEditingDevice] = useState(false);
  const [editDeviceForm, setEditDeviceForm] = useState<Partial<CustomerDevice>>({});

  const printRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedCustomer(null);
    setSelectedDevice(null);
    setSearch('');
    fetchData();
  }, [branch]);

  const fetchData = async () => {
    setLoading(true);
    const db = supabase as any;
    const bv = branchDbValuesForUiBranch(branch);
    const [custRes, devRes, maintRes, workOrdersRes, ccRes] = await Promise.all([
      supabase.from('customers').select('*').in('branch', bv).order('name'),
      db.from('customer_devices').select('*').in('branch', bv).order('created_at', { ascending: false }),
      supabase.from('maintenance').select('*').in('branch', bv).order('next_date', { ascending: false }),
      supabase.from('work_orders').select('*').in('branch', bv).order('visit_date', { ascending: false }),
      db.from('candle_changes').select('device_id, change_date').order('change_date', { ascending: false }),
    ]);
    const custs = (custRes.data || []) as Customer[];
    const devs = (devRes.data || []) as CustomerDevice[];
    setCustomers(custs);
    setDevices(devs);
    setMaintenanceRecords(maintRes.data || []);
    setWorkOrders(workOrdersRes.data || []);

    const lastChangeMap: Record<string, string> = {};
    (ccRes.data || []).forEach((row: any) => {
      const deviceId = String(row.device_id || '');
      const changeDate = String(row.change_date || '').slice(0, 10);
      if (!deviceId || !changeDate || lastChangeMap[deviceId]) return;
      lastChangeMap[deviceId] = changeDate;
    });
    setLastCandleChangeByDevice(lastChangeMap);

    const regions = new Set(custs.map(c => c.region).filter(Boolean));
    const totalVal = devs.reduce((sum, d) => sum + (d.total_price || 0), 0);
    setStats({ customers: custs.length, regions: regions.size, totalValue: totalVal });

    setLoading(false);
  };

  const filteredCustomers = useMemo(() => {
    if (!search) return [];
    const s = search.toLowerCase();
    const deviceByCustomer = new Map<string, string[]>();
    devices.forEach((d) => {
      const arr = deviceByCustomer.get(d.customer_id) || [];
      arr.push(String(d.customer_code || '').toLowerCase());
      deviceByCustomer.set(d.customer_id, arr);
    });
    return customers.filter(c =>
      c.name.includes(s) ||
      c.phone1.includes(s) ||
      (c.phone2 || '').includes(s) ||
      c.address.includes(s) ||
      (c.region || '').includes(s) ||
      (deviceByCustomer.get(c.id) || []).some((code) => code.includes(s))
    ).slice(0, 20);
  }, [search, customers, devices]);

  const customerDevices = useMemo(() => {
    if (!selectedCustomer) return [];
    return devices.filter(d => d.customer_id === selectedCustomer.id);
  }, [selectedCustomer, devices]);

  const customerMaintenance = useMemo(() => {
    if (!selectedCustomer) return [];
    return maintenanceRecords.filter(m => m.customer_name === selectedCustomer.name);
  }, [selectedCustomer, maintenanceRecords]);

  const customerWorkOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return workOrders.filter(wo => wo.customer_name === selectedCustomer.name);
  }, [selectedCustomer, workOrders]);

  const customerCodeByName = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((d) => {
      const code = String(d.customer_code || '').trim();
      if (!code) return;
      const cust = customers.find((c) => c.id === d.customer_id);
      if (cust?.name) map.set(cust.name, code);
    });
    return map;
  }, [customers, devices]);

  const computedMaintenanceVisits = useMemo(() => {
    const virtual: Array<{
      id: string;
      source: string;
      customer_name: string;
      phone: string;
      customer_code: string;
      product_name: string;
      date: string;
      technician: string;
      status: string;
      label: string;
    }> = [];

    for (const device of devices) {
      const customer = customers.find((c) => c.id === device.customer_id);
      const lastChangeDate = lastCandleChangeByDevice[device.id];
      if (!customer || !lastChangeDate) continue;

      const nextDateStr = getNextMaintenanceDateStr(device, lastChangeDate);
      if (hasFutureMaintenanceVisit(maintenanceRecords, customer.name, lastChangeDate)) continue;

      virtual.push({
        id: `computed-maint-${device.id}-${nextDateStr}`,
        source: 'maintenance',
        customer_name: customer.name,
        phone: [customer.phone1, customer.phone2].filter(Boolean).join(' - '),
        customer_code: customerCodeByName.get(customer.name) || String(device.customer_code || ''),
        product_name: device.product_name || '',
        date: nextDateStr,
        technician: '',
        status: maintenanceVisitStatus(nextDateStr),
        label: `صيانة دورية (بعد ${getMaintenanceIntervalMonths(device)} شهر)`,
      });
    }
    return virtual;
  }, [devices, customers, lastCandleChangeByDevice, maintenanceRecords, customerCodeByName]);

  const allVisits = useMemo(() => {
    const maintenanceVisits = maintenanceRecords.map((m) => ({
      id: `maintenance-${m.id}`,
      source: 'maintenance',
      customer_name: m.customer_name,
      phone: m.phone || '',
      customer_code: customerCodeByName.get(m.customer_name) || '',
      product_name: m.product_name || '',
      date: m.next_date || '',
      technician: m.technician || '',
      status: m.status || 'upcoming',
      label: m.type || 'صيانة',
    }));

    const workOrderVisits = workOrders.map((wo) => ({
      id: `workorder-${wo.id}`,
      source: 'work_order',
      customer_name: wo.customer_name,
      phone: wo.phone || '',
      customer_code: String((wo as any).customer_code || customerCodeByName.get(wo.customer_name) || ''),
      product_name: wo.product_name || '',
      date: wo.visit_date || '',
      technician: wo.technician || '',
      status: wo.status || 'pending',
      label: wo.order_code || 'أمر عمل',
    }));

    const combined = [...maintenanceVisits, ...computedMaintenanceVisits, ...workOrderVisits];

    const filteredByType = combined.filter((item) => {
      if (visitFilter === 'all') return true;
      if (visitFilter === 'maintenance') return item.source === 'maintenance' && item.label !== 'عطل';
      if (visitFilter === 'breakdown') return item.source === 'maintenance' && item.label === 'عطل';
      if (visitFilter === 'overdue') return item.source === 'maintenance' && item.status === 'overdue';
      if (visitFilter === 'work_order') return item.source === 'work_order';
      if (visitFilter === 'installment') return false;
      return true;
    });

    const q = search.trim();
    const filteredBySearch = q
      ? filteredByType.filter((item) => {
          const ql = q.toLowerCase();
          const digits = q.replace(/\D/g, '');
          const phoneDigits = String(item.phone || '').replace(/\D/g, '');
          return (
            item.customer_name.toLowerCase().includes(ql) ||
            item.phone.includes(q) ||
            (digits.length > 0 && phoneDigits.includes(digits)) ||
            String(item.customer_code || '').toLowerCase().includes(ql) ||
            item.product_name.toLowerCase().includes(ql) ||
            item.label.toLowerCase().includes(ql)
          );
        })
      : filteredByType;

    return filteredBySearch.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [maintenanceRecords, workOrders, visitFilter, search, customerCodeByName, computedMaintenanceVisits]);

  const customerSchedule = useMemo(() => {
    const maintenanceDates = customerMaintenance.map(m => ({
      id: `maintenance-${m.id}`,
      source: 'maintenance',
      label: m.type || 'صيانة',
      date: m.next_date,
      technician: m.technician || '',
      status: m.status || 'upcoming',
    }));

    const computedForCustomer = customerDevices.flatMap((device) => {
      const lastChangeDate = lastCandleChangeByDevice[device.id];
      if (!lastChangeDate || !selectedCustomer) return [];
      if (hasFutureMaintenanceVisit(maintenanceRecords, selectedCustomer.name, lastChangeDate)) return [];
      const nextDateStr = getNextMaintenanceDateStr(device, lastChangeDate);
      return [{
        id: `computed-maint-${device.id}-${nextDateStr}`,
        source: 'maintenance',
        label: `صيانة قادمة (بعد ${getMaintenanceIntervalMonths(device)} شهر)`,
        date: nextDateStr,
        technician: '',
        status: maintenanceVisitStatus(nextDateStr),
      }];
    });

    const workOrderDates = customerWorkOrders.map(wo => ({
      id: `workorder-${wo.id}`,
      source: 'work_order',
      label: wo.order_code || 'أمر عمل',
      date: wo.visit_date,
      technician: wo.technician || '',
      status: wo.status || 'pending',
    }));
    return [...maintenanceDates, ...computedForCustomer, ...workOrderDates].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [customerMaintenance, customerWorkOrders, customerDevices, lastCandleChangeByDevice, maintenanceRecords, selectedCustomer]);

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedDevice(null);
    setCandleChanges([]);
    setInstallments([]);
    setSearch(customer.name);
    setShowDropdown(false);
    setEditingCustomer(false);

    const custDevs = devices.filter(d => d.customer_id === customer.id);
    if (custDevs.length > 0) {
      await selectDevice(custDevs[0]);
    }
  };

  const selectDevice = async (device: CustomerDevice) => {
    setSelectedDevice(device);
    setEditingDevice(false);
    const db = supabase as any;
    const [ccRes, instRes] = await Promise.all([
      db.from('candle_changes').select('*').eq('device_id', device.id).order('change_date', { ascending: false }),
      db.from('installments').select('*').eq('device_id', device.id).order('installment_date', { ascending: true }),
    ]);
    setCandleChanges((ccRes.data || []) as CandleChange[]);
    setInstallments((instRes.data || []) as any[]);
  };

  const getWarrantyEnd = (device: CustomerDevice) => {
    if (!device.install_date) return null;
    const d = new Date(device.install_date);
    d.setMonth(d.getMonth() + device.warranty_months);
    return d;
  };

  const getWarrantyRemaining = (device: CustomerDevice) => {
    const end = getWarrantyEnd(device);
    if (!end) return { text: 'غير محدد', days: 0 };
    const now = new Date();
    if (end <= now) return { text: 'منتهي', days: 0 };
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    return { text: `${months} شهر ${days % 30} يوم`, days };
  };

  const fmtDateDMY = (d: Date) => `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;

  const generateInvoiceHTML = (customer: Customer, device: CustomerDevice, cost: number, nextDate: Date | null) => {
    const nextDateStr = nextDate ? fmtDateDMY(nextDate) : '../../....';
    const today = fmtDateDMY(new Date());
    const warrantyEnd = getWarrantyEnd(device);
    const warrantyText = warrantyEnd ? fmtDateDMY(warrantyEnd) : 'غير محدد';

    return `<html dir="rtl"><head><title>فاتورة صيانة - ${customer.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
      body { padding: 20px; color: #1a1a2e; }
      .container { max-width: 800px; margin: 0 auto; border: 2px solid #1a3a5c; padding: 30px; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a3a5c; padding-bottom: 15px; margin-bottom: 20px; }
      .company { font-size: 22px; font-weight: 800; color: #1a3a5c; }
      .sub { font-size: 11px; color: #666; }
      .title { background: linear-gradient(135deg, #1a3a5c, #2d5f8a); color: white; padding: 8px 30px; border-radius: 8px; font-size: 20px; font-weight: 700; }
      .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; }
      .info-row { display: flex; gap: 8px; }
      .info-label { font-weight: 600; color: #666; min-width: 100px; }
      .info-value { font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th { background: #f0f4f8; padding: 8px; border: 1px solid #ddd; font-size: 12px; text-align: right; }
      td { padding: 8px; border: 1px solid #ddd; font-size: 12px; }
      .amount-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 15px 0; }
      .amount-box { text-align: center; padding: 10px; border-radius: 8px; color: white; }
      .total { background: #1a3a5c; }
      .paid { background: #2d8a6e; }
      .remaining { background: #c0392b; }
      .amount-label { font-size: 11px; opacity: 0.9; }
      .amount-value { font-size: 18px; font-weight: 800; }
      .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 40px; font-size: 11px; color: #666; }
      .sig-line { border-top: 1px dashed #999; margin-top: 50px; padding-top: 5px; }
      .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
      .next-date { background: #e8f4f8; padding: 12px; border-radius: 8px; text-align: center; margin: 15px 0; font-size: 14px; }
      .next-date strong { color: #1a3a5c; font-size: 18px; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="container">
      <div class="header">
        <div style="display:flex;align-items:center;gap:10px">
          <div>
            <div class="company">كلين ووتر</div>
            <div class="sub">لتكنولوجيا معالجة مياه الشرب</div>
          </div>
        </div>
        <div class="title">فاتورة صيانة</div>
      </div>
      <div class="info">
        <div class="info-row"><span class="info-label">العميل:</span><span class="info-value">${customer.name}</span></div>
        <div class="info-row"><span class="info-label">التاريخ:</span><span class="info-value">${today}</span></div>
        <div class="info-row"><span class="info-label">الهاتف:</span><span class="info-value">${[customer.phone1, customer.phone2].filter(Boolean).join(' - ')}</span></div>
        <div class="info-row"><span class="info-label">المنتج:</span><span class="info-value">${device.product_name}</span></div>
        <div class="info-row" style="grid-column:span 2"><span class="info-label">العنوان:</span><span class="info-value">${customer.address}</span></div>
        <div class="info-row"><span class="info-label">نوع الجهاز:</span><span class="info-value">${device.device_type}</span></div>
        <div class="info-row"><span class="info-label">الضمان حتى:</span><span class="info-value">${warrantyText}</span></div>
      </div>
      <div style="font-weight:700;font-size:14px;color:#1a3a5c;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">تفاصيل الخدمة</div>
      <table>
        <thead><tr><th>#</th><th>البيان</th><th>القيمة</th></tr></thead>
        <tbody>
          <tr><td style="text-align:center">1</td><td>صيانة دورية - تغيير شمعات</td><td style="text-align:center;font-weight:600">${cost} ج.م</td></tr>
        </tbody>
      </table>
      <div class="next-date">
        <div>موعد الصيانة القادمة</div>
        <strong>${nextDateStr}</strong>
      </div>
      <div class="sigs">
        <div><div style="font-weight:600;margin-bottom:50px">خدمة العملاء</div><div class="sig-line">التوقيع</div></div>
        <div><div style="font-weight:600;margin-bottom:50px">توقيع العميل</div><div class="sig-line">التوقيع</div></div>
        <div><div style="font-weight:600;margin-bottom:50px">المندوب / الفني</div><div class="sig-line">التوقيع</div></div>
      </div>
      <div class="footer">
        <p>${companyInfo.branches.join(' | ')}</p>
        <p>خدمة العملاء: ${companyInfo.customerService.join(' - ')}</p>
        <p>الخط الساخن: ${companyInfo.hotline} | إدارة الفنيين: ${companyInfo.techManagement}</p>
      </div>
    </div></body></html>`;
  };

  // Send WhatsApp with invoice details as text
  const sendWhatsAppInvoice = (customer: Customer, device: CustomerDevice, cost: number, nextDate: Date | null) => {
    const whatsappNumber = (customer.whatsapp || customer.phone1).replace(/[^0-9]/g, '');
    const formattedNumber = whatsappNumber.startsWith('0') ? '2' + whatsappNumber : whatsappNumber;

    const nextDateStr = nextDate
      ? `${nextDate.getDate().toString().padStart(2, '0')}/${(nextDate.getMonth() + 1).toString().padStart(2, '0')}/${nextDate.getFullYear()}`
      : '../../....';

    const today = fmtDateDMY(new Date());
    const warrantyEnd = getWarrantyEnd(device);
    const warrantyText = warrantyEnd ? fmtDateDMY(warrantyEnd) : 'غير محدد';

    // Build candle change details
    const changedCandles: string[] = [];
    if (maintForm.candle1) changedCandles.push('شمعة 1');
    if (maintForm.candle2) changedCandles.push('شمعة 2');
    if (maintForm.candle3) changedCandles.push('شمعة 3');
    if (maintForm.candle4) changedCandles.push('شمعة 4');
    if (maintForm.candle5) changedCandles.push('شمعة 5');
    if (maintForm.candle6) changedCandles.push('شمعة 6');
    if (maintForm.candle7) changedCandles.push('شمعة 7');
    if (maintForm.candle8) changedCandles.push('شمعة 8');
    if (maintForm.candle9) changedCandles.push('شمعة 9');
    if (maintForm.candle10) changedCandles.push('شمعة 10');

    const candlesText = changedCandles.length > 0 ? changedCandles.join(' ، ') : 'صيانة دورية';
    const tdsText = maintForm.tds_reading ? `\n📊 قراءة TDS: ${maintForm.tds_reading}` : '';

    const message = `أستاذ / ${customer.name}

تم تنفيذ الصيانة اليوم بنجاح 👍

━━━━━━━━━━━━━━━━━
📋 *فاتورة صيانة*
━━━━━━━━━━━━━━━━━
📅 التاريخ: ${today}
👤 العميل: ${customer.name}
📞 الهاتف: ${[customer.phone1, customer.phone2].filter(Boolean).join(' - ')}
📍 العنوان: ${customer.address}

🔧 *تفاصيل الخدمة:*
• المنتج: ${device.product_name}
• نوع الجهاز: ${device.device_type}
• الشمعات المغيّرة: ${candlesText}${tdsText}
• الفني: ${maintForm.technician || 'غير محدد'}

💰 *التكلفة:*
• الإجمالي: ${cost} ج.م
• المحصّل: ${maintForm.collected || 0} ج.م
• المتبقي: ${cost - (maintForm.collected || 0)} ج.م

🛡️ الضمان حتى: ${warrantyText}
━━━━━━━━━━━━━━━━━

📅 موعد الصيانة القادمة: *${nextDateStr}*

في حالة وجود أي استفسار نحن في خدمتكم دائمًا.

*Clean Water*
لتكنولوجيا معالجة مياه الشرب
☎️ الخط الساخن: 01210891111`;

    // Open WhatsApp directly
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${formattedNumber}?text=${encodedMsg}`, '_blank');

    toast({ title: 'تم فتح واتساب', description: 'تم إرسال تفاصيل الفاتورة في الرسالة' });
  };

  // Print invoice separately
  const handlePrintInvoice = () => {
    if (!selectedCustomer || !selectedDevice) {
      toast({ title: 'اختر عميل وجهاز أولاً', variant: 'destructive' });
      return;
    }
    const nextDate = getNextMaintenanceDate(selectedDevice, maintForm.change_date);
    const invoiceHTML = generateInvoiceHTML(selectedCustomer, selectedDevice, maintForm.cost || 0, nextDate);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handlePrintWorkOrder = (wo: any) => {
    const items = Array.isArray(wo.items) ? wo.items : [];
    const total = Number(wo.total) || items.reduce((s: number, it: any) => s + (Number(it.value) || Number(it.unit_price) || 0) * (Number(it.qty) || 1), 0);
    const transport = Number(wo.transport_cost) || 0;
    const allPhones = workOrderPhonesForPrint(
      { phone: wo.phone, customer_name: wo.customer_name },
      customers.map(c => ({ name: c.name, phone1: c.phone1, phone2: c.phone2, whatsapp: c.whatsapp })),
    );
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>أمر عمل ${wo.order_code}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; font-family:'Cairo',sans-serif; }
      body { padding:20px; color:#000; font-size:15px; font-weight:800; }
      .container { max-width:800px; margin:0 auto; border:2px solid #000; padding:25px; }
      .top-address { text-align:center; font-size:13px; font-weight:800; color:#000; margin-bottom:8px; line-height:1.6; border-bottom:2px solid #000; padding-bottom:8px; }
      .header { display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; margin-bottom:18px; border-bottom:2px solid #000; }
      .header-logo img { max-height:200px; max-width:380px; object-fit:contain; }
      .header-info { text-align:left; }
      .code { font-size:14px; color:#000; font-weight:800; }
      .info { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:18px; font-size:13px; }
      .info-item { background:#f8f9fa; padding:8px 10px; border-radius:4px; border:1px solid #ddd; }
      .info-label { color:#000; font-size:12px; font-weight:800; }
      .info-value { font-weight:900; font-size:15px; color:#000; }
      table { width:100%; border-collapse:collapse; margin:14px 0; }
      th { background:#111; color:#fff; padding:10px; font-size:14px; text-align:right; font-weight:800; }
      td { padding:10px; border:1px solid #333; font-size:14px; font-weight:800; color:#000; }
      .total-row { background:#f0f4f8; font-weight:800; font-size:16px; }
      .sigs { display:grid; grid-template-columns:1fr 1fr; gap:30px; text-align:center; margin-top:30px; font-size:13px; color:#000; }
      .sig-line { border-top:2px solid #000; margin-top:40px; padding-top:5px; font-weight:700; }
      .footer { margin-top:18px; padding-top:12px; border-top:3px solid #000; font-size:13px; color:#000; text-align:center; line-height:2; font-weight:700; }
      .footer p { margin:3px 0; }
      .footer .branch { font-weight:800; font-size:14px; color:#000; background:#f0f4f8; padding:4px 10px; border-radius:4px; display:inline-block; margin:2px 0; }
      .footer .phones { font-weight:700; font-size:13px; }
      .footer .hotline { font-weight:800; font-size:15px; color:#000; }
      @media print { body { padding:10px; } }
    </style></head><body>
    <div class="container">
      <div class="top-address">
        ${companyInfo.branches[0]} | ${companyInfo.branches[1]}
      </div>
      <div class="header">
        <div class="header-logo"><img src="${logo}" alt="Clean Water Logo" /></div>
        <div class="header-info"><div class="code">رقم الأمر: ${wo.order_code || '-'}</div><div style="font-size:11px;color:#000;font-weight:600;margin-top:2px">أمر عمل</div></div>
      </div>
      <div class="info">
        <div class="info-item"><span class="info-label">العميل:</span><div class="info-value">${wo.customer_name || '-'}</div></div>
        <div class="info-item"><span class="info-label">الهاتف:</span><div class="info-value">${allPhones}</div></div>
        <div class="info-item"><span class="info-label">التاريخ:</span><div class="info-value">${formatDateDisplay(wo.visit_date)}</div></div>
        <div class="info-item"><span class="info-label">العنوان:</span><div class="info-value">${wo.address || '-'}</div></div>
        <div class="info-item"><span class="info-label">المنطقة:</span><div class="info-value">${wo.region || '-'}</div></div>
        <div class="info-item"><span class="info-label">الفني:</span><div class="info-value">${wo.technician || '-'}</div></div>
        <div class="info-item"><span class="info-label">المنتج:</span><div class="info-value">${wo.product_name || '-'}</div></div>
        <div class="info-item"><span class="info-label">الحالة:</span><div class="info-value">${wo.status || '-'}</div></div>
        <div class="info-item"><span class="info-label">حالة الضمان:</span><div class="info-value">${wo.warranty_status || '-'}</div></div>
      </div>
      ${items.length > 0 ? `
        <table>
          <thead><tr><th>#</th><th>المنتج / البيان</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>${items.map((it: any, idx: number) => {
            const desc = it.description || it.product_name || '-';
            const qty = Number(it.qty) || 1;
            const price = Number(it.value) || Number(it.unit_price) || 0;
            return `<tr><td style="text-align:center">${idx + 1}</td><td>${desc}</td><td style="text-align:center">${qty}</td><td style="text-align:center">${price}</td><td style="text-align:center;font-weight:700">${qty * price}</td></tr>`;
          }).join('')}
          ${transport > 0 ? `<tr><td colspan="4" style="text-align:left;font-weight:700">مواصلات</td><td style="text-align:center;font-weight:700">${transport}</td></tr>` : ''}
          <tr class="total-row"><td colspan="4" style="text-align:left">الإجمالي</td><td style="text-align:center;font-size:18px;font-weight:800">${total + transport} ج.م</td></tr>
          </tbody>
        </table>
      ` : `<p style="text-align:center;padding:20px;color:#666">لا توجد بنود</p>`}
      ${wo.notes ? `<div style="background:#f8f9fa;padding:10px;border-radius:4px;margin:12px 0;font-size:13px;font-weight:600"><b>ملاحظات:</b> ${wo.notes}</div>` : ''}
      <div class="sigs">
        <div><div style="font-weight:800;font-size:14px;margin-bottom:40px">توقيع العميل</div><div class="sig-line">التوقيع والاسم</div></div>
        <div><div style="font-weight:800;font-size:14px;margin-bottom:40px">توقيع الفني / المندوب</div><div class="sig-line">التوقيع والاسم</div></div>
      </div>
      <div class="footer">
        <p class="branch">🏢 ${companyInfo.branches[0]}</p>
        <p class="branch">🏢 ${companyInfo.branches[1]}</p>
        <p class="phones">خدمة العملاء: ${companyInfo.customerService.join(' - ')}</p>
        <p class="hotline">📞 الخط الساخن: ${companyInfo.hotline} | إدارة الفنيين: ${companyInfo.techManagement}</p>
      </div>
    </div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const handleSaveMaintenance = async () => {
    if (!selectedDevice || !selectedCustomer) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('candle_changes').insert({
        device_id: selectedDevice.id,
        customer_id: selectedCustomer.id,
        change_date: maintForm.change_date,
        candle1: maintForm.candle1, candle2: maintForm.candle2, candle3: maintForm.candle3,
        candle4: maintForm.candle4, candle5: maintForm.candle5, candle6: maintForm.candle6,
        candle7: maintForm.candle7, candle8: maintForm.candle8, candle9: maintForm.candle9, candle10: maintForm.candle10,
        tds_reading: maintForm.tds_reading, technician: maintForm.technician,
        cost: maintForm.cost, collected: maintForm.collected,
        remaining: invoiceDebtRemaining(maintForm.cost, maintForm.collected), notes: maintForm.notes,
      });
      if (error) throw error;

      // Also save to maintenance table
      const user = (await supabase.auth.getUser()).data.user;
      const nextDate = getNextMaintenanceDate(selectedDevice, maintForm.change_date);
      const nextDateStr = nextDate ? nextDate.toISOString().split('T')[0] : maintForm.change_date;
      const { data: maintData } = await supabase.from('maintenance').insert({
        customer_name: selectedCustomer.name,
        product_name: selectedDevice.product_name,
        type: 'تغيير شمعات',
        next_date: nextDateStr,
        technician: maintForm.technician,
        cost: maintForm.cost,
        notes: maintForm.notes,
        phone: [selectedCustomer.phone1, selectedCustomer.phone2].filter(Boolean).join(' - '),
        status: 'upcoming',
        branch,
        created_by: user?.id,
      }).select('id').single();

      // إنشاء أمر عمل للصيانة القادمة بنفس التاريخ
      if (nextDateStr && maintData?.id) {
        await supabase.from('work_orders').insert({
          order_code: `صيانة-${nextDateStr}-${maintData.id.slice(-6)}`,
          customer_name: selectedCustomer.name,
          phone: [selectedCustomer.phone1, selectedCustomer.phone2].filter(Boolean).join(' - '),
          address: selectedCustomer.address || '—',
          region: selectedCustomer.region || '',
          product_name: selectedDevice.product_name,
          visit_date: nextDateStr,
          technician: maintForm.technician,
          branch,
          status: 'pending',
          items: maintForm.cost > 0 ? [{ description: 'تغيير شمعات', value: maintForm.cost }] : [],
          transport_cost: 0,
          total: maintForm.cost,
          previous_visits: [],
          created_by: user?.id,
        } as any);
      }

      toast({
        title: 'تم تسجيل الصيانة بنجاح',
        description: `تم حجز الصيانة القادمة تلقائياً بعد ${getMaintenanceIntervalMonths(selectedDevice)} شهر: ${formatDateDisplay(nextDateStr)}`,
      });

      // Auto-send WhatsApp + PDF
      sendWhatsAppInvoice(selectedCustomer, selectedDevice, maintForm.cost, nextDate);

      setShowAddMaint(false);
      setMaintForm({
        change_date: new Date().toISOString().split('T')[0],
        candle1: false, candle2: false, candle3: false, candle4: false,
        candle5: false, candle6: false, candle7: false,
        candle8: false, candle9: false, candle10: false,
        tds_reading: '', technician: '', cost: 0, collected: 0, notes: '',
      });
      selectDevice(selectedDevice);
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBreakdown = async () => {
    if (!selectedCustomer || !selectedDevice) return;
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data: maintData, error } = await supabase.from('maintenance').insert({
        customer_name: selectedCustomer.name,
        product_name: selectedDevice.product_name,
        type: 'عطل',
        next_date: breakdownForm.next_date,
        technician: breakdownForm.technician,
        cost: breakdownForm.cost,
        notes: breakdownForm.notes,
        phone: breakdownForm.phone || [selectedCustomer.phone1, selectedCustomer.phone2].filter(Boolean).join(' - '),
        status: 'upcoming',
        branch,
        created_by: user?.id,
      }).select('id').single();
      if (error) throw error;

      // إنشاء أمر عمل مرتبط بنفس التاريخ
      if (maintData?.id) {
        await supabase.from('work_orders').insert({
          order_code: `صيانة-${breakdownForm.next_date}-${maintData.id.slice(-6)}`,
          customer_name: selectedCustomer.name,
          phone: breakdownForm.phone || [selectedCustomer.phone1, selectedCustomer.phone2].filter(Boolean).join(' - '),
          address: selectedCustomer.address || '—',
          region: selectedCustomer.region || '',
          product_name: selectedDevice.product_name,
          visit_date: breakdownForm.next_date,
          technician: breakdownForm.technician,
          branch,
          status: 'pending',
          items: breakdownForm.cost > 0 ? [{ description: 'عطل', value: breakdownForm.cost }] : [],
          transport_cost: 0,
          total: breakdownForm.cost,
          previous_visits: [],
          created_by: user?.id,
        } as any);
      }

      toast({ title: 'تم تسجيل العطل بنجاح' });
      setShowBreakdown(false);
      setBreakdownForm({ next_date: new Date().toISOString().split('T')[0], type: 'عطل', technician: '', cost: 0, notes: '', phone: '' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== EDIT FUNCTIONS =====

  // Edit maintenance record (candle_changes)
  const startEditMaint = (cc: CandleChange) => {
    setEditingMaintId(cc.id);
    setEditMaintForm({ ...cc });
  };

  const saveEditMaint = async () => {
    if (!editingMaintId) return;
    setSaving(true);
    try {
      const { id, ...updates } = editMaintForm as CandleChange;
      const remaining = invoiceDebtRemaining(updates.cost || 0, updates.collected || 0);
      const { error } = await (supabase as any).from('candle_changes').update({
        change_date: updates.change_date,
        candle1: updates.candle1, candle2: updates.candle2, candle3: updates.candle3,
        candle4: updates.candle4, candle5: updates.candle5, candle6: updates.candle6,
        candle7: updates.candle7, candle8: updates.candle8, candle9: updates.candle9, candle10: updates.candle10,
        tds_reading: updates.tds_reading, technician: updates.technician,
        cost: updates.cost, collected: updates.collected,
        remaining, notes: updates.notes, status: updates.status,
      }).eq('id', editingMaintId);
      if (error) throw error;
      toast({ title: 'تم تعديل سجل الصيانة' });
      setEditingMaintId(null);
      if (selectedDevice) selectDevice(selectedDevice);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkOrderVisit = async (wo: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`حذف أمر العمل "${wo.order_code || wo.customer_name}"؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('work_orders').delete().eq('id', wo.id);
      if (error) throw error;
      toast({ title: 'تم حذف أمر العمل' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const deleteMaintRecord = async (cc: CandleChange) => {
    if (!confirm(`حذف سجل الصيانة بتاريخ ${formatDateDisplay(cc.change_date)}؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await (supabase as any).from('candle_changes').delete().eq('id', cc.id);
      if (error) throw error;
      toast({ title: 'تم حذف سجل الصيانة' });
      if (selectedDevice) selectDevice(selectedDevice);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // Edit breakdown (maintenance table)
  const startEditBreakdown = (m: any) => {
    setEditingBreakdownId(m.id);
    setEditBreakdownForm({ ...m });
  };

  const saveEditBreakdown = async () => {
    if (!editingBreakdownId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('maintenance').update({
        next_date: editBreakdownForm.next_date,
        technician: editBreakdownForm.technician,
        cost: editBreakdownForm.cost,
        notes: editBreakdownForm.notes,
        status: editBreakdownForm.status,
        phone: editBreakdownForm.phone,
      }).eq('id', editingBreakdownId);
      if (error) throw error;
      toast({ title: 'تم تعديل سجل العطل' });
      setEditingBreakdownId(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteBreakdown = async (m: any) => {
    if (!confirm(`حذف سجل العطل بتاريخ ${formatDateDisplay(m.next_date)}؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('maintenance').delete().eq('id', m.id);
      if (error) throw error;
      toast({ title: 'تم حذف سجل العطل' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // Edit installment
  const startEditInstallment = (inst: any) => {
    setEditingInstallmentId(inst.id);
    setEditInstallmentForm({ ...inst });
  };

  const saveEditInstallment = async () => {
    if (!editingInstallmentId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('installments').update({
        installment_date: editInstallmentForm.installment_date,
        amount: editInstallmentForm.amount,
        status: editInstallmentForm.status,
        collection_date: editInstallmentForm.collection_date || null,
      }).eq('id', editingInstallmentId);
      if (error) throw error;
      toast({ title: 'تم تعديل القسط' });
      setEditingInstallmentId(null);
      if (selectedDevice) selectDevice(selectedDevice);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Edit customer
  const startEditCustomer = () => {
    if (!selectedCustomer) return;
    setEditingCustomer(true);
    setEditCustomerForm({ ...selectedCustomer });
  };

  const saveEditCustomer = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('customers').update({
        name: editCustomerForm.name,
        phone1: editCustomerForm.phone1,
        phone2: editCustomerForm.phone2 || '',
        whatsapp: editCustomerForm.whatsapp || '',
        address: editCustomerForm.address,
        region: editCustomerForm.region || '',
        notes: editCustomerForm.notes || '',
      }).eq('id', selectedCustomer.id);
      if (error) throw error;
      toast({ title: 'تم تعديل بيانات العميل' });
      setEditingCustomer(false);
      const updated = { ...selectedCustomer, ...editCustomerForm } as Customer;
      setSelectedCustomer(updated);
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Edit device
  const startEditDevice = () => {
    if (!selectedDevice) return;
    setEditingDevice(true);
    setEditDeviceForm({ ...selectedDevice });
  };

  const saveEditDevice = async () => {
    if (!selectedDevice) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('customer_devices').update({
        product_name: editDeviceForm.product_name,
        device_type: editDeviceForm.device_type,
        serial_number: editDeviceForm.serial_number,
        install_date: editDeviceForm.install_date,
        warranty_months: editDeviceForm.warranty_months,
        warranty_status: editDeviceForm.warranty_status,
        contract_type: editDeviceForm.contract_type,
        selling_price: editDeviceForm.selling_price,
        total_price: editDeviceForm.total_price,
        installments_count: editDeviceForm.installments_count,
        installment_amount: editDeviceForm.installment_amount,
        customer_code: editDeviceForm.customer_code,
        notes: editDeviceForm.notes,
      }).eq('id', selectedDevice.id);
      if (error) throw error;
      toast({ title: 'تم تعديل بيانات الجهاز' });
      setEditingDevice(false);
      const updated = { ...selectedDevice, ...editDeviceForm } as CustomerDevice;
      setSelectedDevice(updated);
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Print Carnet
  const handlePrintCarnet = () => {
    if (!selectedCustomer || !selectedDevice) {
      toast({ title: 'اختر عميل وجهاز أولاً', variant: 'destructive' });
      return;
    }
    const candles = Array.isArray(selectedDevice.candles) ? selectedDevice.candles : [];
    const printContent = `
      <html dir="rtl"><head><title>كارنيه صيانة - ${selectedCustomer.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
        .header h1 { color: #0066cc; margin: 0; font-size: 22px; }
        .header p { margin: 3px 0; font-size: 12px; color: #666; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; font-size: 13px; }
        .info-item { padding: 5px; background: #f5f5f5; border-radius: 4px; }
        .info-label { color: #666; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: center; }
        th { background: #0066cc; color: white; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <div class="header"><h1>🔵 Clean Water</h1><p>كارنيه صيانة</p></div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">العميل:</span> <strong>${selectedCustomer.name}</strong></div>
        <div class="info-item"><span class="info-label">الهاتف:</span> ${[selectedCustomer.phone1, selectedCustomer.phone2].filter(Boolean).join(' - ')}</div>
        <div class="info-item"><span class="info-label">المنتج:</span> ${selectedDevice.product_name}</div>
        <div class="info-item"><span class="info-label">الكود:</span> ${selectedDevice.customer_code || '-'}</div>
        <div class="info-item"><span class="info-label">تاريخ التركيب:</span> ${formatDateDisplay(selectedDevice.install_date)}</div>
        <div class="info-item"><span class="info-label">الضمان:</span> ${selectedDevice.warranty_months} شهر</div>
        <div class="info-item"><span class="info-label">العنوان:</span> ${selectedCustomer.address}</div>
        <div class="info-item"><span class="info-label">الفرع:</span> ${selectedDevice.branch}</div>
      </div>
      <h3>مواصفات الشمعات</h3>
      <table>
        <thead><tr><th>#</th><th>الشمعة</th><th>النوع</th><th>المدة</th><th>القيمة</th></tr></thead>
        <tbody>${candles.map((c: any, i: number) => `<tr><td>${i + 1}</td><td>${c.name}</td><td>${c.type}</td><td>${c.duration_months} شهر</td><td>${c.price} ج.م</td></tr>`).join('')}</tbody>
      </table>
      <h3>سجل الصيانات</h3>
      <table>
        <thead><tr><th>#</th><th>التاريخ</th><th>ش1</th><th>ش2</th><th>ش3</th><th>ش4</th><th>ش5</th><th>ش6</th><th>ش7</th><th>ش8</th><th>ش9</th><th>ش10</th><th>TDS</th><th>الفني</th><th>القيمة</th></tr></thead>
        <tbody>${candleChanges.map((cc, i) => `<tr><td>${i + 1}</td><td>${formatDateDisplay(cc.change_date)}</td>
          ${[cc.candle1, cc.candle2, cc.candle3, cc.candle4, cc.candle5, cc.candle6, cc.candle7, cc.candle8, cc.candle9, cc.candle10].map(v => `<td>${v ? '✓' : ''}</td>`).join('')}
          <td>${cc.tds_reading || '-'}</td><td>${cc.technician}</td><td>${cc.cost}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">
        <p>Clean Water - الخط الساخن 01210891111</p>
        <p>${companyInfo.branches.join(' | ')}</p>
      </div></body></html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const candleLabels = ['ش1', 'ش2', 'ش3', 'ش4', 'ش5', 'ش6', 'ش7', 'ش8', 'ش9', 'ش10'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {!embedded && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">إدارة الزيارات</h1>
          <div className="flex gap-3 text-xs">
            <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> عملاء: <span className="font-bold">{stats.customers}</span>
            </div>
            <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> مناطق: <span className="font-bold">{stats.regions}</span>
            </div>
            <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> القيمة: <span className="font-bold">{formatEGP(stats.totalValue)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Buttons Row */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'maintenance', label: 'صيانات' },
          { key: 'work_order', label: 'أوامر عمل' },
          { key: 'installment', label: 'أقساط' },
          { key: 'breakdown', label: 'أعطال' },
          { key: 'overdue', label: 'بواقي' },
        ].map(f => (
          <Button key={f.key} size="sm" variant={visitFilter === f.key ? 'default' : 'outline'} onClick={() => setVisitFilter(f.key as VisitFilter)} className="text-xs h-7">
            {f.label}
          </Button>
        ))}
        <div className="mr-auto flex gap-2">
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handlePrintCarnet}>
            <Printer className="h-3 w-3" /> طباعة كارنيه
          </Button>
        </div>
      </div>
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="p-3 text-xs space-y-1">
          <p className="font-bold text-blue-700 dark:text-blue-300">توضيح الفرق:</p>
          <p><strong>أوامر العمل:</strong> كل أمر شغل بيتعمل للعميل من قسم «أوامر العمل» بيظهر هنا — يشمل التركيبات الجديدة والإصلاحات والطلبات الخاصة بأسعارها ومنتجاتها.</p>
          <p><strong>الصيانة:</strong> السجلات الدورية لتغيير الشمعات والأعطال اللي بتتسجل هنا في «إدارة الزيارات» أو من قسم «الصيانة» — تشمل مواعيد الصيانة القادمة وتاريخ الصيانات السابقة.</p>
          <p className="text-muted-foreground">عند تسجيل صيانة أو عطل من هنا، يتم إنشاء أمر عمل مرتبط تلقائياً.</p>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم العميل أو رقم التليفون أو الكود..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) { setSelectedCustomer(null); setSelectedDevice(null); }
              }}
              onFocus={() => setShowDropdown(true)}
              className="pr-9"
            />
            {showDropdown && search && !selectedCustomer && filteredCustomers.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button key={c.id} className="w-full text-right p-3 hover:bg-accent/50 border-b last:border-b-0 transition-colors" onClick={() => selectCustomer(c)}>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone1} • {c.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-muted-foreground text-center py-8">جاري التحميل...</p>}

      {/* Customer Selected View */}
      {selectedCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Right Panel - Customer Info */}
          <div className="lg:col-span-4 space-y-3">
            {/* Customer Details Card */}
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-2"><User className="h-4 w-4" /> بيانات العميل</span>
                  {!editingCustomer ? (
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={startEditCustomer}><Edit className="h-3 w-3" /></Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={saveEditCustomer} disabled={saving}><Save className="h-3 w-3 text-green-600" /></Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEditingCustomer(false)}><X className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {editingCustomer ? (
                  <div className="space-y-1.5">
                    <div><Label className="text-[10px]">الاسم</Label><Input value={editCustomerForm.name || ''} onChange={e => setEditCustomerForm(p => ({...p, name: e.target.value}))} className="h-6 text-xs" /></div>
                    <div><Label className="text-[10px]">الهاتف</Label><Input value={editCustomerForm.phone1 || ''} onChange={e => setEditCustomerForm(p => ({...p, phone1: e.target.value}))} className="h-6 text-xs" /></div>
                    <div><Label className="text-[10px]">هاتف بديل</Label><Input value={editCustomerForm.phone2 || ''} onChange={e => setEditCustomerForm(p => ({...p, phone2: e.target.value}))} className="h-6 text-xs" /></div>
                    <div><Label className="text-[10px]">واتساب</Label><Input value={editCustomerForm.whatsapp || ''} onChange={e => setEditCustomerForm(p => ({...p, whatsapp: e.target.value}))} className="h-6 text-xs" /></div>
                    <div><Label className="text-[10px]">العنوان</Label><Input value={editCustomerForm.address || ''} onChange={e => setEditCustomerForm(p => ({...p, address: e.target.value}))} className="h-6 text-xs" /></div>
                    <div><Label className="text-[10px]">المنطقة</Label><Input value={editCustomerForm.region || ''} onChange={e => setEditCustomerForm(p => ({...p, region: e.target.value}))} className="h-6 text-xs" /></div>
                    <div><Label className="text-[10px]">ملاحظات</Label><Input value={editCustomerForm.notes || ''} onChange={e => setEditCustomerForm(p => ({...p, notes: e.target.value}))} className="h-6 text-xs" /></div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">العميل:</span>
                      <span className="font-bold">{selectedCustomer.name}</span>
                      <span className="text-muted-foreground">الكود:</span>
                      <span>{customerDevices[0]?.customer_code || '-'}</span>
                      <span className="text-muted-foreground">المنطقة:</span>
                      <span>{selectedCustomer.region || '-'}</span>
                      <span className="text-muted-foreground">الفرع:</span>
                      <span>{customerDevices[0]?.branch || '-'}</span>
                      <span className="text-muted-foreground">العنوان:</span>
                      <span className="text-[11px]">{selectedCustomer.address}</span>
                    </div>

                    {/* Phone Numbers */}
                    <div className="border-t pt-2">
                      <Label className="text-[10px] text-muted-foreground mb-1 block">أرقام الهاتف</Label>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1.5 text-[10px] h-6 px-2" asChild>
                          <a href={`tel:${selectedCustomer.phone1}`}><Phone className="h-2.5 w-2.5" /> {selectedCustomer.phone1}</a>
                        </Button>
                        {selectedCustomer.phone2 && (
                          <Button size="sm" variant="outline" className="gap-1.5 text-[10px] h-6 px-2" asChild>
                            <a href={`tel:${selectedCustomer.phone2}`}><Phone className="h-2.5 w-2.5" /> {selectedCustomer.phone2}</a>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Visit Type & Warranty */}
                    <div className="border-t pt-2 space-y-1.5">
                      <div className="flex gap-2">
                        <Button size="sm" variant={visitType === 'زيارة صيانة' ? 'default' : 'outline'} className="text-[10px] h-6 flex-1" onClick={() => setVisitType('زيارة صيانة')}>زيارة صيانة</Button>
                        <Button size="sm" variant={visitType === 'زيارة قسط' ? 'default' : 'outline'} className="text-[10px] h-6 flex-1" onClick={() => setVisitType('زيارة قسط')}>زيارة قسط</Button>
                      </div>
                      {selectedDevice && (
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="bg-muted/50 rounded p-1.5">
                            <span className="text-muted-foreground block">مدة الضمان</span>
                            <span className="font-bold text-sm">{selectedDevice.warranty_months}</span><span className="text-muted-foreground"> شهر</span>
                          </div>
                          <div className="bg-muted/50 rounded p-1.5">
                            <span className="text-muted-foreground block">باقي الضمان</span>
                            <span className="font-bold text-xs">{getWarrantyRemaining(selectedDevice).text}</span>
                          </div>
                          {(() => {
                            const lastChange = lastCandleChangeByDevice[selectedDevice.id]
                              || candleChanges[0]?.change_date?.slice(0, 10);
                            if (!lastChange) return null;
                            const nextDateStr = getNextMaintenanceDateStr(selectedDevice, lastChange);
                            const interval = getMaintenanceIntervalMonths(selectedDevice);
                            const status = maintenanceVisitStatus(nextDateStr);
                            return (
                              <div className={`col-span-2 rounded p-2 border ${status === 'overdue' ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/5 border-primary/20'}`}>
                                <span className="text-muted-foreground block text-[10px]">الصيانة القادمة (كل {interval} شهر)</span>
                                <span className="font-bold text-sm">{formatDateDisplay(nextDateStr)}</span>
                                <span className="text-[10px] text-muted-foreground block mt-0.5">آخر صيانة: {formatDateDisplay(lastChange)}</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="border-t pt-2">
                      <Label className="text-[10px] text-muted-foreground mb-1 block">ملاحظات</Label>
                      <p className="text-xs bg-muted/50 p-2 rounded min-h-[40px]">{selectedCustomer.notes || customerMaintenance[0]?.notes || 'لا توجد ملاحظات'}</p>
                    </div>

                    {/* Last visits */}
                    {customerMaintenance.length > 0 && (
                      <div className="border-t pt-2">
                        <Label className="text-[10px] text-muted-foreground mb-1 block">آخر الزيارات</Label>
                        {customerMaintenance.slice(0, 3).map(m => (
                          <div key={m.id} className="flex justify-between items-center text-[10px] py-0.5">
                            <span>{formatDateDisplay(m.next_date)} - {m.type || 'صيانة'} - {m.technician || 'غير محدد'}</span>
                            <Badge variant={m.status === 'completed' ? 'default' : m.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[8px] h-4">
                              {m.status === 'completed' ? 'تمت' : m.status === 'overdue' ? 'متأخر' : 'إنتظار'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Devices List */}
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="h-4 w-4" /> الأجهزة ({customerDevices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1.5">
                {customerDevices.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">لا توجد أجهزة</p>
                ) : customerDevices.map(dev => (
                  <button
                    key={dev.id}
                    className={`w-full text-right p-2 rounded-md border text-xs transition-colors ${selectedDevice?.id === dev.id ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'}`}
                    onClick={() => selectDevice(dev)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{dev.product_name}</span>
                      <Badge variant={getWarrantyEnd(dev) && getWarrantyEnd(dev)! > new Date() ? 'default' : 'destructive'} className="text-[8px]">
                        {getWarrantyEnd(dev) && getWarrantyEnd(dev)! > new Date() ? 'ضمان' : 'منتهي'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{dev.device_type} • {dev.contract_type} • {dev.branch}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="p-3 space-y-1.5">
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 justify-start" onClick={() => { setShowAddMaint(true); setShowBreakdown(false); setShowContractDetails(false); }}>
                  <Wrench className="h-3 w-3" /> تسجيل صيانة
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 justify-start" onClick={() => { setShowBreakdown(true); setShowAddMaint(false); setShowContractDetails(false); }}>
                  <FileWarning className="h-3 w-3" /> تسجيل عطل
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 justify-start" onClick={() => { setShowAddMaint(true); setShowBreakdown(false); setShowContractDetails(false); }}>
                  <Plus className="h-3 w-3" /> إضافة شمعة
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 justify-start" onClick={() => { setShowContractDetails(!showContractDetails); setShowAddMaint(false); setShowBreakdown(false); }}>
                  <CreditCard className="h-3 w-3" /> بيانات العقد
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 justify-start" onClick={() => { setDetailTab('schedule'); setShowAddMaint(false); setShowBreakdown(false); setShowContractDetails(false); setTimeout(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}>
                  <Clock className="h-3 w-3" /> تسجيلات سابقة
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 justify-start" onClick={handlePrintCarnet}>
                  <Printer className="h-3 w-3" /> طباعة كارنيه
                </Button>
                {selectedDevice && (
                  <Button
                    size="sm" variant="outline"
                    className="w-full text-xs h-7 gap-1 justify-start text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => sendWhatsAppInvoice(selectedCustomer, selectedDevice, maintForm.cost || 0, getNextMaintenanceDate(selectedDevice, maintForm.change_date))}
                  >
                    <MessageCircle className="h-3 w-3" /> إرسال فاتورة واتساب
                  </Button>
                )}
                {selectedDevice && (
                  <Button
                    size="sm" variant="outline"
                    className="w-full text-xs h-7 gap-1 justify-start"
                    onClick={handlePrintInvoice}
                  >
                    <Printer className="h-3 w-3" /> طباعة فاتورة
                  </Button>
                )}
                {customerWorkOrders.length > 0 && (
                  <Button
                    size="sm" variant="outline"
                    className="w-full text-xs h-7 gap-1 justify-start"
                    onClick={() => handlePrintWorkOrder(customerWorkOrders[0])}
                  >
                    <Printer className="h-3 w-3" /> طباعة آخر أمر عمل
                  </Button>
                )}
                {selectedDevice && (
                  <Button
                    size="sm" variant="outline"
                    className="w-full text-xs h-7 gap-1 justify-start"
                    onClick={startEditDevice}
                  >
                    <Edit className="h-3 w-3" /> تعديل بيانات الجهاز
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Left Panel - Device Detail & History */}
          <div className="lg:col-span-8 space-y-3">
            {selectedDevice ? (
              <>
                {/* Device Info Bar */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-3">
                    {editingDevice ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-semibold">تعديل بيانات الجهاز</h4>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={saveEditDevice} disabled={saving}><Save className="h-3 w-3 ml-1" /> حفظ</Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingDevice(false)}><X className="h-3 w-3 ml-1" /> إلغاء</Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><Label className="text-[10px]">المنتج</Label><Input value={editDeviceForm.product_name || ''} onChange={e => setEditDeviceForm(p => ({...p, product_name: e.target.value}))} className="h-6 text-xs" /></div>
                          <div><Label className="text-[10px]">نوع الجهاز</Label><Input value={editDeviceForm.device_type || ''} onChange={e => setEditDeviceForm(p => ({...p, device_type: e.target.value}))} className="h-6 text-xs" /></div>
                          <div><Label className="text-[10px]">الرقم المسلسل</Label><Input value={editDeviceForm.serial_number || ''} onChange={e => setEditDeviceForm(p => ({...p, serial_number: e.target.value}))} className="h-6 text-xs" /></div>
                          <div><Label className="text-[10px]">تاريخ التركيب</Label><Input type="date" value={editDeviceForm.install_date || ''} onChange={e => setEditDeviceForm(p => ({...p, install_date: e.target.value}))} className="h-6 text-xs" /></div>
                          <div><Label className="text-[10px]">مدة الضمان (شهر)</Label><Input type="number" value={editDeviceForm.warranty_months || 0} onChange={e => setEditDeviceForm(p => ({...p, warranty_months: +e.target.value}))} className="h-6 text-xs" /></div>
                          <div><Label className="text-[10px]">نوع العقد</Label>
                            <Select value={editDeviceForm.contract_type || 'كاش'} onValueChange={v => setEditDeviceForm(p => ({...p, contract_type: v}))}>
                              <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="كاش">كاش</SelectItem>
                                <SelectItem value="تقسيط">تقسيط</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div><Label className="text-[10px]">سعر البيع</Label><Input type="number" value={editDeviceForm.selling_price || 0} onChange={e => setEditDeviceForm(p => ({...p, selling_price: +e.target.value}))} className="h-6 text-xs" /></div>
                          <div><Label className="text-[10px]">الإجمالي</Label><Input type="number" value={editDeviceForm.total_price || 0} onChange={e => setEditDeviceForm(p => ({...p, total_price: +e.target.value}))} className="h-6 text-xs" /></div>
                          <div><Label className="text-[10px]">كود العميل</Label><Input value={editDeviceForm.customer_code || ''} onChange={e => setEditDeviceForm(p => ({...p, customer_code: e.target.value}))} className="h-6 text-xs" /></div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        <div><span className="text-muted-foreground block text-[10px]">المنتج</span><span className="font-bold">{selectedDevice.product_name}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">نوع الجهاز</span><span className="font-bold">{selectedDevice.device_type}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">نوع العقد</span><span className="font-bold">{selectedDevice.contract_type}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">كود العميل</span><span className="font-bold">{selectedDevice.customer_code || '-'}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">الفرع</span><span className="font-bold">{selectedDevice.branch}</span></div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contract Details */}
                {showContractDetails && (
                  <Card className="border-primary/30">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> بيانات العقد</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">نوع العقد</span><span className="font-bold">{selectedDevice.contract_type}</span></div>
                        <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">سعر البيع</span><span className="font-bold">{formatEGP(selectedDevice.selling_price)}</span></div>
                        <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">الإجمالي</span><span className="font-bold">{formatEGP(selectedDevice.total_price)}</span></div>
                        <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">تاريخ التركيب</span><span className="font-bold">{formatDateDisplay(selectedDevice.install_date)}</span></div>
                        <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">مدة الضمان</span><span className="font-bold">{selectedDevice.warranty_months} شهر</span></div>
                        <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">حالة الضمان</span>
                          <Badge variant={getWarrantyEnd(selectedDevice) && getWarrantyEnd(selectedDevice)! > new Date() ? 'default' : 'destructive'} className="text-[10px]">
                            {getWarrantyEnd(selectedDevice) && getWarrantyEnd(selectedDevice)! > new Date() ? 'ساري' : 'منتهي'}
                          </Badge>
                        </div>
                        {selectedDevice.contract_type === 'تقسيط' && (
                          <>
                            <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">عدد الأقساط</span><span className="font-bold">{selectedDevice.installments_count}</span></div>
                            <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">قيمة القسط</span><span className="font-bold">{formatEGP(selectedDevice.installment_amount)}</span></div>
                          </>
                        )}
                        <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">الرقم المسلسل</span><span className="font-bold">{selectedDevice.serial_number || '-'}</span></div>
                      </div>
                      {/* Candle Specs */}
                      {selectedDevice.candles && Array.isArray(selectedDevice.candles) && selectedDevice.candles.length > 0 && (
                        <div className="mt-3">
                          <Label className="text-[10px] text-muted-foreground mb-1 block">مواصفات الشمعات</Label>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] border-collapse">
                              <thead><tr className="bg-muted/50"><th className="border p-1 text-right w-6">#</th><th className="border p-1 text-right">الشمعة</th><th className="border p-1 text-right">النوع</th><th className="border p-1 text-right">المدة</th><th className="border p-1 text-right">القيمة</th></tr></thead>
                              <tbody>
                                {selectedDevice.candles.map((c: any, i: number) => (
                                  <tr key={i} className="hover:bg-muted/30"><td className="border p-1 text-center">{i + 1}</td><td className="border p-1">{c.name}</td><td className="border p-1">{c.type}</td><td className="border p-1">{c.duration_months} شهر</td><td className="border p-1">{c.price} ج.م</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Device Details Grid */}
                <Card>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">تاريخ التركيب</span><span className="font-medium">{formatDateDisplay(selectedDevice.install_date)}</span></div>
                      <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">مدة الضمان</span><span className="font-medium">{selectedDevice.warranty_months} شهر</span></div>
                      <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">سعر البيع</span><span className="font-medium">{formatEGP(selectedDevice.selling_price)}</span></div>
                      <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">الإجمالي</span><span className="font-medium">{formatEGP(selectedDevice.total_price)}</span></div>
                      {selectedDevice.contract_type === 'تقسيط' && (
                        <>
                          <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">عدد الأقساط</span><span className="font-medium">{selectedDevice.installments_count}</span></div>
                          <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">قسط كل</span><span className="font-medium">{formatEGP(selectedDevice.installment_amount)}</span></div>
                        </>
                      )}
                      <div className="bg-muted/50 rounded p-2"><span className="text-muted-foreground block text-[10px]">الرقم المسلسل</span><span className="font-medium">{selectedDevice.serial_number || '-'}</span></div>
                    </div>
                    {/* Candle Specs */}
                    {selectedDevice.candles && Array.isArray(selectedDevice.candles) && selectedDevice.candles.length > 0 && (
                      <div className="mt-3">
                        <Label className="text-[10px] text-muted-foreground mb-1 block">مواصفات الشمعات</Label>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px] border-collapse">
                            <thead><tr className="bg-muted/50"><th className="border p-1 text-right w-6">#</th><th className="border p-1 text-right">الشمعة</th><th className="border p-1 text-right">النوع</th><th className="border p-1 text-right">المدة</th><th className="border p-1 text-right">القيمة</th></tr></thead>
                            <tbody>
                              {selectedDevice.candles.map((c: any, i: number) => (
                                <tr key={i} className="hover:bg-muted/30"><td className="border p-1 text-center">{i + 1}</td><td className="border p-1">{c.name}</td><td className="border p-1">{c.type}</td><td className="border p-1">{c.duration_months} شهر</td><td className="border p-1">{c.price} ج.م</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Add Maintenance Form */}
                {showAddMaint && (
                  <Card className="border-primary/30">
                    <CardContent className="p-3 space-y-2">
                      <h4 className="font-semibold text-sm">تسجيل صيانة جديدة</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div><Label className="text-[10px]">التاريخ</Label><Input type="date" value={maintForm.change_date} onChange={e => setMaintForm(p => ({...p, change_date: e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">الفني</Label><Input value={maintForm.technician} onChange={e => setMaintForm(p => ({...p, technician: e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">التكلفة</Label><Input type="number" value={maintForm.cost} onChange={e => setMaintForm(p => ({...p, cost: +e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">المحصل</Label><Input type="number" value={maintForm.collected} onChange={e => setMaintForm(p => ({...p, collected: +e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">TDS</Label><Input value={maintForm.tds_reading} onChange={e => setMaintForm(p => ({...p, tds_reading: e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">ملاحظات</Label><Input value={maintForm.notes} onChange={e => setMaintForm(p => ({...p, notes: e.target.value}))} className="h-7 text-xs" /></div>
                      </div>
                      <div>
                        <Label className="text-[10px] mb-1 block">الشمعات المغيّرة</Label>
                        <div className="flex flex-wrap gap-3">
                          {candleLabels.map((label, i) => {
                            const key = `candle${i + 1}` as keyof typeof maintForm;
                            return (
                              <label key={i} className="flex items-center gap-1 text-xs">
                                <Checkbox checked={maintForm[key] as boolean} onCheckedChange={v => setMaintForm(p => ({...p, [key]: v}))} />
                                {label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveMaintenance} disabled={saving} size="sm" className="flex-1 h-7 text-xs">
                          {saving ? 'جاري الحفظ...' : 'حفظ وإرسال واتساب + فاتورة'}
                        </Button>
                        <Button onClick={() => setShowAddMaint(false)} variant="outline" size="sm" className="h-7 text-xs">إلغاء</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Breakdown Form */}
                {showBreakdown && (
                  <Card className="border-destructive/30">
                    <CardContent className="p-3 space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2"><FileWarning className="h-4 w-4 text-destructive" /> تسجيل عطل جديد</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div><Label className="text-[10px]">التاريخ</Label><Input type="date" value={breakdownForm.next_date} onChange={e => setBreakdownForm(p => ({...p, next_date: e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">الفني</Label><Input value={breakdownForm.technician} onChange={e => setBreakdownForm(p => ({...p, technician: e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">التكلفة</Label><Input type="number" value={breakdownForm.cost} onChange={e => setBreakdownForm(p => ({...p, cost: +e.target.value}))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">الهاتف</Label><Input value={breakdownForm.phone || selectedCustomer.phone1} onChange={e => setBreakdownForm(p => ({...p, phone: e.target.value}))} className="h-7 text-xs" /></div>
                        <div className="col-span-2"><Label className="text-[10px]">وصف العطل</Label><Input value={breakdownForm.notes} onChange={e => setBreakdownForm(p => ({...p, notes: e.target.value}))} className="h-7 text-xs" placeholder="اكتب وصف العطل هنا..." /></div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveBreakdown} disabled={saving} size="sm" variant="destructive" className="flex-1 h-7 text-xs">
                          {saving ? 'جاري الحفظ...' : 'تسجيل العطل'}
                        </Button>
                        <Button onClick={() => setShowBreakdown(false)} variant="outline" size="sm" className="h-7 text-xs">إلغاء</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* History Tabs */}
                <Card ref={historyRef}>
                  <CardContent className="p-3">
                    <Tabs value={detailTab} onValueChange={setDetailTab}>
                      <TabsList className="w-full grid grid-cols-5 h-7">
                        <TabsTrigger value="schedule" className="text-[10px] py-0">المواعيد</TabsTrigger>
                        <TabsTrigger value="maintenance" className="text-[10px] py-0">بيان الصيانات</TabsTrigger>
                        <TabsTrigger value="breakdowns" className="text-[10px] py-0">بيان الأعطال</TabsTrigger>
                        <TabsTrigger value="remaining" className="text-[10px] py-0">بيان البواقي</TabsTrigger>
                        <TabsTrigger value="installments" className="text-[10px] py-0">الأقساط</TabsTrigger>
                      </TabsList>

                      <TabsContent value="schedule" className="mt-2">
                        {customerSchedule.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">لا توجد مواعيد صيانة أو أوامر عمل</p>
                        ) : (
                          <div className="space-y-2">
                            {customerSchedule.map((item) => {
                              const wo = item.source === 'work_order' ? workOrders.find(w => `workorder-${w.id}` === item.id) : null;
                              return (
                              <Card key={item.id}>
                                <CardContent className="p-2 text-xs flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-medium">
                                      {item.source === 'maintenance' ? 'صيانة' : 'أمر عمل'} - {item.label}
                                    </p>
                                    <p className="text-muted-foreground">{formatDateDisplay(item.date)} • {item.technician || 'غير محدد'}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {wo && (
                                      <>
                                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => handlePrintWorkOrder(wo)} title="طباعة أمر العمل">
                                          <Printer className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={(e) => deleteWorkOrderVisit(wo, e)} title="حذف أمر العمل">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                    <Badge variant={item.source === 'maintenance' ? 'secondary' : 'outline'} className="text-[10px]">
                                      {item.source === 'maintenance' ? 'صيانة' : 'زيارة'}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                              );
                            })}
                          </div>
                        )}
                      </TabsContent>

                      {/* Maintenance History Table - EDITABLE */}
                      <TabsContent value="maintenance" className="mt-2">
                        {candleChanges.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">لا توجد سجلات صيانة</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] border-collapse">
                              <thead>
                                <tr className="bg-primary/10">
                                  <th className="border p-1">#</th>
                                  <th className="border p-1">التاريخ</th>
                                  <th className="border p-1">ش1</th><th className="border p-1">ش2</th><th className="border p-1">ش3</th>
                                  <th className="border p-1">ش4</th><th className="border p-1">ش5</th><th className="border p-1">ش6</th><th className="border p-1">ش7</th>
                                  <th className="border p-1">ش8</th><th className="border p-1">ش9</th><th className="border p-1">ش10</th>
                                  <th className="border p-1">TDS</th><th className="border p-1">الفني</th>
                                  <th className="border p-1">القيمة</th><th className="border p-1">محصل</th><th className="border p-1">باقي</th><th className="border p-1">ملاحظات</th>
                                  <th className="border p-1">إجراء</th>
                                </tr>
                              </thead>
                              <tbody>
                                {candleChanges.map((cc, i) => (
                                  editingMaintId === cc.id ? (
                                    <tr key={cc.id} className="bg-primary/5">
                                      <td className="border p-1 text-center">{i + 1}</td>
                                      <td className="border p-1"><Input type="date" value={editMaintForm.change_date || ''} onChange={e => setEditMaintForm(p => ({...p, change_date: e.target.value}))} className="h-5 text-[10px] w-24" /></td>
                                      {candleLabels.map((_, j) => {
                                        const key = `candle${j + 1}` as keyof CandleChange;
                                        return <td key={j} className="border p-1 text-center"><Checkbox checked={editMaintForm[key] as boolean} onCheckedChange={v => setEditMaintForm(p => ({...p, [key]: v}))} /></td>;
                                      })}
                                      <td className="border p-1"><Input value={editMaintForm.tds_reading || ''} onChange={e => setEditMaintForm(p => ({...p, tds_reading: e.target.value}))} className="h-5 text-[10px] w-12" /></td>
                                      <td className="border p-1"><Input value={editMaintForm.technician || ''} onChange={e => setEditMaintForm(p => ({...p, technician: e.target.value}))} className="h-5 text-[10px] w-16" /></td>
                                      <td className="border p-1"><Input type="number" value={editMaintForm.cost || 0} onChange={e => setEditMaintForm(p => ({...p, cost: +e.target.value}))} className="h-5 text-[10px] w-14" /></td>
                                      <td className="border p-1"><Input type="number" value={editMaintForm.collected || 0} onChange={e => setEditMaintForm(p => ({...p, collected: +e.target.value}))} className="h-5 text-[10px] w-14" /></td>
                                      <td className="border p-1 text-center font-bold">{(editMaintForm.cost || 0) - (editMaintForm.collected || 0)}</td>
                                      <td className="border p-1"><Input value={String(editMaintForm.notes || '')} onChange={e => setEditMaintForm(p => ({...p, notes: e.target.value}))} className="h-5 text-[10px] w-24" /></td>
                                      <td className="border p-1">
                                        <div className="flex gap-0.5">
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={saveEditMaint} disabled={saving}><Save className="h-3 w-3 text-green-600" /></Button>
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEditingMaintId(null)}><X className="h-3 w-3 text-destructive" /></Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    <tr key={cc.id} className={`hover:bg-muted/30 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                                      <td className="border p-1 text-center">{i + 1}</td>
                                      <td className="border p-1 font-medium">{formatDateDisplay(cc.change_date)}</td>
                                      {[cc.candle1, cc.candle2, cc.candle3, cc.candle4, cc.candle5, cc.candle6, cc.candle7, cc.candle8, cc.candle9, cc.candle10].map((v, j) => (
                                        <td key={j} className="border p-1 text-center">{v ? <span className="text-green-600 font-bold">تمت</span> : ''}</td>
                                      ))}
                                      <td className="border p-1 text-center">{cc.tds_reading || '-'}</td>
                                      <td className="border p-1">{cc.technician}</td>
                                      <td className="border p-1 text-center">{cc.cost}</td>
                                      <td className="border p-1 text-center">{cc.collected}</td>
                                      <td className="border p-1 text-center font-bold">{cc.remaining > 0 ? cc.remaining : 0}</td>
                                      <td className="border p-1 text-center">{cc.notes || '-'}</td>
                                      <td className="border p-1 text-center">
                                        <div className="flex items-center justify-center gap-0.5">
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => startEditMaint(cc)}><Edit className="h-3 w-3" /></Button>
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => deleteMaintRecord(cc)}><Trash2 className="h-3 w-3" /></Button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </TabsContent>

                      {/* Breakdowns - EDITABLE */}
                      <TabsContent value="breakdowns" className="mt-2">
                        {customerMaintenance.filter(m => m.type === 'عطل' || m.status === 'overdue').length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">لا توجد أعطال مسجلة</p>
                        ) : customerMaintenance.filter(m => m.type === 'عطل' || m.status === 'overdue').map(m => (
                          editingBreakdownId === m.id ? (
                            <Card key={m.id} className="mb-2 border-primary/30">
                              <CardContent className="p-2 space-y-1.5">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                  <div><Label className="text-[10px]">التاريخ</Label><Input type="date" value={editBreakdownForm.next_date || ''} onChange={e => setEditBreakdownForm((p: any) => ({...p, next_date: e.target.value}))} className="h-6 text-xs" /></div>
                                  <div><Label className="text-[10px]">الفني</Label><Input value={editBreakdownForm.technician || ''} onChange={e => setEditBreakdownForm((p: any) => ({...p, technician: e.target.value}))} className="h-6 text-xs" /></div>
                                  <div><Label className="text-[10px]">التكلفة</Label><Input type="number" value={editBreakdownForm.cost || 0} onChange={e => setEditBreakdownForm((p: any) => ({...p, cost: +e.target.value}))} className="h-6 text-xs" /></div>
                                  <div><Label className="text-[10px]">الهاتف</Label><Input value={editBreakdownForm.phone || ''} onChange={e => setEditBreakdownForm((p: any) => ({...p, phone: e.target.value}))} className="h-6 text-xs" /></div>
                                  <div><Label className="text-[10px]">الحالة</Label>
                                    <Select value={editBreakdownForm.status || 'upcoming'} onValueChange={v => setEditBreakdownForm((p: any) => ({...p, status: v}))}>
                                      <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="upcoming">قادم</SelectItem>
                                        <SelectItem value="completed">تم</SelectItem>
                                        <SelectItem value="overdue">متأخر</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div><Label className="text-[10px]">ملاحظات</Label><Input value={editBreakdownForm.notes || ''} onChange={e => setEditBreakdownForm((p: any) => ({...p, notes: e.target.value}))} className="h-6 text-xs" /></div>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-6 text-xs flex-1" onClick={saveEditBreakdown} disabled={saving}>حفظ</Button>
                                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setEditingBreakdownId(null)}>إلغاء</Button>
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <Card key={m.id} className="mb-2">
                              <CardContent className="p-2 text-xs flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{m.type} - {m.product_name}</p>
                                  <p className="text-muted-foreground">{formatDateDisplay(m.next_date)} • {m.technician || 'غير محدد'}</p>
                                  {m.notes && <p className="text-muted-foreground mt-0.5">{m.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                  {m.cost > 0 && <p className="font-medium">{formatEGP(m.cost)}</p>}
                                  <Badge variant="destructive" className="text-[8px] h-4">{m.status}</Badge>
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => startEditBreakdown(m)}><Edit className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => deleteBreakdown(m)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        ))}
                      </TabsContent>

                      {/* Remaining - EDITABLE */}
                      <TabsContent value="remaining" className="mt-2">
                        {candleChanges.filter(cc => cc.remaining > 0).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">لا توجد بواقي</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-destructive/10">
                                  <th className="border p-1">التاريخ</th><th className="border p-1">القيمة</th><th className="border p-1">المحصل</th><th className="border p-1">الباقي</th><th className="border p-1">الفني</th><th className="border p-1">إجراء</th>
                                </tr>
                              </thead>
                              <tbody>
                                {candleChanges.filter(cc => cc.remaining > 0).map(cc => (
                                  <tr key={cc.id}>
                                    <td className="border p-1">{formatDateDisplay(cc.change_date)}</td>
                                    <td className="border p-1">{cc.cost}</td>
                                    <td className="border p-1">{cc.collected}</td>
                                    <td className="border p-1 font-bold text-destructive">{cc.remaining}</td>
                                    <td className="border p-1">{cc.technician}</td>
                                    <td className="border p-1 text-center">
                                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => startEditMaint(cc)}><Edit className="h-3 w-3" /></Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </TabsContent>

                      {/* Installments - EDITABLE */}
                      <TabsContent value="installments" className="mt-2">
                        {selectedDevice.contract_type !== 'تقسيط' ? (
                          <p className="text-xs text-muted-foreground text-center py-4">هذا الجهاز كاش</p>
                        ) : installments.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">لا توجد أقساط</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-primary/10">
                                  <th className="border p-1">#</th><th className="border p-1">التاريخ</th><th className="border p-1">الدفعة</th><th className="border p-1">التحصيل</th><th className="border p-1">الحالة</th><th className="border p-1">إجراء</th>
                                </tr>
                              </thead>
                              <tbody>
                                {installments.map((inst: any, i: number) => (
                                  editingInstallmentId === inst.id ? (
                                    <tr key={inst.id} className="bg-primary/5">
                                      <td className="border p-1 text-center">{i + 1}</td>
                                      <td className="border p-1"><Input type="date" value={editInstallmentForm.installment_date || ''} onChange={e => setEditInstallmentForm((p: any) => ({...p, installment_date: e.target.value}))} className="h-5 text-[10px] w-28" /></td>
                                      <td className="border p-1"><Input type="number" value={editInstallmentForm.amount || 0} onChange={e => setEditInstallmentForm((p: any) => ({...p, amount: +e.target.value}))} className="h-5 text-[10px] w-16" /></td>
                                      <td className="border p-1"><Input type="date" value={editInstallmentForm.collection_date || ''} onChange={e => setEditInstallmentForm((p: any) => ({...p, collection_date: e.target.value}))} className="h-5 text-[10px] w-28" /></td>
                                      <td className="border p-1">
                                        <Select value={editInstallmentForm.status || 'معلق'} onValueChange={v => setEditInstallmentForm((p: any) => ({...p, status: v}))}>
                                          <SelectTrigger className="h-5 text-[10px]"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="معلق">معلق</SelectItem>
                                            <SelectItem value="تمت">تمت</SelectItem>
                                            <SelectItem value="متأخر">متأخر</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </td>
                                      <td className="border p-1">
                                        <div className="flex gap-0.5">
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={saveEditInstallment} disabled={saving}><Save className="h-3 w-3 text-green-600" /></Button>
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEditingInstallmentId(null)}><X className="h-3 w-3 text-destructive" /></Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    <tr key={inst.id} className={inst.status === 'تمت' ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                                      <td className="border p-1 text-center">{i + 1}</td>
                                      <td className="border p-1">{formatDateDisplay(inst.installment_date)}</td>
                                      <td className="border p-1">{formatEGP(inst.amount)}</td>
                                      <td className="border p-1">{inst.collection_date ? formatDateDisplay(inst.collection_date) : '-'}</td>
                                      <td className="border p-1 text-center">
                                        <Badge variant={inst.status === 'تمت' ? 'default' : 'secondary'} className="text-[8px] h-4">{inst.status}</Badge>
                                      </td>
                                      <td className="border p-1 text-center">
                                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => startEditInstallment(inst)}><Edit className="h-3 w-3" /></Button>
                                      </td>
                                    </tr>
                                  )
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Monitor className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">اختر جهاز من القائمة لعرض بيان الصيانات والأقساط</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* No customer selected */}
      {!selectedCustomer && !loading && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">كل الزيارات</p>
                <p className="text-xs text-muted-foreground">يمكنك اختيار أي زيارة من القائمة أو استخدام البحث</p>
              </div>
              <Badge variant="outline">{allVisits.length} زيارة</Badge>
            </CardContent>
          </Card>

          {allVisits.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium mb-1">لا توجد زيارات حالياً</p>
                <p className="text-sm">غيّر الفلتر أو استخدم البحث للعثور على زيارة محددة</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allVisits.map((visit) => {
                const matchedCustomer = customers.find(
                  (customer) => customer.name === visit.customer_name || customer.phone1 === visit.phone
                );
                const wo = visit.source === 'work_order' ? workOrders.find(w => `workorder-${w.id}` === visit.id) : null;

                return (
                  <Card
                    key={visit.id}
                    className="cursor-pointer hover:bg-accent/40 transition-colors"
                    onClick={() => {
                      if (matchedCustomer) {
                        selectCustomer(matchedCustomer);
                      } else {
                        setSearch(visit.customer_name);
                        setShowDropdown(true);
                      }
                    }}
                  >
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{visit.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {visit.product_name || 'بدون منتج'} • {visit.label} • {formatDateDisplay(visit.date)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {visit.phone || 'بدون هاتف'} • {visit.technician || 'فني غير محدد'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          {wo && (
                            <>
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); handlePrintWorkOrder(wo); }} title="طباعة">
                                <Printer className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={(e) => deleteWorkOrderVisit(wo, e)} title="حذف">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Badge variant={visit.source === 'maintenance' ? 'secondary' : 'outline'} className="text-[10px]">
                            {visit.source === 'maintenance' ? 'صيانة' : 'أمر عمل'}
                          </Badge>
                        </div>
                        <Badge
                          variant={
                            visit.status === 'overdue'
                              ? 'destructive'
                              : visit.status === 'completed'
                                ? 'default'
                                : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {visit.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
