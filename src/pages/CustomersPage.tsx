import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Phone, MessageCircle, MapPin, Edit, Trash2, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CustomerDetailDialog } from '@/components/CustomerDetailDialog';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { promptDeletePassword } from '@/lib/deletePassword';
import { matchesLooseSearch, matchesAnyLooseSearch, normalizeSearchText } from '@/lib/searchText';
import { Badge } from '@/components/ui/badge';

const BRANCH_OPTIONS = [
  { value: 'فرع الإسكندرية', label: 'الإسكندرية' },
  { value: 'فرع الجيزة', label: 'الجيزة / القاهرة' },
] as const;

interface Customer {
  id: string;
  name: string;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  address: string;
  region?: string;
  area_id?: string | null;
  branch?: string;
  customer_type?: string;
  notes?: string;
  customer_code?: string | null;
}

type CustomerDevicePayload = {
  product_name: string;
  device_type: string;
  serial_number: string;
  install_date: string | null;
  warranty_months: number;
  contract_type: string;
  selling_price: number;
  total_price: number;
  installments_count: number;
  installment_amount: number;
  first_installment_date: string | null;
  branch: string;
  customer_code: string;
  notes: string;
  ad_source: string;
};

function stripCustomerTypeFromError(err: { message?: string } | null): boolean {
  return !!err && String(err.message || '').includes('customer_type');
}

