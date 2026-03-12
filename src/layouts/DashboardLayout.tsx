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
  profile?: { full_name: string; branch_id: string } | null;
  onSignOut?: () => Promise<{ error: any }>;
}

export default function DashboardLayout({ isAdmin, isRep, isCustomerService, profile, onSignOut }: DashboardLayoutProps) {
  const [currentBranch, setCurrentBranch] = useState(profile?.branch_id || '1');

  if (isRep) {
    return (
      <BranchProvider branchId={currentBranch}>
        <div className="min-h-screen flex flex-col">
          <TopBar currentBranch={currentBranch} onBranchChange={setCurrentBranch} userName={profile?.full_name || ''} onSignOut={onSignOut} isRep={true} />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </BranchProvider>
    );
  }

  return (
    <BranchProvider branchId={currentBranch}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar isAdmin={isAdmin} isCustomerService={isCustomerService} />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar currentBranch={currentBranch} onBranchChange={setCurrentBranch} userName={profile?.full_name || ''} onSignOut={onSignOut} />
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </BranchProvider>
  );
}
