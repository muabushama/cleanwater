import logo from '@/assets/logo.png';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Wrench,
  ClipboardList,
  Warehouse,
  UserCheck,
  DollarSign,
  BarChart3,
  MapPin,
  CalendarCheck,
  Shield,
  Headset,
  ListChecks,
  Layers,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const mainItems = [
  { title: 'لوحة التحكم', url: '/', icon: LayoutDashboard },
  { title: 'المنتجات', url: '/products', icon: Package },
  { title: 'العملاء', url: '/customers', icon: Users },
  { title: 'الفواتير', url: '/invoices', icon: FileText },
  { title: 'الزيارات', url: '/visits', icon: CalendarCheck },
];

const managementItems = [
  { title: 'المخزون', url: '/inventory', icon: Warehouse },
  { title: 'أقسام المخزون', url: '/settings/inventory-categories', icon: Layers },
  { title: 'القطاعات والمناطق', url: '/areas', icon: MapPin },
  { title: 'المناديب', url: '/sales-reps', icon: UserCheck },
  { title: 'المالية', url: '/finance', icon: DollarSign },
  { title: 'التقارير', url: '/reports', icon: BarChart3 },
];

const customerServiceItems = [
  { title: 'لوحة خدمة العملاء', url: '/', icon: Headset },
  { title: 'متابعة العملاء', url: '/customer-service/follow-ups', icon: ListChecks },
  { title: 'العملاء', url: '/customers', icon: Users },
  { title: 'الفواتير', url: '/invoices', icon: FileText },
  { title: 'الزيارات', url: '/visits', icon: CalendarCheck },
];

interface AppSidebarProps {
  isAdmin?: boolean;
  isCustomerService?: boolean;
}

export function AppSidebar({ isAdmin, isCustomerService }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const adminItems = isAdmin ? [
    { title: 'تتبع المناديب', url: '/tracking', icon: MapPin },
    { title: 'النسخ الاحتياطي', url: '/backup', icon: Shield },
  ] : [];

  const primaryItems = isCustomerService ? customerServiceItems : mainItems;
  const secondaryItems = isCustomerService ? [] : [...managementItems, ...adminItems];

  return (
    <Sidebar side="right" collapsible="icon" className="border-r-0 gradient-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Clean Water" className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-white/90 p-1" />
          {!collapsed && (
            <div>
              <h2 className="text-base font-bold text-sidebar-foreground">كلين ووتر</h2>
              <p className="text-xs text-sidebar-muted">نظام إدارة متكامل</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs">القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === '/'} className="transition-colors duration-200" activeClassName="bg-sidebar-accent text-sidebar-primary">
                      <item.icon className="h-4 w-4 ml-2" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {secondaryItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-xs">الإدارة</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} className="transition-colors duration-200" activeClassName="bg-sidebar-accent text-sidebar-primary">
                        <item.icon className="h-4 w-4 ml-2" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
