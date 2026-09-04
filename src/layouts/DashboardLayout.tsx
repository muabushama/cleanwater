import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { TopBar } from '@/components/TopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { BranchProvider } from '@/contexts/BranchContext';

interface DashboardLayoutProps {
  isAdmin?: boolean;
  isRep?: boolean;
  isCustomerService?: boolean;
  isWarehouseKeeper?: boolean;
  profile?: { full_name: string; branch_id: string } | null;
  onSignOut?: () => Promise<{ error: any }>;
}

/** Only admins may switch branch; other roles stay on profile branch (matches API enforcement). */
const allowBranchSwitchForLayout = (isAdmin?: boolean) => Boolean(isAdmin);

export default function DashboardLayout({ isAdmin, isRep, isCustomerService, isWarehouseKeeper, profile, onSignOut }: DashboardLayoutProps) {
  const [currentBranch, setCurrentBranch] = useState(profile?.branch_id || '1');

  const appFooter = (
    <footer className="mt-auto border-t bg-muted/30 py-3 px-4 text-center text-xs text-muted-foreground">
      <p className="font-medium">Created By PIXEL 01 Company</p>
      <p dir="ltr" className="mt-1">01044802022 &nbsp; | &nbsp; 01034029665</p>
    </footer>
  );

  if (isRep) {
    return (
      <BranchProvider branchId={currentBranch}>
        <div className="min-h-screen flex flex-col">
          <TopBar
            currentBranch={currentBranch}
            onBranchChange={setCurrentBranch}
            userName={profile?.full_name || ''}
            onSignOut={onSignOut}
            isRep={true}
            allowBranchSwitch={allowBranchSwitchForLayout(isAdmin)}
          />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
          {appFooter}
        </div>
      </BranchProvider>
    );
  }

  return (
    <BranchProvider branchId={currentBranch}>
      <SidebarProvider>
        <div className="min-h-screen flex flex-col w-full">
          <div className="flex flex-1 min-w-0">
            <AppSidebar isAdmin={isAdmin} isCustomerService={isCustomerService} isWarehouseKeeper={isWarehouseKeeper} />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar
                currentBranch={currentBranch}
                onBranchChange={setCurrentBranch}
                userName={profile?.full_name || ''}
                onSignOut={onSignOut}
                allowBranchSwitch={allowBranchSwitchForLayout(isAdmin)}
              />
              <main className="flex-1 p-4 md:p-6 overflow-auto">
                <Outlet />
              </main>
            </div>
          </div>
          {appFooter}
        </div>
      </SidebarProvider>
    </BranchProvider>
  );
}
