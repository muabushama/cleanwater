import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plus, Search, Edit, Trash2, Factory, MapPin, User, Calendar, Wrench,
  Phone, ShieldCheck, DollarSign, ClipboardList, Eye, Package,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkOrdersPage from '@/pages/WorkOrdersPage';
import { promptDeletePassword } from '@/lib/deletePassword';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { formatDateDayMonthYear } from '@/lib/dateDisplay';
import { ProductSearchCombobox } from '@/components/inventory/ProductSearchCombobox';
import { joinWorkOrderPhoneFields, splitWorkOrderPhoneFields } from '@/lib/workOrderPrintPhones';
import { invoiceCustomerCredit, invoiceDebtRemaining } from '@/lib/invoiceBalance';

interface Station {
  id: string;
  name: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  area?: string | null;
  address?: string | null;
  station_type?: string | null;
  capacity?: string | null;
  install_date?: string | null;
  contract_type?: string | null;
  contract_value?: number | null;
  contract_duration_months?: number | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contract_first_visit_date?: string | null;
  contract_installments_count?: number | null;
  contract_installment_interval_months?: number | null;
  contract_first_installment_date?: string | null;
  warranty_months?: number | null;
  warranty_end?: string | null;
  status?: string | null;
  notes?: string | null;
  branch?: string;
  created_at?: string;
}

interface MaintenanceRecord {
  id: string;
  station_id: string;
  maintenance_date: string;
  maintenance_type: string;
  description: string;
  parts_used: string;
  parts_cost: number;
  labor_cost: number;
  total_cost: number;
  total_sale?: number;
  collected: number;
  product_lines?: StationMaintenanceProductLine[] | null;
  changed_candles?: number[] | null;
  technician: string;
  notes: string;
  branch: string;
  created_at: string;
}

interface StationMaintenanceProductLine {
  product_id: string;
  product_name: string;
  qty: number | string;
  unit_cost: number | string;
  unit_sale_price: number | string;
}

interface StationFinancialSummary {
  totalCost: number;
  totalRevenue: number;
  collected: number;
  due: number;
  credit: number;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  cost: number;
  storage_location?: string | null;
}

interface StationContractInstallment {
  id: string;
  station_id: string;
  installment_date: string;
  amount: number;
  status: string;
  collection_date?: string | null;
}

function stripUnknownColumnFromPayload(errorMessage: string, payload: Record<string, unknown>): boolean {
  const msg = String(errorMessage || '');
  const matched = msg.match(/Unknown column '([^']+)'/i)?.[1];
  if (!matched) return false;
  if (!(matched in payload)) return false;
  delete payload[matched];
  return true;
}

