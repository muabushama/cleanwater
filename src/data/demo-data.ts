// Demo data for the Egyptian water filter company CRM/ERP

export const branches = [
  { id: '1', name: 'فرع الإسكندرية', city: 'الإسكندرية', address: '1 ش 45 العصافرة بحري أعلى النفق برج بانوراما' },
  { id: '2', name: 'فرع الجيزة', city: 'الجيزة', address: '3 ش عمار بن ياسر من ش الهرم بجوار بي تك ومحطة مترو الجيزة' },
];

export const companyInfo = {
  name: 'كلين ووتر',
  subtitle: 'لتكنولوجيا معالجة مياه الشرب',
  branches: [
    'فرع الإسكندرية: 1 ش 45 العصافرة بحري أعلى النفق برج بانوراما',
    'فرع الجيزة: 3 ش عمار بن ياسر من ش الهرم بجوار بي تك ومحطة مترو الجيزة',
  ],
  customerService: ['01288801487', '01273222080', '01201009319', '01224569131', '01208581115', '035561302'],
  hotline: '01210891111',
  techManagement: '01273297773',
  workingHours: '10ص : 5 م',
};

export const users = [
  { id: '1', name: 'أحمد حسن', email: 'admin@purewater-eg.com', role: 'admin', branch: '1', avatar: '' },
  { id: '2', name: 'محمد علي', email: 'manager@purewater-eg.com', role: 'manager', branch: '1', avatar: '' },
  { id: '3', name: 'خالد إبراهيم', email: 'rep@purewater-eg.com', role: 'sales_rep', branch: '1', avatar: '' },
  { id: '4', name: 'سارة أحمد', email: 'support@purewater-eg.com', role: 'customer_service', branch: '1', avatar: '' },
  { id: '5', name: 'عمر محمود', role: 'sales_rep', branch: '2', email: '', avatar: '' },
];

export const products = [
  { id: '1', name: 'فلتر 7 مراحل تايواني', category: 'فلاتر مياه', classification: 'منزلي', cost: 2200, price: 3500, discount: 3200, warranty: 12, stock: 45, minStock: 10, image: '' },
  { id: '2', name: 'فلتر 5 مراحل أمريكي', category: 'فلاتر مياه', classification: 'منزلي', cost: 1500, price: 2500, discount: 2300, warranty: 12, stock: 30, minStock: 8, image: '' },
  { id: '3', name: 'محطة تحلية 250 لتر/يوم', category: 'محطات تحلية', classification: 'تجاري', cost: 12000, price: 18000, discount: 17000, warranty: 24, stock: 5, minStock: 2, image: '' },
  { id: '4', name: 'محطة تحلية 500 لتر/يوم', category: 'محطات تحلية', classification: 'صناعي', cost: 25000, price: 38000, discount: 36000, warranty: 24, stock: 3, minStock: 1, image: '' },
  { id: '5', name: 'فلتر 3 مراحل اقتصادي', category: 'فلاتر مياه', classification: 'منزلي', cost: 800, price: 1400, discount: 1200, warranty: 6, stock: 80, minStock: 20, image: '' },
  { id: '6', name: 'شمعة فلتر مرحلة أولى', category: 'فلاتر مياه', classification: 'قطع غيار', cost: 30, price: 80, discount: 70, warranty: 3, stock: 200, minStock: 50, image: '' },
  { id: '7', name: 'محطة تحلية 1000 لتر/يوم', category: 'محطات تحلية', classification: 'صناعي', cost: 45000, price: 65000, discount: 62000, warranty: 36, stock: 2, minStock: 1, image: '' },
  { id: '8', name: 'فلتر مركزي للفيلا', category: 'فلاتر مياه', classification: 'فاخر', cost: 5000, price: 8500, discount: 8000, warranty: 24, stock: 12, minStock: 3, image: '' },
];

export const customers = [
  { id: '1', name: 'أحمد محمد عبدالله', phone1: '01012345678', phone2: '01112345678', whatsapp: '01012345678', address: 'المعادي - القاهرة', notes: 'عميل مميز' },
  { id: '2', name: 'شركة النور للتجارة', phone1: '01098765432', phone2: '01198765432', whatsapp: '01098765432', address: 'الدقي - الجيزة', notes: 'شركة - فواتير شهرية' },
  { id: '3', name: 'محمود حسين', phone1: '01055512345', phone2: '', whatsapp: '01055512345', address: 'سموحة - الإسكندرية', notes: '' },
  { id: '4', name: 'فندق النيل الأزرق', phone1: '01033344556', phone2: '01133344556', whatsapp: '01033344556', address: 'كورنيش النيل - القاهرة', notes: 'محطة تحلية كبيرة' },
  { id: '5', name: 'عائشة محمد', phone1: '01077788899', phone2: '', whatsapp: '01077788899', address: 'مدينة نصر - القاهرة', notes: 'صيانة دورية' },
];