function stripUnknownColumnFromPayload(errorMessage: string, payload: Record<string, unknown>): boolean {
  const msg = String(errorMessage || '');
  const matched = msg.match(/Unknown column '([^']+)'/i)?.[1];
  const unknownColumn = matched || (msg.includes('customer_code') ? 'customer_code' : null);
  if (!unknownColumn) return false;
  if (!(unknownColumn in payload)) return false;
  delete payload[unknownColumn];
  return true;
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deviceCodesByCustomer, setDeviceCodesByCustomer] = useState<Record<string, string[]>>({});
  const [areas, setAreas] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [areasForForm, setAreasForForm] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editDevices, setEditDevices] = useState<any[]>([]);
  const [sectorId, setSectorId] = useState('none');
  const [customerBranch, setCustomerBranch] = useState('فرع الإسكندرية');
  const [areaFilterId, setAreaFilterId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState('');
  const [showAreaSearchResults, setShowAreaSearchResults] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    customer_code: '',
    phone1: '',
    phone2: '',
    whatsapp: '',
    address: '',
    region: '',
    notes: '',
    area_id: '',
    customer_type: 'sales',
    device_product_name: '',
    device_type: '',
    device_serial_number: '',
    device_install_date: '',
    device_warranty_months: '12',
    device_contract_type: 'كاش',
    device_selling_price: '0',
    device_total_price: '0',
    device_installments_count: '0',
    device_installment_amount: '0',
    device_first_installment_date: '',
    device_customer_code: '',
    device_notes: '',
    device_ad_source: '',
    device_id: '',
    maintenance_interval: '1',
    maintenance_first_date: '',
    maintenance_amounts: '',
    contract_duration_months: '12',
    contract_start_date: '',
    contract_end_date: '',
    contract_first_visit_date: '',
    contract_value: '0',
    contract_installments_count: '0',
  });
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const sectors = useMemo(() => areasForForm.filter((a) => !a.parent_id), [areasForForm]);
  const getAreasUnderSector = (parentId: string) => areasForForm.filter((a) => a.parent_id === parentId);
  const areaOptions = sectorId && sectorId !== 'none' ? getAreasUnderSector(sectorId) : [];
  const filteredAreaSearchOptions = useMemo(() => {
    const q = areaSearch.trim().toLowerCase();
    if (!q || sectorId === 'none') return [];
    return areaOptions.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 20);
  }, [areaSearch, areaOptions, sectorId]);

  const calcContractEndDate = (startDate: string, monthsRaw: string) => {
    if (!startDate) return '';
    const months = Math.max(0, Number(monthsRaw) || 0);
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  };

  const applyDeviceToForm = (dev: any | null) => {
    setAddForm((prev) => ({
      ...prev,
      device_product_name: dev?.product_name || '',
      device_type: dev?.device_type || '',
      device_serial_number: dev?.serial_number || '',
      device_install_date: dev?.install_date || '',
      device_warranty_months: String(dev?.warranty_months ?? 12),
      device_contract_type: dev?.contract_type || 'كاش',
      device_selling_price: String(dev?.selling_price ?? 0),
      device_total_price: String(dev?.total_price ?? 0),
      device_installments_count: String(dev?.installments_count ?? 0),
      device_installment_amount: String(dev?.installment_amount ?? 0),
      device_first_installment_date: dev?.first_installment_date || '',
      device_customer_code: dev?.customer_code || '',
      device_notes: dev?.notes || '',
      device_ad_source: dev?.ad_source || '',
      device_id: dev?.id || '',
      maintenance_interval: String(dev?.contract_installment_interval_months ?? 1),
      maintenance_first_date: dev?.first_installment_date || '',
      maintenance_amounts: '',
      contract_duration_months: String(dev?.contract_duration_months ?? 12),
      contract_start_date: dev?.contract_start_date || '',
      contract_end_date: dev?.contract_end_date || '',
      contract_first_visit_date: dev?.contract_first_visit_date || '',
      contract_value: String(dev?.contract_value ?? dev?.total_price ?? 0),
      contract_installments_count: String(dev?.installments_count ?? 0),
    }));
  };

  const fetchCustomers = async () => {
    const bv = branchDbValuesForUiBranch(branch);
    const custRes = await supabase.from('customers').select('*').in('branch', bv).order('created_at', { ascending: false });
    setCustomers(Array.isArray(custRes.data) ? (custRes.data as Customer[]) : []);
    const customerIds = (Array.isArray(custRes.data) ? custRes.data : []).map((c: any) => c.id).filter(Boolean);
    const devRes = customerIds.length > 0
      ? await (supabase as any).from('customer_devices').select('customer_id,customer_code').in('customer_id', customerIds)
      : { data: [] };
    const map: Record<string, string[]> = {};
    (Array.isArray(devRes?.data) ? devRes.data : []).forEach((r: any) => {
      const cid = String(r?.customer_id || '');
      if (!cid) return;
      const code = String(r?.customer_code || '').trim();
      if (!code) return;
      if (!map[cid]) map[cid] = [];
      map[cid].push(code);
    });
    setDeviceCodesByCustomer(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [branch]);

  useEffect(() => {
    setCustomerBranch(canonicalBranchForSave(branch));
  }, [branch]);

  useEffect(() => {
    supabase
      .from('areas')
      .select('id,name,parent_id')
      .in('branch', branchDbValuesForUiBranch(branch))
      .order('name')
      .then(({ data }) => setAreas(Array.isArray(data) ? (data as { id: string; name: string; parent_id: string | null }[]) : []));
  }, [branch]);

  useEffect(() => {
    if (!addOpen) return;
    supabase
      .from('areas')
      .select('id,name,parent_id')
      .in('branch', branchDbValuesForUiBranch(customerBranch))
      .order('name')
      .then(({ data }) =>
        setAreasForForm(Array.isArray(data) ? (data as { id: string; name: string; parent_id: string | null }[]) : [])
      );
  }, [addOpen, customerBranch]);

  const searchTrim = search.trim();
  const normalizedSearch = normalizeSearchText(searchTrim);
  const nextCustomerCode = useMemo(() => {
    let maxCode = 0;
    customers.forEach((c) => {
      const raw = String(c.customer_code || '').trim();
      const n = parseInt(raw.replace(/\D/g, ''), 10);
      if (Number.isFinite(n) && n > maxCode) maxCode = n;
    });
    return String(maxCode + 1);
  }, [customers]);
  const filtered = useMemo(() => {
    const customerCodeMatches = (c: Customer) => {
      const ownCode = normalizeSearchText(String((c as Customer).customer_code || ''));
      const deviceCodes = (deviceCodesByCustomer[c.id] || []).map(normalizeSearchText);
      return { ownCode, deviceCodes };
    };
    const hasExactCodeMatches = !!normalizedSearch && customers.some((c) => {
      const { ownCode, deviceCodes } = customerCodeMatches(c);
      return ownCode === normalizedSearch || deviceCodes.includes(normalizedSearch);
    });
    const hasCodeMatches = hasExactCodeMatches || (!!normalizedSearch && customers.some((c) => {
      const { ownCode, deviceCodes } = customerCodeMatches(c);
      return ownCode.includes(normalizedSearch) || deviceCodes.some((dc) => dc.includes(normalizedSearch));
    }));
    const hasNumericSearch = /^\d+$/.test(normalizedSearch);
    let list = customers.filter((c) => {
      const { ownCode, deviceCodes } = customerCodeMatches(c);
      const codeExact = ownCode === normalizedSearch || deviceCodes.includes(normalizedSearch);
      const codePartial = ownCode.includes(normalizedSearch) || deviceCodes.some((dc) => dc.includes(normalizedSearch));
      if (hasNumericSearch && (hasExactCodeMatches || hasCodeMatches)) return hasExactCodeMatches ? codeExact : codePartial;
      return (
        !searchTrim ||
        (hasExactCodeMatches && codeExact) ||
        (!hasExactCodeMatches && hasCodeMatches && codePartial) ||
        matchesLooseSearch(c.name, searchTrim) ||
        matchesLooseSearch(c.address, searchTrim) ||
        matchesAnyLooseSearch([c.phone1, c.phone2, c.whatsapp], searchTrim) ||
        (c.phone1 && c.phone1.includes(searchTrim)) ||
        (c.phone2 && c.phone2.includes(searchTrim)) ||
        (c.whatsapp && c.whatsapp.includes(searchTrim)) ||
        codePartial
      );
    });
    if (areaFilterId) list = list.filter((c) => c.area_id === areaFilterId);
    return list;
  }, [customers, deviceCodesByCustomer, searchTrim, normalizedSearch, areaFilterId]);

  const areaChipStats = useMemo(() => {
    const m = new Map<string, number>();
    customers.forEach((c) => {
      if (!c.area_id) return;
      m.set(c.area_id, (m.get(c.area_id) || 0) + 1);
    });
    return Array.from(m.entries())
      .map(([id, count]) => ({ id, count, name: areas.find((a) => a.id === id)?.name || 'منطقة' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [customers, areas]);

  const areaName = (id: string | null | undefined) => {
    if (!id) return '';
    return areas.find((a) => a.id === id)?.name || '';
  };

  const printFollowUpCard = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    const br = c.branch || branch;
    const area = areaName(c.area_id);
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>كارت متابعة</title>
      <style>body{font-family:Tahoma,Arial,sans-serif;padding:16px;max-width:400px;margin:auto;border:2px solid #333;border-radius:12px;}
      h1{font-size:18px;margin:0 0 8px;} .row{margin:6px 0;font-size:14px;} .muted{color:#555;font-size:12px;}</style></head><body>
      <h1>كلين ووتر — متابعة عميل</h1>
      <div class="row"><strong>الاسم:</strong> ${escapeHtml(c.name)}</div>
      <div class="row"><strong>الهاتف:</strong> ${escapeHtml(c.phone1)}</div>
      ${c.whatsapp ? `<div class="row"><strong>واتساب:</strong> ${escapeHtml(c.whatsapp)}</div>` : ''}
      <div class="row"><strong>الفرع:</strong> ${escapeHtml(br)}</div>
      ${area ? `<div class="row"><strong>المنطقة:</strong> ${escapeHtml(area)}</div>` : ''}
      <div class="row"><strong>العنوان:</strong> ${escapeHtml(c.address)}</div>
      ${c.notes ? `<div class="row muted"><strong>ملاحظات:</strong> ${escapeHtml(c.notes)}</div>` : ''}
      <p class="muted" style="margin-top:16px">Created By PIXEL 01</p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  function escapeHtml(s: string) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.phone1.trim() || !addForm.address.trim()) {
      toast({ title: 'خطأ', description: 'الاسم والهاتف والعنوان مطلوبون', variant: 'destructive' });
      return;
    }
    if (sectors.length > 0 && (sectorId === 'none' || !addForm.area_id)) {
      toast({ title: 'خطأ', description: 'اختر القطاع ثم المنطقة (مهم لتصنيف العملاء)', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      if (editCustomer) {
        const updatePayload: Record<string, unknown> = {
          name: addForm.name.trim(),
          phone1: addForm.phone1,
          phone2: addForm.phone2 || '',
          whatsapp: addForm.whatsapp || '',
          address: addForm.address.trim(),
          region: addForm.region || '',
          notes: addForm.notes || '',
          branch: canonicalBranchForSave(customerBranch),
          customer_code: (addForm.customer_code || '').trim() || null,
        };
        if (addForm.area_id) updatePayload.area_id = addForm.area_id;
        let { error } = await supabase.from('customers').update(updatePayload).eq('id', editCustomer.id);
        if (error) {
          const removed = stripUnknownColumnFromPayload(String(error.message || ''), updatePayload);
          if (!removed) throw error;
          const r2 = await supabase.from('customers').update(updatePayload).eq('id', editCustomer.id);
          if (r2.error) throw r2.error;
        }
        // Keep device code aligned with customer code when available.
        if ((addForm.customer_code || '').trim()) {
          try {
            const { data: firstDev } = await (supabase as any)
              .from('customer_devices')
              .select('id')
              .eq('customer_id', editCustomer.id)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            if (firstDev?.id) {
              await (supabase as any)
                .from('customer_devices')
                .update({ customer_code: (addForm.customer_code || '').trim() })
                .eq('id', firstDev.id);
            } else {
              // No device exists — create a placeholder to hold the customer code
              await (supabase as any).from('customer_devices').insert({
                customer_id: editCustomer.id,
                product_name: '-',
                device_type: '-',
                serial_number: '',
                warranty_months: 0,
                contract_type: 'كاش',
                selling_price: 0,
                total_price: 0,
                installments_count: 0,
                installment_amount: 0,
                branch: canonicalBranchForSave(customerBranch),
                customer_code: (addForm.customer_code || '').trim(),
                notes: '',
              } as any);
            }
          } catch {
            // non-blocking
          }
        }

        // تعديل بيانات العقد/الجهاز المرتبط بالعميل (أول جهاز افتراضيًا)
        if (addForm.device_id) {
          const { error: devErr } = await (supabase as any)
            .from('customer_devices')
            .update({
              product_name: addForm.device_product_name.trim(),
              device_type: addForm.device_type.trim(),
              serial_number: addForm.device_serial_number.trim(),
              install_date: addForm.device_install_date || null,
              warranty_months: Math.max(1, Number(addForm.device_warranty_months) || 12),
              contract_type: addForm.device_contract_type || 'كاش',
              selling_price: Number(addForm.device_selling_price) || 0,
              total_price: Number(addForm.device_total_price) || 0,
              contract_value: Number(addForm.contract_value || addForm.device_total_price) || 0,
              contract_duration_months: Math.max(0, Number(addForm.contract_duration_months) || 0),
              contract_start_date: addForm.contract_start_date || addForm.device_install_date || null,
              contract_end_date: addForm.contract_end_date || calcContractEndDate(addForm.contract_start_date || addForm.device_install_date, addForm.contract_duration_months) || null,
              contract_first_visit_date: addForm.contract_first_visit_date || null,
              contract_installment_interval_months: Math.max(1, Number(addForm.maintenance_interval) || 1),
              installments_count: Number(addForm.device_installments_count) || 0,
              installment_amount: Number(addForm.device_installment_amount) || 0,
              first_installment_date: addForm.device_first_installment_date || null,
              customer_code: addForm.device_customer_code.trim(),
              notes: addForm.device_notes.trim(),
              ad_source: addForm.device_ad_source.trim(),
              branch: canonicalBranchForSave(customerBranch),
            } as any)
            .eq('id', addForm.device_id);
          if (devErr) throw devErr;

          if (addForm.device_contract_type === 'عقد صيانة') {
            const existing = await (supabase as any)
              .from('installments')
              .select('id')
              .eq('device_id', addForm.device_id)
              .limit(1);
            if (!Array.isArray(existing?.data) || existing.data.length === 0) {
              const interval = Math.max(1, Number(addForm.maintenance_interval) || 1);
              let amounts: number[] = [];
              if (addForm.maintenance_amounts.trim()) {
                amounts = addForm.maintenance_amounts
                  .split(/[،,\s]+/)
                  .map((x: string) => Number(x))
                  .filter((x: number) => Number.isFinite(x) && x > 0);
              } else {
                const totalVal = Number(addForm.contract_value) || 0;
                const count = Number(addForm.contract_installments_count) || 0;
                if (totalVal > 0 && count > 0) {
                  const perInst = Math.round((totalVal / count) * 100) / 100;
                  amounts = Array.from({ length: count }, () => perInst);
                }
              }
              if (amounts.length > 0) {
                const start = addForm.maintenance_first_date ? new Date(addForm.maintenance_first_date) : new Date();
                const rows = amounts.map((amount: number, index: number) => {
                  const d = new Date(start);
                  d.setMonth(d.getMonth() + index * interval);
                  return {
                    id: crypto.randomUUID(),
                    customer_id: editCustomer.id,
                    device_id: addForm.device_id,
                    installment_date: d.toISOString().slice(0, 10),
                    amount,
                    status: 'معلق',
                    collection_date: null,
                  };
                });
                await (supabase as any).from('installments').insert(rows as any).catch(() => {});
              }
            }
          }
        }

        toast({ title: 'تم تعديل العميل بنجاح' });
        setEditCustomer(null);
        await fetchCustomers();
      } else {
        const newId = crypto.randomUUID();
        const insertPayload: Record<string, unknown> = {
          id: newId,
          name: addForm.name.trim(),
          phone1: addForm.phone1,
          phone2: addForm.phone2 || '',
          whatsapp: addForm.whatsapp || '',
          address: addForm.address.trim(),
          region: addForm.region || '',
          notes: addForm.notes || '',
          branch: canonicalBranchForSave(customerBranch),
          created_by: user?.id,
          customer_code: (addForm.customer_code || '').trim() || null,
        };
        if (addForm.area_id) insertPayload.area_id = addForm.area_id;

        // Try insert — if any column doesn't exist, retry without problematic columns
        let { error } = await supabase.from('customers').insert(insertPayload);
        if (error) {
          // Strip any unknown columns and retry once
          const removed = stripUnknownColumnFromPayload(String(error.message || ''), insertPayload);
          if (removed) {
            const r2 = await supabase.from('customers').insert(insertPayload);
            if (r2.error) throw r2.error;
          } else {
            throw error;
          }
        }

        // Add customer to local list immediately — no need to re-fetch
        const newCustomer: Customer = {
          id: newId,
          name: addForm.name.trim(),
          phone1: addForm.phone1,
          phone2: addForm.phone2 || '',
          whatsapp: addForm.whatsapp || '',
          address: addForm.address.trim(),
          region: addForm.region || '',
          area_id: addForm.area_id || null,
          branch: canonicalBranchForSave(customerBranch),
          customer_type: addForm.customer_type || 'sales',
          notes: addForm.notes || '',
          customer_code: (addForm.customer_code || '').trim() || null,
        };
        setCustomers((prev) => [newCustomer, ...prev]);

        // Create device if device info was filled
        const shouldCreateDevice = !!addForm.device_product_name.trim();
        if (shouldCreateDevice) {
          const { error: deviceError } = await (supabase as any).from('customer_devices').insert({
            customer_id: newId,
            product_name: addForm.device_product_name.trim(),
            device_type: addForm.device_type.trim(),
            serial_number: addForm.device_serial_number.trim(),
            install_date: addForm.device_install_date || null,
            warranty_months: Math.max(1, Number(addForm.device_warranty_months) || 12),
            contract_type: addForm.device_contract_type || 'كاش',
            selling_price: Number(addForm.device_selling_price) || 0,
            total_price: Number(addForm.device_total_price) || 0,
            contract_value: Number(addForm.contract_value || addForm.device_total_price) || 0,
            contract_duration_months: Math.max(0, Number(addForm.contract_duration_months) || 0),
            contract_start_date: addForm.contract_start_date || addForm.device_install_date || null,
            contract_end_date: addForm.contract_end_date || calcContractEndDate(addForm.contract_start_date || addForm.device_install_date, addForm.contract_duration_months) || null,
            contract_first_visit_date: addForm.contract_first_visit_date || null,
            contract_installment_interval_months: Math.max(1, Number(addForm.maintenance_interval) || 1),
            installments_count: Number(addForm.device_installments_count) || 0,
            installment_amount: Number(addForm.device_installment_amount) || 0,
            first_installment_date: addForm.device_first_installment_date || null,
            branch: canonicalBranchForSave(customerBranch),
            customer_code: (addForm.device_customer_code || addForm.customer_code || '').trim(),
            notes: addForm.device_notes.trim(),
            ad_source: addForm.device_ad_source.trim(),
            created_by: user?.id,
          } as any);
          if (deviceError) {
            toast({ title: 'تنبيه', description: 'تم حفظ العميل لكن فشل حفظ بيانات الجهاز: ' + deviceError.message, variant: 'destructive' });
          } else if (addForm.device_contract_type === 'عقد صيانة') {
            const interval = Math.max(1, Number(addForm.maintenance_interval) || 1);
            let amounts: number[] = [];
            if (addForm.maintenance_amounts.trim()) {
              amounts = addForm.maintenance_amounts
                .split(/[،,\s]+/)
                .map((x: string) => Number(x))
                .filter((x: number) => Number.isFinite(x) && x > 0);
            } else {
              const totalVal = Number(addForm.contract_value) || 0;
              const count = Number(addForm.contract_installments_count) || 0;
              if (totalVal > 0 && count > 0) {
                const perInst = Math.round((totalVal / count) * 100) / 100;
                amounts = Array.from({ length: count }, () => perInst);
              }
            }
            if (amounts.length > 0) {
              const start = addForm.maintenance_first_date ? new Date(addForm.maintenance_first_date) : new Date();
              const { data: devData } = await (supabase as any)
                .from('customer_devices')
                .select('id')
                .eq('customer_id', newId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              const deviceId = devData?.id;
              if (deviceId) {
                const rows = amounts.map((amount: number, index: number) => {
                  const d = new Date(start);
                  d.setMonth(d.getMonth() + index * interval);
                  return {
                    id: crypto.randomUUID(),
                    customer_id: newId,
                    device_id: deviceId,
                    installment_date: d.toISOString().slice(0, 10),
                    amount,
                    status: 'معلق',
                    collection_date: null,
                  };
                });
                await (supabase as any).from('installments').insert(rows as any).catch(() => {});
              }
            }
          }
        }

        toast({ title: shouldCreateDevice ? 'تم إضافة العميل والجهاز بنجاح' : 'تم إضافة العميل بنجاح' });
      }
      setAddOpen(false);
      setAreaSearch('');
      setShowAreaSearchResults(false);
      setAddForm({
        name: '',
        customer_code: nextCustomerCode,
        phone1: '',
        phone2: '',
        whatsapp: '',
        address: '',
        region: '',
        notes: '',
        area_id: '',
        customer_type: 'sales',
        device_product_name: '',
        device_type: '',
        device_serial_number: '',
        device_install_date: '',
        device_warranty_months: '12',
        device_contract_type: 'كاش',
        device_selling_price: '0',
        device_total_price: '0',
        device_installments_count: '0',
        device_installment_amount: '0',
        device_first_installment_date: '',
        device_customer_code: '',
        device_notes: '',
        device_ad_source: '',
        device_id: '',
        maintenance_interval: '1',
        maintenance_first_date: '',
        maintenance_amounts: '',
        contract_duration_months: '12',
        contract_start_date: '',
        contract_end_date: '',
        contract_first_visit_date: '',
        contract_value: '0',
        contract_installments_count: '0',
      });
      setSectorId('none');
      setCustomerBranch(branch);
    } catch (err: unknown) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEditCustomer = async (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCustomer(c);
    setCustomerBranch(c.branch || branch);
    const area = areasForForm.find((a) => a.id === c.area_id) || areas.find((a) => a.id === c.area_id);
    setSectorId(area?.parent_id ?? 'none');
    const devRes = await (supabase as any)
      .from('customer_devices')
      .select('*')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false });
    const devices = Array.isArray(devRes?.data) ? devRes.data : [];
    setEditDevices(devices);
    const dev = devices[0] || null;
    setAreaSearch(areaName(c.area_id) || '');
    setShowAreaSearchResults(false);
    setAddForm({
      name: c.name,
      customer_code: (c as Customer).customer_code || '',
      phone1: c.phone1 || '',
      phone2: c.phone2 || '',
      whatsapp: c.whatsapp || '',
      address: c.address || '',
      region: c.region || '',
      notes: c.notes || '',
      area_id: c.area_id || '',
      customer_type: (c as Customer).customer_type || 'sales',
      device_product_name: dev?.product_name || '',
      device_type: dev?.device_type || '',
      device_serial_number: dev?.serial_number || '',
      device_install_date: dev?.install_date || '',
      device_warranty_months: String(dev?.warranty_months ?? 12),
      device_contract_type: dev?.contract_type || 'كاش',
      device_selling_price: String(dev?.selling_price ?? 0),
      device_total_price: String(dev?.total_price ?? 0),
      device_installments_count: String(dev?.installments_count ?? 0),
      device_installment_amount: String(dev?.installment_amount ?? 0),
      device_first_installment_date: dev?.first_installment_date || '',
      device_customer_code: dev?.customer_code || '',
      device_notes: dev?.notes || '',
      device_ad_source: dev?.ad_source || '',
      device_id: dev?.id || '',
      maintenance_interval: String(dev?.contract_installment_interval_months ?? 1),
      maintenance_first_date: dev?.first_installment_date || '',
      maintenance_amounts: '',
      contract_duration_months: String(dev?.contract_duration_months ?? 12),
      contract_start_date: dev?.contract_start_date || '',
      contract_end_date: dev?.contract_end_date || '',
      contract_first_visit_date: dev?.contract_first_visit_date || '',
      contract_value: String(dev?.contract_value ?? dev?.total_price ?? 0),
      contract_installments_count: String(dev?.installments_count ?? 0),
    });
    setAddOpen(true);
  };

  const handleDeleteCustomer = async (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`هل تريد حذف العميل "${c.name}"؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', c.id);
      if (error) throw error;
      toast({ title: 'تم حذف العميل' });
      fetchCustomers();
      if (selectedCustomer?.id === c.id) setDetailOpen(false);
    } catch (err: unknown) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const openDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailOpen(true);
  };

  const resetAddDialog = () => {
    setEditCustomer(null);
    setEditDevices([]);
    setAreaSearch('');
    setShowAreaSearchResults(false);
    setSectorId('none');
    setCustomerBranch(branch);
    setAddForm({
      name: '',
      customer_code: nextCustomerCode,
      phone1: '',
      phone2: '',
      whatsapp: '',
      address: '',
      region: '',
      notes: '',
      area_id: '',
      customer_type: 'sales',
      device_product_name: '',
      device_type: '',
      device_serial_number: '',
      device_install_date: '',
      device_warranty_months: '12',
      device_contract_type: 'كاش',
      device_selling_price: '0',
      device_total_price: '0',
      device_installments_count: '0',
      device_installment_amount: '0',
      device_first_installment_date: '',
      device_customer_code: '',
      device_notes: '',
      device_ad_source: '',
      device_id: '',
      maintenance_interval: '1',
      maintenance_first_date: '',
      maintenance_amounts: '',
      contract_duration_months: '12',
      contract_start_date: '',
      contract_end_date: '',
      contract_first_visit_date: '',
      contract_value: '0',
      contract_installments_count: '0',
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="text-muted-foreground text-sm">{customers.length} عميل — عرض فرع: {branch}</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            resetAddDialog();
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> إضافة عميل
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم، العنوان، التلفون أو كود العميل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {areaChipStats.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">تصفية سريعة بالمنطقة</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={areaFilterId === null ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setAreaFilterId(null)}
            >
              الكل ({customers.length})
            </Button>
            {areaChipStats.map((a) => (
              <Button
                key={a.id}
                type="button"
                size="sm"
                variant={areaFilterId === a.id ? 'default' : 'outline'}
                className="h-8 text-xs gap-1"
                onClick={() => setAreaFilterId((prev) => (prev === a.id ? null : a.id))}
              >
                <MapPin className="h-3 w-3" />
                {a.name}
                <Badge variant="secondary" className="text-[10px] px-1">
                  {a.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((customer, i) => (
            <motion.div key={customer.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="card-shadow hover:card-shadow-lg transition-shadow cursor-pointer" onClick={() => openDetail(customer)}>
                <CardContent className="p-5 space-y-3 relative">
                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary hover:bg-primary/10"
                      onClick={(e) => printFollowUpCard(customer, e)}
                      title="طباعة كارت متابعة"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:bg-green-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        const n = (customer.whatsapp || customer.phone1 || '').replace(/[^0-9]/g, '');
                        const w = n.startsWith('0') ? '20' + n.slice(1) : n.startsWith('20') ? n : '20' + n;
                        if (w) window.open(`https://wa.me/${w}`, '_blank');
                      }}
                      title="إرسال واتساب"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => openEditCustomer(customer, e)} title="تعديل">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteCustomer(customer, e)}
                      title="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 pr-10">
                    <span className="text-xs text-muted-foreground font-mono">#{i + 1}</span>
                    <h3 className="font-bold text-base">{customer.name}</h3>
                  </div>
                  {(customer.customer_code || (deviceCodesByCustomer[customer.id] || [])[0]) && (
                    <Badge variant="secondary" className="text-[10px] w-fit">
                      كود: {customer.customer_code || (deviceCodesByCustomer[customer.id] || [])[0]}
                    </Badge>
                  )}
                  {customer.branch && (
                    <Badge variant="outline" className="text-[10px] w-fit">
                      {customer.branch.replace('فرع ', '')}
                    </Badge>
                  )}
                  {areaName(customer.area_id) && (
                    <Badge variant="secondary" className="text-[10px] w-fit gap-1">
                      <MapPin className="h-3 w-3" />
                      {areaName(customer.area_id)}
                    </Badge>
                  )}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{customer.phone1}</span>
                      {customer.phone2 && <span className="text-muted-foreground">| {customer.phone2}</span>}
                    </div>
                    {customer.whatsapp && (
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                        <span>{customer.whatsapp}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{customer.address}</span>
                    </div>
                  </div>
                  {customer.notes && <p className="text-xs bg-accent/50 text-accent-foreground p-2 rounded-lg">{customer.notes}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetAddDialog();
        }}
      >
        <DialogContent className="max-w-sm p-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">{editCustomer ? 'تعديل عميل' : 'إضافة عميل جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>
              <Label className="text-xs">فرع العميل *</Label>
              <Select
                value={customerBranch}
                onValueChange={(v) => {
                  setCustomerBranch(v);
                  setSectorId('none');
                  setAddForm((f) => ({ ...f, area_id: '' }));
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANCH_OPTIONS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">بعدها تظهر مناطق هذا الفرع فقط</p>
            </div>
            <div>
              <Label className="text-xs">نوع العميل</Label>
              <Select value={addForm.customer_type || 'sales'} onValueChange={(v) => setAddForm((p) => ({ ...p, customer_type: v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">عميل مبيعات</SelectItem>
                  <SelectItem value="maintenance">عميل صيانة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">اسم العميل *</Label>
              <Input className="h-8 text-sm" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="الاسم" />
            </div>
            <div>
              <Label className="text-xs">كود العميل</Label>
              <Input
                className="h-8 text-sm"
                dir="ltr"
                value={addForm.customer_code}
                onChange={(e) => setAddForm((p) => ({ ...p, customer_code: e.target.value }))}
                placeholder="للبحث والتمييز — اختياري"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">الهاتف *</Label>
                <Input className="h-8 text-sm" value={addForm.phone1} onChange={(e) => setAddForm((p) => ({ ...p, phone1: e.target.value }))} placeholder="الهاتف" />
              </div>
              <div>
                <Label className="text-xs">رقم اضافي</Label>
                <Input className="h-8 text-sm" value={addForm.phone2} onChange={(e) => setAddForm((p) => ({ ...p, phone2: e.target.value }))} placeholder="اختياري" />
              </div>
              <div>
                <Label className="text-xs">واتساب</Label>
                <Input className="h-8 text-sm" value={addForm.whatsapp} onChange={(e) => setAddForm((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="اختياري" />
              </div>
            </div>
            <div>
              <Label className="text-xs">العنوان *</Label>
              <Input className="h-8 text-sm" value={addForm.address} onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))} placeholder="العنوان التفصيلي" />
            </div>
            <div>
              <Label className="text-xs">تفاصيل إضافية للمنطقة (اختياري)</Label>
              <Input className="h-8 text-sm" value={addForm.region} onChange={(e) => setAddForm((p) => ({ ...p, region: e.target.value }))} placeholder="مثال: شارع، علامة مميزة" />
            </div>
            {sectors.length > 0 ? (
              <>
                <div>
                  <Label className="text-xs">القطاع *</Label>
                  <Select
                    value={sectorId}
                    onValueChange={(v) => {
                      setSectorId(v);
                      setAddForm((p) => ({ ...p, area_id: '' }));
                      setAreaSearch('');
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="اختر القطاع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— اختر —</SelectItem>
                      {sectors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">المنطقة *</Label>
                  <div className="relative mb-1">
                    <Input
                      className="h-8 text-sm"
                      value={areaSearch}
                      onChange={(e) => {
                        setAreaSearch(e.target.value);
                        setShowAreaSearchResults(true);
                      }}
                      onFocus={() => setShowAreaSearchResults(true)}
                      onBlur={() => setTimeout(() => setShowAreaSearchResults(false), 150)}
                      placeholder={sectorId !== 'none' ? 'ابحث عن المنطقة (مثال: ف)' : 'اختر القطاع أولاً'}
                      disabled={sectorId === 'none'}
                    />
                    {showAreaSearchResults && sectorId !== 'none' && areaSearch.trim() && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-40 overflow-y-auto">
                        {filteredAreaSearchOptions.length > 0 ? (
                          filteredAreaSearchOptions.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className="w-full text-right px-2 py-1.5 text-xs hover:bg-accent/50 border-b last:border-0"
                              onClick={() => {
                                setAddForm((p) => ({ ...p, area_id: a.id }));
                                setAreaSearch(a.name);
                                setShowAreaSearchResults(false);
                              }}
                            >
                              {a.name}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-1.5 text-xs text-muted-foreground">لا توجد مناطق مطابقة</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Select
                    value={addForm.area_id || 'none'}
                    onValueChange={(v) => {
                      const picked = v === 'none' ? '' : v;
                      setAddForm((p) => ({ ...p, area_id: picked }));
                      const selectedArea = areaOptions.find((a) => a.id === picked);
                      setAreaSearch(selectedArea?.name || '');
                    }}
                    disabled={sectorId === 'none'}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={sectorId !== 'none' ? 'اختر المنطقة' : 'اختر القطاع أولاً'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none">— اختر —</SelectItem>
                      {areaOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-500/10 rounded p-2">
                لا توجد مناطق مسجلة لهذا الفرع. أضفها من «القطاعات والمناطق» بنفس اسم الفرع.
              </p>
            )}
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Textarea className="text-sm min-h-[60px]" value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات" rows={2} />
            </div>
            {editCustomer && (
              <div className="border rounded-md p-2 space-y-2 bg-muted/10">
                <p className="text-xs font-semibold">تعديل بيانات العقد / الجهاز</p>
                {addForm.device_id ? (
                  <>
                    {editDevices.length > 1 && (
                      <div>
                        <Label className="text-xs">اختيار الجهاز</Label>
                        <Select
                          value={addForm.device_id}
                          onValueChange={(id) => {
                            const dev = editDevices.find((d) => d.id === id) || null;
                            applyDeviceToForm(dev);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {editDevices.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {(d.product_name || 'جهاز')} {d.serial_number ? `- ${d.serial_number}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">اسم المنتج</Label>
                      <Input className="h-8 text-sm" value={addForm.device_product_name} onChange={(e) => setAddForm((p) => ({ ...p, device_product_name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">تاريخ التركيب</Label>
                        <Input type="date" className="h-8 text-sm" value={addForm.device_install_date} onChange={(e) => setAddForm((p) => ({ ...p, device_install_date: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">مدة الضمان (شهور)</Label>
                        <Input type="number" min={1} className="h-8 text-sm" value={addForm.device_warranty_months} onChange={(e) => setAddForm((p) => ({ ...p, device_warranty_months: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">نوع العقد</Label>
                        <Select value={addForm.device_contract_type} onValueChange={(v) => setAddForm((p) => ({ ...p, device_contract_type: v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="كاش">كاش</SelectItem>
                            <SelectItem value="تقسيط">تقسيط</SelectItem>
                            <SelectItem value="عقد صيانة">عقد صيانة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">الرقم المسلسل</Label>
                        <Input className="h-8 text-sm" value={addForm.device_serial_number} onChange={(e) => setAddForm((p) => ({ ...p, device_serial_number: e.target.value }))} />
                      </div>
                    </div>
                    {addForm.device_contract_type === 'عقد صيانة' && (() => {
                      const autoCount = Number(addForm.contract_installments_count) || 0;
                      const autoVal = Number(addForm.contract_value) || 0;
                      const autoPerInst = autoCount > 0 && autoVal > 0 ? Math.round((autoVal / autoCount) * 100) / 100 : 0;
                      return (
                      <div className="grid grid-cols-2 gap-2 border-t pt-2">
                        <div>
                          <Label className="text-xs">قيمة العقد</Label>
                          <Input type="number" className="h-8 text-sm" value={addForm.contract_value || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_value: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">مدة العقد (شهور)</Label>
                          <Input type="number" className="h-8 text-sm" value={addForm.contract_duration_months || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_duration_months: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">بداية العقد</Label>
                          <Input type="date" className="h-8 text-sm" value={addForm.contract_start_date || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_start_date: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">نهاية العقد</Label>
                          <Input type="date" className="h-8 text-sm" value={addForm.contract_end_date || (addForm.contract_start_date ? calcContractEndDate(addForm.contract_start_date, addForm.contract_duration_months) : '')} onChange={(e) => setAddForm((p) => ({ ...p, contract_end_date: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">تاريخ أول زيارة</Label>
                          <Input type="date" className="h-8 text-sm" value={addForm.contract_first_visit_date || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_first_visit_date: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">عدد الأقساط</Label>
                          <Input type="number" min={0} className="h-8 text-sm" value={addForm.contract_installments_count || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_installments_count: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">فاصل الدفعات (بالشهور)</Label>
                          <Select value={addForm.maintenance_interval || '1'} onValueChange={(v) => setAddForm((p) => ({ ...p, maintenance_interval: v }))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">كل شهر</SelectItem>
                              <SelectItem value="2">كل شهرين</SelectItem>
                              <SelectItem value="3">كل 3 شهور</SelectItem>
                              <SelectItem value="4">كل 4 شهور</SelectItem>
                              <SelectItem value="6">كل 6 شهور</SelectItem>
                              <SelectItem value="12">سنوياً</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">تاريخ أول دفعة</Label>
                          <Input type="date" className="h-8 text-sm" value={addForm.maintenance_first_date || ''} onChange={(e) => setAddForm((p) => ({ ...p, maintenance_first_date: e.target.value }))} />
                        </div>
                        {autoPerInst > 0 && (
                          <div className="col-span-2 rounded bg-muted/50 p-2 text-xs text-center">
                            سيتم إنشاء <strong>{autoCount}</strong> قسط بقيمة <strong>{autoPerInst.toLocaleString('ar-EG')} ج.م</strong> لكل قسط تلقائياً
                          </div>
                        )}
                        <div className="col-span-2">
                          <Label className="text-xs">أو أدخل مبالغ يدوية (مفصولة بفاصلة: 350، 400، 450)</Label>
                          <Input className="h-8 text-sm" placeholder="اتركه فارغ للحساب التلقائي" value={addForm.maintenance_amounts || ''} onChange={(e) => setAddForm((p) => ({ ...p, maintenance_amounts: e.target.value }))} />
                        </div>
                      </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">لا يوجد جهاز مرتبط بهذا العميل للتعديل.</p>
                )}
              </div>
            )}
            {!editCustomer && (
              <div className="border rounded-md p-2 space-y-2 bg-muted/20">
                <p className="text-xs font-semibold">بيانات الجهاز (اختياري مع تسجيل العميل)</p>
                <div>
                  <Label className="text-xs">اسم المنتج</Label>
                  <Input className="h-8 text-sm" value={addForm.device_product_name} onChange={(e) => setAddForm((p) => ({ ...p, device_product_name: e.target.value }))} placeholder="مثال: فلتر 7 مراحل" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">نوع الجهاز</Label>
                    <Input className="h-8 text-sm" value={addForm.device_type} onChange={(e) => setAddForm((p) => ({ ...p, device_type: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">الرقم المسلسل</Label>
                    <Input className="h-8 text-sm" value={addForm.device_serial_number} onChange={(e) => setAddForm((p) => ({ ...p, device_serial_number: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">تاريخ التركيب</Label>
                    <Input type="date" className="h-8 text-sm" value={addForm.device_install_date} onChange={(e) => setAddForm((p) => ({ ...p, device_install_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">الضمان (شهور)</Label>
                    <Input type="number" min={1} className="h-8 text-sm" value={addForm.device_warranty_months} onChange={(e) => setAddForm((p) => ({ ...p, device_warranty_months: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">نوع العقد</Label>
                    <Select value={addForm.device_contract_type} onValueChange={(v) => setAddForm((p) => ({ ...p, device_contract_type: v }))}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="كاش">كاش</SelectItem>
                        <SelectItem value="تقسيط">تقسيط</SelectItem>
                        <SelectItem value="عقد صيانة">عقد صيانة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">كود العميل</Label>
                    <Input className="h-8 text-sm" value={addForm.device_customer_code} onChange={(e) => setAddForm((p) => ({ ...p, device_customer_code: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">سعر البيع</Label>
                    <Input type="number" min={0} className="h-8 text-sm" value={addForm.device_selling_price} onChange={(e) => setAddForm((p) => ({ ...p, device_selling_price: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">الإجمالي</Label>
                    <Input type="number" min={0} className="h-8 text-sm" value={addForm.device_total_price} onChange={(e) => setAddForm((p) => ({ ...p, device_total_price: e.target.value }))} />
                  </div>
                </div>
                {addForm.device_contract_type === 'عقد صيانة' && (() => {
                  const autoCount = Number(addForm.contract_installments_count) || 0;
                  const autoVal = Number(addForm.contract_value) || 0;
                  const autoPerInst = autoCount > 0 && autoVal > 0 ? Math.round((autoVal / autoCount) * 100) / 100 : 0;
                  return (
                  <div className="grid grid-cols-2 gap-2 border-t pt-2">
                    <div>
                      <Label className="text-xs">قيمة العقد</Label>
                      <Input type="number" className="h-8 text-sm" value={addForm.contract_value || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_value: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">مدة العقد (شهور)</Label>
                      <Input type="number" className="h-8 text-sm" value={addForm.contract_duration_months || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_duration_months: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">بداية العقد</Label>
                      <Input type="date" className="h-8 text-sm" value={addForm.contract_start_date || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_start_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">نهاية العقد</Label>
                      <Input type="date" className="h-8 text-sm" value={addForm.contract_end_date || (addForm.contract_start_date ? calcContractEndDate(addForm.contract_start_date, addForm.contract_duration_months) : '')} onChange={(e) => setAddForm((p) => ({ ...p, contract_end_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">تاريخ أول زيارة</Label>
                      <Input type="date" className="h-8 text-sm" value={addForm.contract_first_visit_date || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_first_visit_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">عدد الأقساط</Label>
                      <Input type="number" min={0} className="h-8 text-sm" value={addForm.contract_installments_count || ''} onChange={(e) => setAddForm((p) => ({ ...p, contract_installments_count: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">فاصل الدفعات (بالشهور)</Label>
                      <Select value={addForm.maintenance_interval || '1'} onValueChange={(v) => setAddForm((p) => ({ ...p, maintenance_interval: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">كل شهر</SelectItem>
                          <SelectItem value="2">كل شهرين</SelectItem>
                          <SelectItem value="3">كل 3 شهور</SelectItem>
                          <SelectItem value="4">كل 4 شهور</SelectItem>
                          <SelectItem value="6">كل 6 شهور</SelectItem>
                          <SelectItem value="12">سنوياً</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">تاريخ أول دفعة</Label>
                      <Input type="date" className="h-8 text-sm" value={addForm.maintenance_first_date || ''} onChange={(e) => setAddForm((p) => ({ ...p, maintenance_first_date: e.target.value }))} />
                    </div>
                    {autoPerInst > 0 && (
                      <div className="col-span-2 rounded bg-muted/50 p-2 text-xs text-center">
                        سيتم إنشاء <strong>{autoCount}</strong> قسط بقيمة <strong>{autoPerInst.toLocaleString('ar-EG')} ج.م</strong> لكل قسط تلقائياً
                      </div>
                    )}
                    <div className="col-span-2">
                      <Label className="text-xs">أو أدخل مبالغ يدوية (مفصولة بفاصلة: 350، 400، 450)</Label>
                      <Input className="h-8 text-sm" placeholder="اتركه فارغ للحساب التلقائي" value={addForm.maintenance_amounts || ''} onChange={(e) => setAddForm((p) => ({ ...p, maintenance_amounts: e.target.value }))} />
                    </div>
                  </div>
                  );
                })()}
                {addForm.device_contract_type === 'تقسيط' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">عدد الأقساط</Label>
                      <Input type="number" min={0} className="h-8 text-sm" value={addForm.device_installments_count} onChange={(e) => setAddForm((p) => ({ ...p, device_installments_count: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">قيمة القسط</Label>
                      <Input type="number" min={0} className="h-8 text-sm" value={addForm.device_installment_amount} onChange={(e) => setAddForm((p) => ({ ...p, device_installment_amount: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">أول قسط</Label>
                      <Input type="date" className="h-8 text-sm" value={addForm.device_first_installment_date} onChange={(e) => setAddForm((p) => ({ ...p, device_first_installment_date: e.target.value }))} />
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">مصدر الإعلان</Label>
                  <Input className="h-8 text-sm" value={addForm.device_ad_source} onChange={(e) => setAddForm((p) => ({ ...p, device_ad_source: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">ملاحظات الجهاز</Label>
                  <Textarea className="text-sm min-h-[50px]" value={addForm.device_notes} onChange={(e) => setAddForm((p) => ({ ...p, device_notes: e.target.value }))} rows={2} />
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? 'جاري الحفظ...' : editCustomer ? 'تعديل' : 'حفظ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CustomerDetailDialog customer={selectedCustomer} open={detailOpen} onOpenChange={setDetailOpen} />
    </motion.div>
  );
}
