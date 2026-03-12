import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, ClipboardList, CalendarCheck } from 'lucide-react';
import MaintenancePage from './MaintenancePage';
import WorkOrdersPage from './WorkOrdersPage';
import VisitsPage from './VisitsPage';

type TabValue = 'visits' | 'maintenance' | 'work-orders';

export default function VisitsHubPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromPath = location.pathname === '/maintenance' ? 'maintenance' : location.pathname === '/work-orders' ? 'work-orders' : null;
  const tabFromUrl = searchParams.get('tab') as TabValue | null;
  const initialTab = tabFromPath || tabFromUrl || 'visits';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  useEffect(() => {
    const next = tabFromPath || tabFromUrl || 'visits';
    setActiveTab(next);
  }, [location.pathname, tabFromPath, tabFromUrl]);

  const handleTabChange = (value: string) => {
    const v = value as TabValue;
    setActiveTab(v);
    setSearchParams(params => {
      params.set('tab', v);
      return params;
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">الزيارات</h1>
        <p className="text-muted-foreground text-sm">الصيانة، أوامر العمل وإدارة الزيارات</p>
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="visits" className="gap-2">
            <CalendarCheck className="h-4 w-4" />
            إدارة الزيارات
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <Wrench className="h-4 w-4" />
            الصيانة
          </TabsTrigger>
          <TabsTrigger value="work-orders" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            أوامر العمل
          </TabsTrigger>
        </TabsList>
        <TabsContent value="visits" className="mt-4">
          <VisitsPage embedded />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <MaintenancePage embedded />
        </TabsContent>
        <TabsContent value="work-orders" className="mt-4">
          <WorkOrdersPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