export const invoices = [
  { id: 'INV-001-2026', customer: 'أحمد محمد عبدالله', product: 'فلتر 7 مراحل تايواني', amount: 3500, paid: 3500, remaining: 0, type: 'cash' as const, status: 'paid' as const, date: '2026-02-20', rep: 'خالد إبراهيم', branch: 'فرع الإسكندرية' },
  { id: 'INV-002-2026', customer: 'شركة النور للتجارة', product: 'محطة تحلية 250 لتر/يوم', amount: 18000, paid: 6000, remaining: 12000, type: 'installment' as const, status: 'partial' as const, date: '2026-02-18', rep: 'خالد إبراهيم', branch: 'فرع الإسكندرية' },
  { id: 'INV-003-2026', customer: 'محمود حسين', product: 'فلتر 5 مراحل أمريكي', amount: 2500, paid: 0, remaining: 2500, type: 'pending' as const, status: 'pending' as const, date: '2026-02-22', rep: 'عمر محمود', branch: 'فرع الجيزة' },
  { id: 'INV-004-2026', customer: 'فندق النيل الأزرق', product: 'محطة تحلية 1000 لتر/يوم', amount: 65000, paid: 30000, remaining: 35000, type: 'installment' as const, status: 'partial' as const, date: '2026-02-15', rep: 'خالد إبراهيم', branch: 'فرع الإسكندرية' },
  { id: 'INV-005-2026', customer: 'عائشة محمد', product: 'فلتر 3 مراحل اقتصادي', amount: 1400, paid: 1400, remaining: 0, type: 'cash' as const, status: 'paid' as const, date: '2026-02-25', rep: 'عمر محمود', branch: 'فرع الجيزة' },
];

export const maintenanceSchedule = [
  { id: 'M-001', customer: 'أحمد محمد عبدالله', product: 'فلتر 7 مراحل تايواني', nextDate: '2026-03-20', type: 'تغيير شمعات', technician: 'خالد إبراهيم', status: 'upcoming' as const },
  { id: 'M-002', customer: 'شركة النور للتجارة', product: 'محطة تحلية 250 لتر/يوم', nextDate: '2026-03-01', type: 'صيانة دورية', technician: 'عمر محمود', status: 'overdue' as const },
  { id: 'M-003', customer: 'عائشة محمد', product: 'فلتر 3 مراحل اقتصادي', nextDate: '2026-04-10', type: 'تغيير شمعات', technician: 'خالد إبراهيم', status: 'upcoming' as const },
  { id: 'M-004', customer: 'فندق النيل الأزرق', product: 'محطة تحلية 1000 لتر/يوم', nextDate: '2026-02-28', type: 'فحص شامل', technician: 'عمر محمود', status: 'overdue' as const },
];