async function retryWithUnknownColumnStripping(
  run: (payload: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>,
  payload: Record<string, unknown>,
) {
  // بعض البيئات ينقصها أكثر من عمود؛ نجرب الحذف وإعادة التنفيذ أكثر من مرة
  for (let i = 0; i < 8; i += 1) {
    const res = await run(payload);
    if (!res.error) return { error: null };
    const removed = stripUnknownColumnFromPayload(String(res.error.message || ''), payload);
    if (!removed) return res;
  }
  return { error: { message: 'تعذّر الحفظ بسبب اختلاف أعمدة قاعدة البيانات.' } };
}

const formatDateDisplay = (v: any) => formatDateDayMonthYear(v);
const STATION_META_MARKER = '__OASIS_STATION_DATA__=';

function stationNotesWithoutMeta(notes?: string | null): string {
  return String(notes || '')
    .split('\n')
    .filter((line) => !line.trim().startsWith(STATION_META_MARKER))
    .join('\n')
    .trim();
}

function stationMetaFromNotes(notes?: string | null): Partial<Station> {
  const line = String(notes || '')
    .split('\n')
    .find((x) => x.trim().startsWith(STATION_META_MARKER));
  if (!line) return {};
  try {
    const raw = line.trim().slice(STATION_META_MARKER.length);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function stationWithSavedMeta(station: Station): Station {
  const meta = stationMetaFromNotes(station.notes);
  return {
    ...station,
    ...meta,
    notes: stationNotesWithoutMeta(station.notes),
  };
}

function stationNotesWithMeta(userNotes: string, payload: Record<string, unknown>): string {
  const metaKeys = [
    'name',
    'customer_name',
    'customer_phone',
    'customer_address',
    'area',
    'address',
    'station_type',
    'capacity',
    'install_date',
    'contract_type',
    'contract_value',
    'contract_duration_months',
    'contract_start_date',
    'contract_end_date',
    'contract_first_visit_date',
    'contract_installments_count',
    'contract_installment_interval_months',
    'contract_first_installment_date',
    'warranty_months',
    'warranty_end',
    'status',
  ];
  const meta = metaKeys.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = payload[key] ?? null;
    return acc;
  }, {});
  const cleanNotes = stationNotesWithoutMeta(userNotes);
  const metaLine = `${STATION_META_MARKER}${JSON.stringify(meta)}`;
  return [cleanNotes, metaLine].filter(Boolean).join('\n');
}

const emptyForm = {
  name: '',
  customer_name: '',
  customer_phone: '',
  customer_phone2: '',
  customer_phone3: '',
  customer_address: '',
  area: '',
  address: '',
  station_type: 'تحلية',
  capacity: '',
  install_date: '',
  contract_type: 'بدون عقد',
  contract_value: '0',
  contract_duration_months: '12',
  contract_start_date: '',
  contract_end_date: '',
  contract_first_visit_date: '',
  contract_installments_count: '0',
  contract_installment_interval_months: '1',
  contract_first_installment_date: '',
  warranty_months: '12',
  warranty_end: '',
  status: 'نشطة',
  notes: '',
};

const emptyMaintForm = {
  maintenance_date: new Date().toISOString().slice(0, 10),
  maintenance_type: 'صيانة دورية',
  description: '',
  parts_used: '',
  labor_cost: '0',
  collected: '0',
  technician: '',
  notes: '',
};

export default function StationsPage() {
  const { branch } = useUserBranch();
  const { toast } = useToast();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editStation, setEditStation] = useState<Station | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [detailStation, setDetailStation] = useState<Station | null>(null);
  const [maintRecords, setMaintRecords] = useState<MaintenanceRecord[]>([]);
  const [contractInstallments, setContractInstallments] = useState<StationContractInstallment[]>([]);
  const [maintLoading, setMaintLoading] = useState(false);

  const [maintOpen, setMaintOpen] = useState(false);
  const [editingMaint, setEditingMaint] = useState<MaintenanceRecord | null>(null);
  const [maintForm, setMaintForm] = useState(emptyMaintForm);
  const [maintSaving, setMaintSaving] = useState(false);
  const [contractInstallmentSavingId, setContractInstallmentSavingId] = useState<string | null>(null);
  const [rebuildingInstallments, setRebuildingInstallments] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [maintenanceProductLines, setMaintenanceProductLines] = useState<StationMaintenanceProductLine[]>([
    { product_id: '', product_name: '', qty: '1', unit_cost: '0', unit_sale_price: '0' },
  ]);
  const [changedCandles, setChangedCandles] = useState<number[]>([]);
  const [stationFinancials, setStationFinancials] = useState<Record<string, StationFinancialSummary>>({});

  const fetchStations = async () => {
    setLoading(true);
    const bv = branchDbValuesForUiBranch(branch);
    const [stRes, prodRes, maintRes] = await Promise.all([
      supabase.from('stations').select('*').in('branch', bv).order('created_at', { ascending: false }).limit(1000),
      supabase.from('products').select('id,name,stock,price,cost,storage_location').in('branch', bv).limit(2000),
      supabase.from('station_maintenance').select('station_id,total_cost,total_sale,collected').in('branch', bv).limit(5000),
    ]);
    if (stRes.error) {
      console.warn('[stations] fetch error:', stRes.error.message);
      setStations([]);
    } else {
      setStations(((stRes.data || []) as Station[]).map(stationWithSavedMeta));
    }
    if (Array.isArray(prodRes.data)) setProducts(prodRes.data as Product[]);
    const summaries: Record<string, StationFinancialSummary> = {};
    for (const row of (Array.isArray(maintRes.data) ? maintRes.data : []) as any[]) {
      const stationId = String(row.station_id || '');
      if (!stationId) continue;
      const current = summaries[stationId] || { totalCost: 0, totalRevenue: 0, collected: 0, due: 0, credit: 0 };
      const cost = Number(row.total_cost) || 0;
      const sale = Number(row.total_sale) || 0;
      current.totalCost += cost;
      current.totalRevenue += sale;
      current.collected += Number(row.collected) || 0;
      summaries[stationId] = current;
    }
    Object.values(summaries).forEach((summary) => {
      summary.due = invoiceDebtRemaining(summary.totalRevenue, summary.collected);
      summary.credit = invoiceCustomerCredit(summary.totalRevenue, summary.collected);
    });
    setStationFinancials(summaries);
    setLoading(false);
  };

  useEffect(() => { fetchStations(); }, [branch]);

  const fetchMaintenance = async (stationId: string) => {
    setMaintLoading(true);
    const maintRes = await supabase
      .from('station_maintenance')
      .select('*')
      .eq('station_id', stationId)
      .order('maintenance_date', { ascending: false })
      .limit(200);
    let contractRes: { data?: unknown } = { data: [] };
    try {
      contractRes = await (supabase as any)
        .from('station_contract_installments')
        .select('*')
        .eq('station_id', stationId)
        .order('installment_date', { ascending: true })
        .limit(200);
    } catch {
      contractRes = { data: [] };
    }
    setMaintRecords(Array.isArray(maintRes.data) ? (maintRes.data as MaintenanceRecord[]) : []);
    setContractInstallments(Array.isArray(contractRes?.data) ? (contractRes.data as StationContractInstallment[]) : []);
    setMaintLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.customer_name || '').toLowerCase().includes(q) ||
        (s.customer_phone || '').includes(q) ||
        (s.area || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q),
    );
  }, [stations, search]);

  const openAdd = () => { setEditStation(null); setForm(emptyForm); setAddOpen(true); };

  const openEdit = (s: Station) => {
    const station = stationWithSavedMeta(s);
    const phones = splitWorkOrderPhoneFields(station.customer_phone || '');
    setEditStation(station);
    setForm({
      ...emptyForm,
      name: station.name || '',
      customer_name: station.customer_name || '',
      customer_phone: phones.phone,
      customer_phone2: phones.phone2,
      customer_phone3: phones.phone3,
      customer_address: station.customer_address || '',
      area: station.area || '',
      address: station.address || '',
      station_type: station.station_type || 'تحلية',
      capacity: station.capacity || '',
      install_date: station.install_date || '',
      contract_type: station.contract_type || 'بدون عقد',
      contract_value: String(station.contract_value ?? 0),
      contract_duration_months: String(station.contract_duration_months ?? 12),
      contract_start_date: station.contract_start_date || '',
      contract_end_date: station.contract_end_date || '',
      contract_first_visit_date: station.contract_first_visit_date || '',
      contract_installments_count: String(station.contract_installments_count ?? 0),
      contract_installment_interval_months: String(station.contract_installment_interval_months ?? 1),
      contract_first_installment_date: station.contract_first_installment_date || '',
      warranty_months: String(station.warranty_months ?? 12),
      warranty_end: station.warranty_end || '',
      status: station.status || 'نشطة',
      notes: stationNotesWithoutMeta(station.notes),
    });
    setAddOpen(true);
  };

  const openDetail = (s: Station) => {
    setDetailStation(stationWithSavedMeta(s));
    fetchMaintenance(s.id);
  };

  const calcWarrantyEnd = (installDate: string, months: number): string => {
    if (!installDate) return '';
    const d = new Date(installDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  };

  const calcContractEnd = (startDate: string, months: number): string => {
    if (!startDate) return '';
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + Math.max(0, months || 0));
    return d.toISOString().slice(0, 10);
  };

  const isWarrantyActive = (warrantyEnd: string | null | undefined): boolean => {
    if (!warrantyEnd) return false;
    return warrantyEnd >= new Date().toISOString().slice(0, 10);
  };

  const ensureStationContractInstallments = async (stationId: string, data: typeof form) => {
    if ((data.contract_type || 'بدون عقد') !== 'عقد صيانة') return;
    const contractValue = Number(data.contract_value) || 0;
    const installmentsCount = Math.max(0, Number(data.contract_installments_count) || 0);
    if (contractValue <= 0 || installmentsCount <= 0) return;

    let existingRes: { data?: unknown } = { data: [] };
    try {
      existingRes = await (supabase as any)
        .from('station_contract_installments')
        .select('id')
        .eq('station_id', stationId)
        .limit(1);
    } catch {
      existingRes = { data: [] };
    }
    if (Array.isArray(existingRes?.data) && existingRes.data.length > 0) return;

    const firstDate = data.contract_first_installment_date || data.contract_start_date || data.install_date;
    if (!firstDate) return;
    const intervalMonths = Math.max(1, Number(data.contract_installment_interval_months) || 1);
    const baseAmount = Math.floor((contractValue / installmentsCount) * 100) / 100;
    const totalBase = baseAmount * installmentsCount;
    const remainder = Math.round((contractValue - totalBase) * 100) / 100;
    const rows = Array.from({ length: installmentsCount }, (_, index) => {
      const d = new Date(firstDate);
      d.setMonth(d.getMonth() + index * intervalMonths);
      const amount = index === installmentsCount - 1 ? baseAmount + remainder : baseAmount;
      return {
        id: crypto.randomUUID(),
        station_id: stationId,
        installment_date: d.toISOString().slice(0, 10),
        amount,
        status: 'معلق',
        collection_date: null,
      };
    });
    try {
      const { error } = await (supabase as any).from('station_contract_installments').insert(rows as any);
      if (error) throw error;
    } catch (err: any) {
      console.warn('[stations] ensure installments failed:', err?.message || err);
      toast({
        title: 'تعذر إنشاء أقساط العقد تلقائياً',
        description: err?.message || 'تحقق من صلاحية جدول الأقساط ثم استخدم «إعادة إنشاء الأقساط».',
        variant: 'destructive',
      });
    }
  };

  const rebuildStationContractInstallments = async (station: Station) => {
    const contractType = station.contract_type || 'بدون عقد';
    const contractValue = Number(station.contract_value) || 0;
    const installmentsCount = Math.max(0, Number(station.contract_installments_count) || 0);
    if (contractType !== 'عقد صيانة') {
      toast({ title: 'لا يوجد عقد صيانة', description: 'حوّل المحطة إلى عقد صيانة أولاً.', variant: 'destructive' });
      return;
    }
    if (contractValue <= 0 || installmentsCount <= 0) {
      toast({ title: 'بيانات العقد ناقصة', description: 'أدخل قيمة العقد وعدد الأقساط أولاً.', variant: 'destructive' });
      return;
    }
    const firstDate = station.contract_first_installment_date || station.contract_start_date || station.install_date;
    if (!firstDate) {
      toast({ title: 'تاريخ البداية مطلوب', description: 'أدخل تاريخ أول قسط أو بداية العقد.', variant: 'destructive' });
      return;
    }
    if (contractInstallments.length > 0 && !window.confirm('إعادة الإنشاء ستحذف قيم الأقساط المخصصة الحالية وتعيد تقسيم قيمة العقد بالتساوي. هل تريد المتابعة؟')) {
      return;
    }
    setRebuildingInstallments(true);
    try {
      await (supabase as any).from('station_contract_installments').delete().eq('station_id', station.id);
      const intervalMonths = Math.max(1, Number(station.contract_installment_interval_months) || 1);
      const baseAmount = Math.floor((contractValue / installmentsCount) * 100) / 100;
      const totalBase = baseAmount * installmentsCount;
      const remainder = Math.round((contractValue - totalBase) * 100) / 100;
      const rows = Array.from({ length: installmentsCount }, (_, index) => {
        const d = new Date(firstDate);
        d.setMonth(d.getMonth() + index * intervalMonths);
        const amount = index === installmentsCount - 1 ? baseAmount + remainder : baseAmount;
        return {
          id: crypto.randomUUID(),
          station_id: station.id,
          installment_date: d.toISOString().slice(0, 10),
          amount,
          status: 'معلق',
          collection_date: null,
        };
      });
      const { error } = await (supabase as any).from('station_contract_installments').insert(rows as any);
      if (error) throw error;
      await fetchMaintenance(station.id);
      toast({ title: 'تمت إعادة إنشاء أقساط العقد' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setRebuildingInstallments(false);
    }
  };

  const toggleStationContractInstallmentStatus = async (inst: StationContractInstallment) => {
    try {
      setContractInstallmentSavingId(inst.id);
      const done = inst.status === 'تمت' || inst.status === 'مدفوع';
      const collectionDate = done ? null : new Date().toISOString().slice(0, 10);
      const { error } = await (supabase as any)
        .from('station_contract_installments')
        .update({
          status: done ? 'معلق' : 'تمت',
          collection_date: collectionDate,
        } as any)
        .eq('id', inst.id);
      if (error) throw error;

      if (detailStation?.id) await fetchMaintenance(detailStation.id);
      toast({
        title: done ? 'تم إرجاع القسط إلى معلق' : 'تم تسجيل القسط كمدفوع',
        description: 'أقساط العقد منفصلة ولا تدخل ضمن إيراد أو تحصيل المحطة.',
      });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setContractInstallmentSavingId(null);
    }
  };

  const updateStationContractInstallmentAmount = async (inst: StationContractInstallment) => {
    const entered = window.prompt('قيمة القسط الجديدة:', String(Number(inst.amount) || 0));
    if (entered === null) return;
    const amount = Number(entered);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: 'قيمة غير صحيحة', description: 'أدخل قيمة صفر أو أكبر.', variant: 'destructive' });
      return;
    }
    try {
      setContractInstallmentSavingId(inst.id);
      const { error } = await (supabase as any)
        .from('station_contract_installments')
        .update({ amount } as any)
        .eq('id', inst.id);
      if (error) throw error;
      if (detailStation?.id) await fetchMaintenance(detailStation.id);
      toast({ title: 'تم تعديل قيمة القسط' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setContractInstallmentSavingId(null);
    }
  };

  const updateStationContractCollectionDate = async (inst: StationContractInstallment) => {
    const nextDate = window.prompt(
      'تاريخ التحصيل الجديد (YYYY-MM-DD):',
      String(inst.collection_date || new Date().toISOString().slice(0, 10)),
    );
    if (!nextDate) return;
    try {
      setContractInstallmentSavingId(inst.id);
      const { error } = await (supabase as any)
        .from('station_contract_installments')
        .update({
          collection_date: nextDate,
          status: (inst.status === 'تمت' || inst.status === 'مدفوع') ? inst.status : 'تمت',
        } as any)
        .eq('id', inst.id);
      if (error) throw error;
      if (detailStation?.id) await fetchMaintenance(detailStation.id);
      toast({ title: 'تم تعديل تاريخ التحصيل' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setContractInstallmentSavingId(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المحطة مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const wMonths = Math.max(0, Number(form.warranty_months) || 0);
      const wEnd = form.warranty_end || calcWarrantyEnd(form.install_date, wMonths);
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        // بعض قواعد البيانات تجعل customer_name إجباري؛ استخدم اسم المحطة كـ fallback.
        customer_name: form.customer_name.trim() || form.name.trim(),
        customer_phone: joinWorkOrderPhoneFields(form.customer_phone, form.customer_phone2, form.customer_phone3) || null,
        customer_address: form.customer_address.trim() || null,
        area: form.area.trim() || null,
        address: form.address.trim() || null,
        station_type: form.station_type || null,
        capacity: form.capacity.trim() || null,
        install_date: form.install_date || null,
        contract_type: form.contract_type || 'بدون عقد',
        contract_value: Number(form.contract_value) || 0,
        contract_duration_months: Math.max(0, Number(form.contract_duration_months) || 0),
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || calcContractEnd(form.contract_start_date, Number(form.contract_duration_months) || 0) || null,
        contract_first_visit_date: form.contract_first_visit_date || null,
        contract_installments_count: Math.max(0, Number(form.contract_installments_count) || 0),
        contract_installment_interval_months: Math.max(1, Number(form.contract_installment_interval_months) || 1),
        contract_first_installment_date: form.contract_first_installment_date || null,
        warranty_months: wMonths,
        warranty_end: wEnd || null,
        status: form.status || 'نشطة',
        notes: null,
        branch: canonicalBranchForSave(branch),
      };
      payload.notes = stationNotesWithMeta(form.notes, payload);

      if (editStation) {
        const updateRes = await retryWithUnknownColumnStripping(
          (safePayload) => supabase.from('stations').update(safePayload).eq('id', editStation.id),
          payload,
        );
        if (updateRes.error) throw updateRes.error as any;
        await ensureStationContractInstallments(editStation.id, form);
        const updatedStation = {
          ...editStation,
          ...payload,
          id: editStation.id,
        } as Station;
        setStations((prev) => prev.map((s) => (s.id === editStation.id ? updatedStation : s)));
        if (detailStation?.id === editStation.id) {
          setDetailStation(updatedStation);
        }
        if (detailStation?.id === editStation.id) {
          await fetchMaintenance(editStation.id);
        }
        // عند فتح شاشة التفاصيل، نعيد تحميلها بعد الحفظ لضمان ظهور بيانات العقد المعدلة فوراً.
        if (detailStation?.id === editStation.id) {
          const refreshed = await supabase.from('stations').select('*').eq('id', editStation.id).maybeSingle();
          if (refreshed.data) {
            const refreshedStation = stationWithSavedMeta(refreshed.data as Station);
            setDetailStation({
              ...updatedStation,
              ...refreshedStation,
              ...stationMetaFromNotes((refreshed.data as Station).notes),
            });
          }
        }
        toast({ title: 'تم تعديل المحطة بنجاح' });
      } else {
        const newId = crypto.randomUUID();
        const insertPayload: Record<string, unknown> = { id: newId, ...payload };
        const insertRes = await retryWithUnknownColumnStripping(
          (safePayload) => supabase.from('stations').insert(safePayload as any),
          insertPayload,
        );
        if (insertRes.error) throw insertRes.error as any;
        await ensureStationContractInstallments(newId, form);
        toast({ title: 'تم إضافة المحطة بنجاح' });
      }
      setAddOpen(false);
      setForm(emptyForm);
      setEditStation(null);
      await fetchStations();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Station) => {
    if (!confirm(`حذف المحطة "${s.name}"؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('stations').delete().eq('id', s.id);
      if (error) throw error;
      setStations((prev) => prev.filter((x) => x.id !== s.id));
      if (detailStation?.id === s.id) setDetailStation(null);
      toast({ title: 'تم حذف المحطة' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const openMaintenance = (s: Station) => {
    setDetailStation(s);
    setEditingMaint(null);
    setMaintForm({ ...emptyMaintForm });
    setMaintenanceProductLines([{ product_id: '', product_name: '', qty: '1', unit_cost: '0', unit_sale_price: '0' }]);
    setChangedCandles([]);
    setMaintOpen(true);
  };

  const openEditMaintenance = (m: MaintenanceRecord) => {
    setEditingMaint(m);
    setMaintForm({
      maintenance_date: m.maintenance_date || new Date().toISOString().slice(0, 10),
      maintenance_type: m.maintenance_type || 'صيانة دورية',
      description: m.description || '',
      parts_used: Array.isArray(m.product_lines) && m.product_lines.length > 0 ? '' : (m.parts_used || ''),
      labor_cost: String(m.labor_cost ?? 0),
      collected: String(m.collected ?? 0),
      technician: m.technician || '',
      notes: m.notes || '',
    });
    const savedLines = Array.isArray(m.product_lines) ? m.product_lines : [];
    setMaintenanceProductLines(savedLines.length > 0
      ? savedLines.map((line) => ({
          product_id: String(line.product_id || ''),
          product_name: String(line.product_name || ''),
          qty: String(Math.max(1, Number(line.qty) || 1)),
          unit_cost: String(Number(line.unit_cost) || 0),
          unit_sale_price: String(Number(line.unit_sale_price) || 0),
        }))
      : [{
          product_id: '',
          product_name: m.parts_used || 'قطع غيار مسجلة سابقاً',
          qty: '1',
          unit_cost: String(Number(m.parts_cost) || 0),
          unit_sale_price: String(Number(m.total_sale ?? m.total_cost) || 0),
        }]);
    setChangedCandles(Array.isArray(m.changed_candles) ? m.changed_candles.map(Number).filter((n) => n >= 1 && n <= 10) : []);
    setMaintOpen(true);
  };

  const maintenancePartsCost = maintenanceProductLines.reduce(
    (sum, line) => sum + Math.max(1, Number(line.qty) || 1) * Math.max(0, Number(line.unit_cost) || 0),
    0,
  );
  const maintenanceSaleTotal = maintenanceProductLines.reduce(
    (sum, line) => sum + Math.max(1, Number(line.qty) || 1) * Math.max(0, Number(line.unit_sale_price) || 0),
    0,
  );
  const maintenanceTotalCost = maintenancePartsCost + Math.max(0, Number(maintForm.labor_cost) || 0);

  const handleSaveMaintenance = async () => {
    if (!detailStation) return;
    if (!maintForm.description.trim() && !maintForm.maintenance_type) {
      toast({ title: 'خطأ', description: 'يرجى إدخال وصف الصيانة', variant: 'destructive' });
      return;
    }
    setMaintSaving(true);
    try {
      const normalizedLines = maintenanceProductLines
        .map((line) => {
          const product = products.find((p) => p.id === line.product_id);
          const productName = product?.name || String(line.product_name || '').trim();
          if (!line.product_id && !productName) return null;
          return {
            product_id: String(line.product_id || ''),
            product_name: productName,
            qty: Math.max(1, Number(line.qty) || 1),
            unit_cost: Math.max(0, Number(line.unit_cost) || 0),
            unit_sale_price: Math.max(0, Number(line.unit_sale_price) || 0),
          };
        })
        .filter(Boolean) as Array<{
          product_id: string;
          product_name: string;
          qty: number;
          unit_cost: number;
          unit_sale_price: number;
        }>;
      const partsCost = normalizedLines.reduce((sum, line) => sum + line.qty * line.unit_cost, 0);
      const laborCost = Math.max(0, Number(maintForm.labor_cost) || 0);
      const totalCost = partsCost + laborCost;
      const totalSale = normalizedLines.reduce((sum, line) => sum + line.qty * line.unit_sale_price, 0);
      const collected = Math.max(0, Number(maintForm.collected) || 0);
      const selectedPartsText = normalizedLines.map((line) => `${line.product_name} × ${line.qty}`).join('، ');
      const partsUsed = [selectedPartsText, maintForm.parts_used.trim()].filter(Boolean).join(' — ') || null;
      const commonPayload: Record<string, unknown> = {
        maintenance_date: maintForm.maintenance_date || new Date().toISOString().slice(0, 10),
        maintenance_type: maintForm.maintenance_type,
        description: maintForm.description.trim(),
        parts_used: partsUsed,
        parts_cost: partsCost,
        labor_cost: laborCost,
        total_cost: totalCost,
        total_sale: totalSale,
        collected,
        product_lines: normalizedLines,
        changed_candles: [...changedCandles].sort((a, b) => a - b),
        technician: maintForm.technician.trim() || null,
        notes: maintForm.notes.trim() || null,
      };

      if (editingMaint) {
        const updatePayload = { ...commonPayload };
        const updateRes = await retryWithUnknownColumnStripping(
          (safePayload) => supabase.from('station_maintenance').update(safePayload as any).eq('id', editingMaint.id),
          updatePayload,
        );
        if (updateRes.error) throw updateRes.error;
        toast({ title: 'تم تعديل سجل الصيانة' });
        setMaintOpen(false);
        setEditingMaint(null);
        setMaintForm(emptyMaintForm);
        setMaintenanceProductLines([{ product_id: '', product_name: '', qty: '1', unit_cost: '0', unit_sale_price: '0' }]);
        setChangedCandles([]);
        await fetchMaintenance(detailStation.id);
        await fetchStations();
        return;
      }

      const maintPayload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        station_id: detailStation.id,
        ...commonPayload,
        branch: canonicalBranchForSave(branch),
      };

      const insertRes = await retryWithUnknownColumnStripping(
        (safePayload) => supabase.from('station_maintenance').insert(safePayload as any),
        maintPayload,
      );
      if (insertRes.error) throw insertRes.error;
      const maintenanceId = String(maintPayload.id);
      const nextStationMaintenanceDate = new Date(String(maintPayload.maintenance_date));
      if (!Number.isNaN(nextStationMaintenanceDate.getTime())) {
        nextStationMaintenanceDate.setMonth(nextStationMaintenanceDate.getMonth() + 2);
        await supabase.from('maintenance').insert({
          id: crypto.randomUUID(),
          customer_name: detailStation.customer_name || detailStation.name,
          product_name: detailStation.name,
          phone: detailStation.customer_phone || '',
          type: maintForm.maintenance_type || 'صيانة دورية',
          next_date: nextStationMaintenanceDate.toISOString().slice(0, 10),
          next_dates: [nextStationMaintenanceDate.toISOString().slice(0, 10)],
          status: 'upcoming',
          technician: maintForm.technician.trim() || '',
          cost: totalSale,
          notes: `متابعة تلقائية بعد صيانة محطة: ${detailStation.name}`,
          branch: canonicalBranchForSave(branch),
        } as any);
      }

      // خصم من المخزون: دعم أكثر من منتج في نفس الصيانة
      const selectedLines = normalizedLines
        .map((line) => {
          const prod = products.find((p) => p.id === line.product_id);
          if (!prod) return null;
          return { prod, qty: line.qty, unitCost: line.unit_cost, unitSalePrice: line.unit_sale_price };
        })
        .filter(Boolean) as Array<{ prod: Product; qty: number; unitCost: number; unitSalePrice: number }>;
      for (const line of selectedLines) {
        const movementPayload: Record<string, unknown> = {
          id: crypto.randomUUID(),
          product_id: line.prod.id,
          branch: canonicalBranchForSave(branch),
          type: 'sale',
          quantity: line.qty,
          unit_cost: line.unitCost,
          reference_type: 'station_maintenance',
          reference_id: detailStation.id,
          notes: `صيانة محطة: ${detailStation.name} — ${maintForm.description.trim()}`,
        };
        if (line.prod.storage_location) movementPayload.storage_location = line.prod.storage_location;
        let movementErr: any;
        ({ error: movementErr } = await supabase.from('stock_movements').insert(movementPayload as any));
        if (movementErr && /storage_location|Unknown column/i.test(movementErr.message || '')) {
          delete movementPayload.storage_location;
          ({ error: movementErr } = await supabase.from('stock_movements').insert(movementPayload as any));
        }
        if (movementErr) throw movementErr;

        const newStock = Math.max(0, (Number(line.prod.stock) || 0) - line.qty);
        await supabase.from('products').update({ stock: newStock }).eq('id', line.prod.id);
      }

      // تسجيل المحصّل كسند قبض
      if (collected > 0) {
        await supabase.from('receipt_vouchers').insert({
          id: crypto.randomUUID(),
          voucher_number: `SM-${Date.now().toString().slice(-6)}`,
          voucher_date: maintForm.maintenance_date || new Date().toISOString().slice(0, 10),
          amount: collected,
          customer_name: detailStation.customer_name || detailStation.name,
          payment_method: 'cash',
          branch: canonicalBranchForSave(branch),
          notes: `تحصيل صيانة محطة: ${detailStation.name}`,
          status: 'active',
        } as any);
      }

      const stationCustomerName = detailStation.customer_name?.trim() || detailStation.name;
      const stationPhone = detailStation.customer_phone || '';
      const selectedProductNames = normalizedLines.map((line) => `${line.product_name} × ${line.qty}`).join('، ');
      const stationWorkOrderPayload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        order_code: `SM-${Date.now().toString().slice(-6)}`,
        customer_name: stationCustomerName,
        phone: stationPhone,
        address: detailStation.customer_address || detailStation.address || '',
        region: detailStation.area || '',
        product_name: selectedProductNames || detailStation.name,
        visit_date: maintForm.maintenance_date || new Date().toISOString().slice(0, 10),
        technician: maintForm.technician.trim() || '',
        warranty_status: 'ساري',
        status: 'completed',
        branch: canonicalBranchForSave(branch),
        notes: `صيانة محطة: ${detailStation.name}${maintForm.notes.trim() ? ` - ${maintForm.notes.trim()}` : ''}`,
        items: [
          {
            name: maintForm.maintenance_type,
            description: maintForm.description.trim() || `صيانة محطة: ${detailStation.name}`,
            value: totalSale,
          },
        ],
        transport_cost: 0,
        total: totalSale,
        previous_visits: [],
        delivery_status: 'completed',
        price1: totalSale,
        price2: totalCost,
        price3: collected,
        reference_type: 'station_maintenance',
        reference_id: maintenanceId,
      };
      const woRes = await retryWithUnknownColumnStripping(
        (safePayload) => supabase.from('work_orders').insert(safePayload as any),
        stationWorkOrderPayload,
      );
      if (woRes.error) throw woRes.error as any;

      toast({ title: 'تم تسجيل الصيانة بنجاح' });
      setMaintOpen(false);
      setMaintForm(emptyMaintForm);
      setMaintenanceProductLines([{ product_id: '', product_name: '', qty: '1', unit_cost: '0', unit_sale_price: '0' }]);
      setChangedCandles([]);
      await fetchMaintenance(detailStation.id);
      await fetchStations();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setMaintSaving(false);
    }
  };

  const handleDeleteStationMaintenance = async (m: MaintenanceRecord) => {
    if (!detailStation) return;
    if (!confirm('حذف سجل الصيانة هذا؟')) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('station_maintenance').delete().eq('id', m.id);
      if (error) throw error;
      toast({ title: 'تم حذف سجل الصيانة' });
      fetchMaintenance(detailStation.id);
      fetchStations();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const statusColor = (s: string | null | undefined) => {
    if (s === 'نشطة') return 'bg-green-500/10 text-green-700 border-green-500/30';
    if (s === 'متوقفة') return 'bg-red-500/10 text-red-700 border-red-500/30';
    if (s === 'صيانة') return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
    return 'bg-muted text-muted-foreground';
  };

  const totalCollectedMaint = maintRecords.reduce((s, m) => s + (Number(m.collected) || 0), 0);
  const totalCollectedContract = contractInstallments
    .filter((x) => x.status === 'تمت' || x.status === 'مدفوع')
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const totalCostsMaint = maintRecords.reduce((s, m) => s + (Number(m.total_cost) || 0), 0);
  const totalRevenueMaint = maintRecords.reduce((s, m) => {
    return s + (Number(m.total_sale) || 0);
  }, 0);
  const totalDueMaint = invoiceDebtRemaining(totalRevenueMaint, totalCollectedMaint);
  const totalCreditMaint = invoiceCustomerCredit(totalRevenueMaint, totalCollectedMaint);

  const maintenancePickProducts = products.map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock) || 0 }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-l from-primary/15 via-background to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Factory className="h-6 w-6 text-primary" /> المحطات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              إدارة محطات التحلية والفلترة — بيانات المحطة، العميل، الضمان، الصيانة، المالية، المخزون.
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> إضافة محطة
          </Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">إجمالي المحطات</p><p className="text-xl font-bold">{stations.length}</p></CardContent></Card>
        <Card className="bg-green-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">نشطة</p><p className="text-xl font-bold text-green-700">{stations.filter((s) => s.status === 'نشطة').length}</p></CardContent></Card>
        <Card className="bg-amber-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">صيانة</p><p className="text-xl font-bold text-amber-700">{stations.filter((s) => s.status === 'صيانة').length}</p></CardContent></Card>
        <Card className="bg-red-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">متوقفة</p><p className="text-xl font-bold text-red-700">{stations.filter((s) => s.status === 'متوقفة').length}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث بالاسم أو العميل أو التلفون أو المنطقة..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Factory className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد محطات مسجلة بعد.</p>
          <Button size="sm" className="mt-3 gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> إضافة أول محطة</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(s)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Factory className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </CardTitle>
                  <Badge variant="outline" className={statusColor(s.status)}>{s.status || 'غير محدد'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {s.customer_name && <div className="flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5" /><span>{s.customer_name}</span></div>}
                {s.customer_phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{s.customer_phone.replace(/\s*\|\s*/g, ' - ')}</span></div>}
                {s.area && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /><span>{s.area}{s.address ? ` — ${s.address}` : ''}</span></div>}
                {s.station_type && <div className="flex items-center gap-2 text-muted-foreground"><Wrench className="h-3.5 w-3.5" /><span>{s.station_type}{s.capacity ? ` | سعة: ${s.capacity}` : ''}</span></div>}
                {s.install_date && <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /><span>تركيب: {formatDateDisplay(s.install_date)}</span></div>}
                {s.warranty_end && (
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className={isWarrantyActive(s.warranty_end) ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                      ضمان: {isWarrantyActive(s.warranty_end) ? 'ساري' : 'منتهي'} ({formatDateDisplay(s.warranty_end)})
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5 pt-2">
                  <div className="rounded bg-muted/40 p-1.5"><p className="text-[9px] text-muted-foreground">إجمالي التكلفة</p><p className="text-xs font-bold">{formatEGP(stationFinancials[s.id]?.totalCost || 0)}</p></div>
                  <div className="rounded bg-primary/5 p-1.5"><p className="text-[9px] text-muted-foreground">إجمالي الإيراد</p><p className="text-xs font-bold">{formatEGP(stationFinancials[s.id]?.totalRevenue || 0)}</p></div>
                  <div className="rounded bg-green-500/5 p-1.5"><p className="text-[9px] text-muted-foreground">محصّل</p><p className="text-xs font-bold text-green-700">{formatEGP(stationFinancials[s.id]?.collected || 0)}</p></div>
                  <div className="rounded bg-orange-500/5 p-1.5"><p className="text-[9px] text-muted-foreground">مستحق</p><p className="text-xs font-bold text-orange-700">{formatEGP(stationFinancials[s.id]?.due || 0)}</p></div>
                  <div className="rounded bg-emerald-500/5 p-1.5 col-span-2"><p className="text-[9px] text-muted-foreground">له عندنا</p><p className="text-xs font-bold text-emerald-700">{formatEGP(stationFinancials[s.id]?.credit || 0)}</p></div>
                </div>
                <div className="flex gap-1 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => openDetail(s)}><Eye className="h-3 w-3" /> عرض</Button>
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => openEdit(s)}><Edit className="h-3 w-3" /> تعديل</Button>
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => openMaintenance(s)}><Wrench className="h-3 w-3" /> صيانة</Button>
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-destructive" onClick={() => handleDelete(s)}><Trash2 className="h-3 w-3" /> حذف</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ===== تفاصيل المحطة ===== */}
      <Dialog open={!!detailStation && !addOpen && !maintOpen} onOpenChange={(o) => { if (!o) { setDetailStation(null); setEditingMaint(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Factory className="h-5 w-5 text-primary" /> {detailStation?.name}</DialogTitle></DialogHeader>
          {detailStation && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-2">
                <TabsTrigger value="details" className="text-xs">تفاصيل المحطة</TabsTrigger>
                <TabsTrigger value="contract" className="text-xs">بيانات العقد</TabsTrigger>
                <TabsTrigger value="wo" className="text-xs">أوامر الشغل</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4 mt-0">
              {/* بيانات المحطة */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">النوع:</span> <strong>{detailStation.station_type || '-'}</strong></div>
                <div><span className="text-muted-foreground">السعة:</span> <strong>{detailStation.capacity || '-'}</strong></div>
                <div><span className="text-muted-foreground">المنطقة:</span> <strong>{detailStation.area || '-'}</strong></div>
                <div><span className="text-muted-foreground">العنوان:</span> <strong>{detailStation.address || '-'}</strong></div>
                <div><span className="text-muted-foreground">تاريخ التركيب:</span> <strong>{formatDateDisplay(detailStation.install_date) || '-'}</strong></div>
                <div><span className="text-muted-foreground">الحالة:</span> <Badge variant="outline" className={statusColor(detailStation.status)}>{detailStation.status}</Badge></div>
              </div>

              {/* بيانات العميل */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> بيانات العميل</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">الاسم:</span> <strong>{detailStation.customer_name || '-'}</strong></div>
                  <div><span className="text-muted-foreground">التلفون:</span> <strong dir="ltr">{(detailStation.customer_phone || '-').replace(/\s*\|\s*/g, ' - ')}</strong></div>
                  <div className="col-span-2"><span className="text-muted-foreground">العنوان:</span> <strong>{detailStation.customer_address || '-'}</strong></div>
                </CardContent>
              </Card>

              {/* الضمان */}
              <Card className={isWarrantyActive(detailStation.warranty_end) ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}>
                <CardContent className="p-3 flex items-center gap-3">
                  <ShieldCheck className={`h-6 w-6 ${isWarrantyActive(detailStation.warranty_end) ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <p className="font-bold text-sm">{isWarrantyActive(detailStation.warranty_end) ? 'الضمان ساري' : 'الضمان منتهي'}</p>
                    <p className="text-xs text-muted-foreground">{detailStation.warranty_months || 0} شهر — ينتهي: {formatDateDisplay(detailStation.warranty_end) || 'غير محدد'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* المالية */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="bg-muted/30"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">إجمالي التكلفة</p><p className="text-lg font-bold">{formatEGP(totalCostsMaint)}</p></CardContent></Card>
                <Card className="bg-primary/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">إجمالي الإيراد</p><p className="text-lg font-bold">{formatEGP(totalRevenueMaint)}</p></CardContent></Card>
                <Card className="bg-green-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">محصّل</p><p className="text-lg font-bold text-green-700">{formatEGP(totalCollectedMaint)}</p></CardContent></Card>
                <Card className="bg-orange-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">مستحق</p><p className="text-lg font-bold text-orange-700">{formatEGP(totalDueMaint)}</p></CardContent></Card>
                <Card className="bg-emerald-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">له عندنا</p><p className="text-lg font-bold text-emerald-700">{formatEGP(totalCreditMaint)}</p></CardContent></Card>
              </div>

              {/* سجل الصيانة */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> سجل الصيانة</h3>
                <Button size="sm" className="gap-1" onClick={() => openMaintenance(detailStation)}><Plus className="h-3 w-3" /> تسجيل صيانة</Button>
              </div>
              {maintLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>
              ) : maintRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات صيانة بعد.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {maintRecords.map((m) => (
                    <Card key={m.id} className="bg-muted/20">
                      <CardContent className="p-3 space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{formatDateDisplay(m.maintenance_date)}</span>
                            <Badge variant="outline" className="text-[10px]">{m.maintenance_type}</Badge>
                          </div>
                          {m.technician && <span className="text-xs text-muted-foreground">الفني: {m.technician}</span>}
                        </div>
                        <p className="text-muted-foreground">{m.description}</p>
                        {m.parts_used && <p className="text-xs"><Package className="h-3 w-3 inline ml-1" />قطع غيار: {m.parts_used}</p>}
                        {Array.isArray(m.changed_candles) && m.changed_candles.length > 0 && (
                          <p className="text-xs font-medium text-primary">
                            الشمعات التي تم تغييرها: {m.changed_candles.map((n) => `الشمعة ${n}`).join('، ')}
                          </p>
                        )}
                        {Array.isArray(m.product_lines) && m.product_lines.length > 0 && (
                          <div className="rounded border bg-background/70 overflow-x-auto">
                            <table className="w-full text-[10px]">
                              <thead><tr className="border-b"><th className="p-1 text-right">الصنف</th><th className="p-1">الكمية</th><th className="p-1">ت. الوحدة</th><th className="p-1">س. الوحدة</th></tr></thead>
                              <tbody>
                                {m.product_lines.map((line, lineIndex) => (
                                  <tr key={`${m.id}-line-${lineIndex}`} className="border-b last:border-0">
                                    <td className="p-1">{line.product_name || '-'}</td>
                                    <td className="p-1 text-center">{line.qty}</td>
                                    <td className="p-1 text-center">{formatEGP(Number(line.unit_cost) || 0)}</td>
                                    <td className="p-1 text-center">{formatEGP(Number(line.unit_sale_price) || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 items-center justify-between text-xs pt-1 border-t">
                          <div className="flex gap-4 flex-wrap">
                            <span>إجمالي التكلفة: <strong>{formatEGP(m.total_cost)}</strong></span>
                            <span>إجمالي السعر: <strong>{formatEGP(Number(m.total_sale) || 0)}</strong></span>
                            <span className="text-green-700">المحصّل: <strong>{formatEGP(m.collected)}</strong></span>
                            <span className="text-orange-700">المستحق: <strong>{formatEGP(invoiceDebtRemaining(Number(m.total_sale) || 0, Number(m.collected) || 0))}</strong></span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => openEditMaintenance(m)}>
                              <Edit className="h-3 w-3 ml-1" /> تعديل
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] text-destructive border-destructive/30" onClick={() => handleDeleteStationMaintenance(m)}>
                              <Trash2 className="h-3 w-3 ml-1" /> حذف
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1">
                          <span className="font-medium text-foreground">ملاحظات: </span>
                          {m.notes?.trim() ? m.notes : '—'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => openEdit(detailStation)}>تعديل البيانات</Button>
                <Button onClick={() => openMaintenance(detailStation)}>تسجيل صيانة</Button>
              </div>
              </TabsContent>
              <TabsContent value="contract" className="space-y-4 mt-0">
                <Card className="bg-muted/20">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm">ملخص العقد</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">نوع العقد:</span> <strong>{detailStation.contract_type || 'بدون عقد'}</strong></div>
                    <div><span className="text-muted-foreground">قيمة العقد:</span> <strong>{formatEGP(Number(detailStation.contract_value || 0))}</strong></div>
                    <div><span className="text-muted-foreground">مدة العقد:</span> <strong>{Number(detailStation.contract_duration_months || 0)} شهر</strong></div>
                    <div><span className="text-muted-foreground">عدد الأقساط:</span> <strong>{Number(detailStation.contract_installments_count || 0)}</strong></div>
                    <div><span className="text-muted-foreground">بداية العقد:</span> <strong>{formatDateDisplay(detailStation.contract_start_date) || '-'}</strong></div>
                    <div><span className="text-muted-foreground">نهاية العقد:</span> <strong>{formatDateDisplay(detailStation.contract_end_date || calcContractEnd(detailStation.contract_start_date || '', Number(detailStation.contract_duration_months) || 0)) || '-'}</strong></div>
                    <div><span className="text-muted-foreground">أول زيارة:</span> <strong>{formatDateDisplay(detailStation.contract_first_visit_date) || '-'}</strong></div>
                    <div><span className="text-muted-foreground">فاصل الأقساط:</span> <strong>{Number(detailStation.contract_installment_interval_months || 1)} شهر</strong></div>
                    <div><span className="text-muted-foreground">أول قسط:</span> <strong>{formatDateDisplay(detailStation.contract_first_installment_date) || '-'}</strong></div>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="bg-primary/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">إجمالي العقد</p><p className="text-lg font-bold">{formatEGP(Number(detailStation.contract_value || 0))}</p></CardContent></Card>
                  <Card className="bg-green-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">المحصّل من الأقساط</p><p className="text-lg font-bold text-green-700">{formatEGP(contractInstallments.filter((x) => x.status === 'تمت' || x.status === 'مدفوع').reduce((s, x) => s + (Number(x.amount) || 0), 0))}</p></CardContent></Card>
                  <Card className="bg-orange-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">المتبقي</p><p className="text-lg font-bold text-orange-700">{formatEGP(Math.max(0, Number(detailStation.contract_value || 0) - contractInstallments.filter((x) => x.status === 'تمت' || x.status === 'مدفوع').reduce((s, x) => s + (Number(x.amount) || 0), 0)))}</p></CardContent></Card>
                </div>
                <Card>
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">أقساط العقد</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => rebuildStationContractInstallments(detailStation)} disabled={rebuildingInstallments}>
                        {rebuildingInstallments ? 'جاري إعادة الإنشاء...' : 'إعادة إنشاء الأقساط'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {contractInstallments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">لا توجد أقساط عقد مسجلة لهذه المحطة.</p>
                    ) : (
                      <div className="space-y-2">
                        {contractInstallments.map((inst, idx) => (
                          <div key={inst.id} className="rounded-md border p-2 flex items-center justify-between gap-2 text-sm">
                            <div>
                              <p className="font-medium">القسط {idx + 1}</p>
                              <p className="text-xs text-muted-foreground">استحقاق: {formatDateDisplay(inst.installment_date)} {inst.collection_date ? `• تحصيل: ${formatDateDisplay(inst.collection_date)}` : ''}</p>
                            </div>
                            <div className="text-left flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                disabled={contractInstallmentSavingId === inst.id}
                                onClick={() => updateStationContractInstallmentAmount(inst)}
                              >
                                تعديل قيمة القسط
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                disabled={contractInstallmentSavingId === inst.id}
                                onClick={() => updateStationContractCollectionDate(inst)}
                              >
                                تعديل تاريخ التحصيل
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                disabled={contractInstallmentSavingId === inst.id}
                                onClick={() => toggleStationContractInstallmentStatus(inst)}
                              >
                                {contractInstallmentSavingId === inst.id
                                  ? 'جاري الحفظ...'
                                  : (inst.status === 'تمت' || inst.status === 'مدفوع') ? 'إرجاع لمعلق' : 'تسجيل سداد'}
                              </Button>
                              <div>
                              <p className="font-bold">{formatEGP(inst.amount)}</p>
                              <Badge variant={inst.status === 'تمت' || inst.status === 'مدفوع' ? 'default' : 'secondary'} className="text-[10px]">{inst.status}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="wo" className="mt-0 max-h-[70vh] overflow-y-auto pr-1">
                <p className="text-xs text-muted-foreground mb-2">نفس نموذج وأعمدة أوامر الشغل في قسم العملاء — مرتبطة بعميل المحطة.</p>
                <WorkOrdersPage
                  embedded
                  customerNameFilter={detailStation.customer_name?.trim() || detailStation.name}
                  strictEmptyEmbedded={false}
                  prefillCustomer={
                    detailStation.customer_name || detailStation.name
                      ? {
                          id: '',
                          name: detailStation.customer_name || detailStation.name,
                          phone1: splitWorkOrderPhoneFields(detailStation.customer_phone || '').phone,
                          phone2: splitWorkOrderPhoneFields(detailStation.customer_phone || '').phone2,
                          whatsapp: splitWorkOrderPhoneFields(detailStation.customer_phone || '').phone3,
                          address: detailStation.customer_address || '',
                          region: detailStation.area || '',
                          area_id: null,
                        }
                      : null
                  }
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== إضافة / تعديل محطة ===== */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setEditStation(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editStation ? 'تعديل المحطة' : 'إضافة محطة جديدة'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground border-b pb-1">بيانات المحطة</p>
            <div>
              <Label>اسم المحطة *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="مثال: محطة تحلية فيصل" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>نوع المحطة</Label>
                <Select value={form.station_type} onValueChange={(v) => setForm((p) => ({ ...p, station_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="تحلية">تحلية</SelectItem>
                    <SelectItem value="فلترة">فلترة</SelectItem>
                    <SelectItem value="معالجة">معالجة</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>السعة</Label><Input value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="1000 لتر/ساعة" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>المنطقة</Label><Input value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} /></div>
              <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>تاريخ التركيب</Label><Input type="date" value={form.install_date} onChange={(e) => setForm((p) => ({ ...p, install_date: e.target.value }))} /></div>
              <div><Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="نشطة">نشطة</SelectItem>
                    <SelectItem value="متوقفة">متوقفة</SelectItem>
                    <SelectItem value="صيانة">صيانة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">بيانات العميل</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>اسم العميل</Label><Input value={form.customer_name} onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))} /></div>
              <div><Label>رقم التلفون</Label><Input dir="ltr" value={form.customer_phone} onChange={(e) => setForm((p) => ({ ...p, customer_phone: e.target.value }))} placeholder="01xxxxxxxxx" /></div>
              <div><Label>رقم إضافي</Label><Input dir="ltr" value={form.customer_phone2} onChange={(e) => setForm((p) => ({ ...p, customer_phone2: e.target.value }))} placeholder="اختياري" /></div>
              <div><Label>رقم إضافي 2</Label><Input dir="ltr" value={form.customer_phone3} onChange={(e) => setForm((p) => ({ ...p, customer_phone3: e.target.value }))} placeholder="اختياري" /></div>
            </div>
            <div><Label>عنوان العميل</Label><Input value={form.customer_address} onChange={(e) => setForm((p) => ({ ...p, customer_address: e.target.value }))} /></div>

            <p className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">الضمان</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>مدة الضمان (شهور)</Label><Input type="number" dir="ltr" min={0} value={form.warranty_months} onChange={(e) => setForm((p) => ({ ...p, warranty_months: e.target.value }))} /></div>
              <div><Label>ينتهي في</Label><Input type="date" value={form.warranty_end || (form.install_date ? calcWarrantyEnd(form.install_date, Number(form.warranty_months) || 0) : '')} onChange={(e) => setForm((p) => ({ ...p, warranty_end: e.target.value }))} /></div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">بيانات عقد الصيانة</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>نوع العقد</Label>
                <Select value={form.contract_type} onValueChange={(v) => setForm((p) => ({ ...p, contract_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="بدون عقد">بدون عقد</SelectItem>
                    <SelectItem value="عقد صيانة">عقد صيانة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>قيمة العقد</Label><Input type="number" dir="ltr" min={0} value={form.contract_value} onChange={(e) => setForm((p) => ({ ...p, contract_value: e.target.value }))} /></div>
              <div><Label>مدة العقد (شهور)</Label><Input type="number" dir="ltr" min={0} value={form.contract_duration_months} onChange={(e) => setForm((p) => ({ ...p, contract_duration_months: e.target.value }))} /></div>
              <div><Label>بداية العقد</Label><Input type="date" value={form.contract_start_date} onChange={(e) => setForm((p) => ({ ...p, contract_start_date: e.target.value }))} /></div>
              <div><Label>نهاية العقد</Label><Input type="date" value={form.contract_end_date || (form.contract_start_date ? calcContractEnd(form.contract_start_date, Number(form.contract_duration_months) || 0) : '')} onChange={(e) => setForm((p) => ({ ...p, contract_end_date: e.target.value }))} /></div>
              <div><Label>تاريخ أول زيارة</Label><Input type="date" value={form.contract_first_visit_date} onChange={(e) => setForm((p) => ({ ...p, contract_first_visit_date: e.target.value }))} /></div>
              <div><Label>عدد أقساط العقد</Label><Input type="number" dir="ltr" min={0} value={form.contract_installments_count} onChange={(e) => setForm((p) => ({ ...p, contract_installments_count: e.target.value }))} /></div>
              <div><Label>فاصل الأقساط (بالشهور)</Label><Input type="number" dir="ltr" min={1} value={form.contract_installment_interval_months} onChange={(e) => setForm((p) => ({ ...p, contract_installment_interval_months: e.target.value }))} /></div>
              <div><Label>تاريخ أول قسط</Label><Input type="date" value={form.contract_first_installment_date} onChange={(e) => setForm((p) => ({ ...p, contract_first_installment_date: e.target.value }))} /></div>
            </div>

            <div><Label>ملاحظات</Label><Textarea className="min-h-[60px]" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : editStation ? 'تعديل' : 'إضافة'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== تسجيل صيانة ===== */}
      <Dialog open={maintOpen} onOpenChange={(o) => {
        setMaintOpen(o);
        if (!o) {
          setMaintForm(emptyMaintForm);
          setEditingMaint(null);
          setChangedCandles([]);
          setMaintenanceProductLines([{ product_id: '', product_name: '', qty: '1', unit_cost: '0', unit_sale_price: '0' }]);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> {editingMaint ? 'تعديل صيانة' : 'تسجيل صيانة'} — {detailStation?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>تاريخ الصيانة</Label><Input type="date" value={maintForm.maintenance_date} onChange={(e) => setMaintForm((p) => ({ ...p, maintenance_date: e.target.value }))} /></div>
              <div><Label>نوع الصيانة</Label>
                <Select value={maintForm.maintenance_type} onValueChange={(v) => setMaintForm((p) => ({ ...p, maintenance_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="صيانة دورية">صيانة دورية</SelectItem>
                    <SelectItem value="تغيير فلاتر">تغيير فلاتر</SelectItem>
                    <SelectItem value="إصلاح عطل">إصلاح عطل</SelectItem>
                    <SelectItem value="تركيب قطعة">تركيب قطعة</SelectItem>
                    <SelectItem value="فحص">فحص</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div><Label>ما تم عمله (وصف الصيانة) *</Label><Textarea className="min-h-[70px]" value={maintForm.description} onChange={(e) => setMaintForm((p) => ({ ...p, description: e.target.value }))} placeholder="مثال: تغيير الفلتر الأول والثاني، غسيل الممبرين..." /></div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground border-b pb-1">الشمعات التي تم تغييرها في هذه الزيارة</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((candleNumber) => (
                  <label key={candleNumber} className="flex items-center gap-2 rounded border p-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={changedCandles.includes(candleNumber)}
                      onChange={(e) => setChangedCandles((prev) => e.target.checked
                        ? [...prev, candleNumber]
                        : prev.filter((n) => n !== candleNumber))}
                    />
                    الشمعة {candleNumber}
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground border-b pb-1">قطع الغيار (من المخزون)</p>
            <div className="space-y-2">
              {maintenanceProductLines.map((line, idx) => {
                const selected = products.find((p) => p.id === line.product_id);
                return (
                    <div key={`maint-line-${idx}`} className="grid grid-cols-12 gap-2 items-end rounded border p-2">
                      <div className="col-span-12 sm:col-span-4">
                        <Label>منتج {idx + 1}</Label>
                        <ProductSearchCombobox
                          products={maintenancePickProducts}
                          value={line.product_id}
                          onValueChange={(id) => {
                            const product = products.find((p) => p.id === id);
                            setMaintenanceProductLines((prev) => prev.map((x, i) => i === idx ? {
                              ...x,
                              product_id: id,
                              product_name: product?.name || '',
                              unit_cost: String(Number(product?.cost) || 0),
                              unit_sale_price: String(Number(product?.price) || 0),
                            } : x));
                          }}
                          placeholder="ابحث واختر قطعة الغيار"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {selected ? `المتاح للسحب: ${Number(selected.stock) || 0}` : 'اختر منتجًا لعرض الكمية المتاحة'}
                        </p>
                        {!selected && line.product_name && <p className="text-[11px] text-primary mt-1">المحفوظ: {line.product_name}</p>}
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Label>الكمية</Label>
                        <Input
                          type="number"
                          dir="ltr"
                          min={1}
                          value={line.qty}
                          onChange={(e) => setMaintenanceProductLines((prev) => prev.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))}
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Label>ت الوحدة</Label>
                        <Input
                          type="number"
                          dir="ltr"
                          min={0}
                          value={line.unit_cost}
                          onChange={(e) => setMaintenanceProductLines((prev) => prev.map((x, i) => i === idx ? { ...x, unit_cost: e.target.value } : x))}
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Label>س الوحدة</Label>
                        <Input
                          type="number"
                          dir="ltr"
                          min={0}
                          value={line.unit_sale_price}
                          onChange={(e) => setMaintenanceProductLines((prev) => prev.map((x, i) => i === idx ? { ...x, unit_sale_price: e.target.value } : x))}
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        {maintenanceProductLines.length > 1 && (
                          <Button type="button" variant="ghost" className="text-destructive w-full" onClick={() => setMaintenanceProductLines((prev) => prev.filter((_, i) => i !== idx))}>
                            حذف
                          </Button>
                        )}
                      </div>
                    </div>
                );
              })}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMaintenanceProductLines((prev) => [...prev, { product_id: '', product_name: '', qty: '1', unit_cost: '0', unit_sale_price: '0' }])}
                >
                  + إضافة منتج
                </Button>
              </div>
            </div>
            <div>
              <Label>قطع غيار إضافية (نص)</Label>
              <Input value={maintForm.parts_used} onChange={(e) => setMaintForm((p) => ({ ...p, parts_used: e.target.value }))} placeholder="فلتر أول، حلقة..." />
            </div>
            {editingMaint && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">يمكن تعديل تفاصيل الزيارة، لكن لا يُعاد احتساب حركة المخزون أو سند القبض تلقائياً.</p>
            )}

            <p className="text-xs font-semibold text-muted-foreground border-b pb-1">التكاليف والتحصيل</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>تكلفة العمالة</Label><Input type="number" dir="ltr" value={maintForm.labor_cost} onChange={(e) => setMaintForm((p) => ({ ...p, labor_cost: e.target.value }))} /></div>
              <div><Label>المحصّل (الفلوس اللي اتاخدت)</Label><Input type="number" dir="ltr" value={maintForm.collected} onChange={(e) => setMaintForm((p) => ({ ...p, collected: e.target.value }))} /></div>
            </div>
            {(maintenanceTotalCost > 0 || maintenanceSaleTotal > 0 || Number(maintForm.collected) > 0) && (
              <div className="bg-muted/50 rounded-lg p-2 text-sm grid grid-cols-2 gap-2">
                <span>إجمالي التكلفة: <strong>{formatEGP(maintenanceTotalCost)}</strong></span>
                <span>إجمالي السعر: <strong className="text-primary">{formatEGP(maintenanceSaleTotal)}</strong></span>
                <span>المحصّل: <strong className="text-green-700">{formatEGP(Number(maintForm.collected) || 0)}</strong></span>
                <span>المستحق: <strong className="text-orange-700">{formatEGP(invoiceDebtRemaining(maintenanceSaleTotal, Number(maintForm.collected) || 0))}</strong></span>
                {invoiceCustomerCredit(maintenanceSaleTotal, Number(maintForm.collected) || 0) > 0 && (
                  <span className="col-span-2">له عندنا: <strong className="text-emerald-700">{formatEGP(invoiceCustomerCredit(maintenanceSaleTotal, Number(maintForm.collected) || 0))}</strong></span>
                )}
              </div>
            )}

            <div><Label>الفني</Label><Input value={maintForm.technician} onChange={(e) => setMaintForm((p) => ({ ...p, technician: e.target.value }))} placeholder="اسم الفني" /></div>
            <div><Label>ملاحظات</Label><Textarea className="min-h-[50px]" value={maintForm.notes} onChange={(e) => setMaintForm((p) => ({ ...p, notes: e.target.value }))} /></div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setMaintOpen(false)}>إلغاء</Button>
              <Button onClick={handleSaveMaintenance} disabled={maintSaving}>{maintSaving ? 'جاري الحفظ...' : editingMaint ? 'حفظ التعديل' : 'حفظ الصيانة'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