export const workOrders = [
  {
    id: 'WO-001-2026',
    orderCode: '0100030380',
    customerCode: '0100000773',
    customerId: 526,
    customer: 'جمال محمد أحمد',
    address: '29 ش الشهيد عبدالله عبدالمحسن متفرع من جمال عبدالناصر أمام محمصة مطروح سيدي بشر بحري',
    phone: '01280761337',
    region: 'سيدي بشر',
    product: 'فلتر 7 مراحل تايواني',
    installDate: '28/01/2018',
    warrantyUntil: '28/01/2021',
    warrantyStatus: 'منتهي' as const,
    visitDate: '15/02/2026',
    visitTime: 'ميعاد الزياره',
    technician: 'داليا',
    notes: '',
    items: [
      { description: 'الشمعة 4 ممبرين', value: 550 },
      { description: '550 بدلا من 750 بعلم اساره', value: 550 },
    ],
    transportCost: 0,
    total: 550,
    previousVisits: [
      { date: '20/11/2025', details: 'الشمعة الأولى | الشمعة الثانية | الشمعة الثالثة [إجمالي: 300 مدفوع: 300]' },
      { date: '06/08/2025', details: 'الشمعة الأولى | الشمعة السابعة [إجمالي: 300 مدفوع: 300]' },
    ],
    status: 'completed' as const,
    branch: 'فرع الإسكندرية',
  },
  {
    id: 'WO-002-2026',
    orderCode: '0100030425',
    customerCode: '0100000890',
    customerId: 612,
    customer: 'شركة النور للتجارة',
    address: 'شارع الهرم - بجوار محطة مترو الجيزة',
    phone: '01098765432',
    region: 'الجيزة',
    product: 'محطة تحلية 250 لتر/يوم',
    installDate: '15/06/2024',
    warrantyUntil: '15/06/2026',
    warrantyStatus: 'ساري' as const,
    visitDate: '20/02/2026',
    visitTime: '10:00 ص',
    technician: 'عمر محمود',
    notes: 'صيانة دورية',
    items: [
      { description: 'تغيير فلتر رملي', value: 800 },
      { description: 'تغيير فلتر كربوني', value: 600 },
      { description: 'فحص ممبرين', value: 200 },
    ],
    transportCost: 50,
    total: 1650,
    previousVisits: [
      { date: '15/11/2025', details: 'صيانة دورية - تغيير شمعات [إجمالي: 500 مدفوع: 500]' },
    ],
    status: 'in_progress' as const,
    branch: 'فرع الجيزة - الدقي',
  },
  {
    id: 'WO-003-2026',
    orderCode: '0100030510',
    customerCode: '0100001102',
    customerId: 789,
    customer: 'فندق النيل الأزرق',
    address: 'كورنيش النيل - وسط البلد - القاهرة',
    phone: '01033344556',
    region: 'وسط البلد',
    product: 'محطة تحلية 1000 لتر/يوم',
    installDate: '01/03/2025',
    warrantyUntil: '01/03/2028',
    warrantyStatus: 'ساري' as const,
    visitDate: '25/02/2026',
    visitTime: '9:00 ص',
    technician: 'خالد إبراهيم',
    notes: 'صيانة طارئة - تسريب مياه',
    items: [
      { description: 'إصلاح تسريب خط المياه الرئيسي', value: 1500 },
      { description: 'تغيير وصلات', value: 350 },
    ],
    transportCost: 100,
    total: 1950,
    previousVisits: [],
    status: 'pending' as const,
    branch: 'فرع القاهرة - المعادي',
  },
];

export const notifications = [
  { id: '1', title: 'صيانة متأخرة', message: 'صيانة محطة تحلية شركة النور متأخرة', type: 'warning' as const, time: 'منذ ساعة', read: false },
  { id: '2', title: 'مخزون منخفض', message: 'محطة تحلية 1000 لتر - المخزون 2 فقط', type: 'danger' as const, time: 'منذ 3 ساعات', read: false },
  { id: '3', title: 'قسط مستحق', message: 'قسط شركة النور - 4,000 ج.م مستحق غداً', type: 'info' as const, time: 'منذ 5 ساعات', read: true },
  { id: '4', title: 'مندوب بدأ وردية', message: 'خالد إبراهيم بدأ الوردية - المعادي', type: 'success' as const, time: 'اليوم 8:00 ص', read: true },
];

export const dashboardStats = {
  todaySales: 22400,
  monthlyProfit: 185000,
  pendingInvoices: 8,
  installmentsDue: 47000,
  maintenanceDue: 4,
  lowStockItems: 3,
};

export const topReps = [
  { name: 'خالد إبراهيم', sales: 125000, orders: 18, branch: 'الإسكندرية' },
  { name: 'عمر محمود', sales: 98000, orders: 14, branch: 'الجيزة' },
  { name: 'ياسر عادل', sales: 76000, orders: 11, branch: 'الإسكندرية' },
];

export const monthlySalesData = [
  { month: 'سبتمبر', sales: 145000, profit: 52000 },
  { month: 'أكتوبر', sales: 168000, profit: 61000 },
  { month: 'نوفمبر', sales: 192000, profit: 72000 },
  { month: 'ديسمبر', sales: 210000, profit: 78000 },
  { month: 'يناير', sales: 178000, profit: 65000 },
  { month: 'فبراير', sales: 225000, profit: 85000 },
];

export const branchComparison = [
  { branch: 'الإسكندرية', sales: 350000, customers: 120, orders: 45 },
  { branch: 'الجيزة', sales: 280000, customers: 95, orders: 38 },
];

export const formatEGP = (amount: unknown): string => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0 ج.م';
  return new Intl.NumberFormat('ar-EG', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ج.م';
};
