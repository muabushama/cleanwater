import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { useAdminAutoBackup } from "@/hooks/useAdminAutoBackup";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import InvoicesPage from "./pages/InvoicesPage";
import MaintenancePage from "./pages/MaintenancePage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import InventoryPage from "./pages/InventoryPage";
import SalesRepsPage from "./pages/SalesRepsPage";
import FinancePage from "./pages/FinancePage";
import ExpensesPage from "./pages/ExpensesPage";
import ReceiptVouchersPage from "./pages/ReceiptVouchersPage";
import ReturnsPage from "./pages/ReturnsPage";
import PurchasesPage from "./pages/PurchasesPage";
import ReportsPage from "./pages/ReportsPage";
import TrackingPage from "./pages/TrackingPage";
import RepDeliveryPage from "./pages/RepDeliveryPage";
import VisitsPage from "./pages/VisitsPage";
import VisitsHubPage from "./pages/VisitsHubPage";
import BackupPage from "./pages/BackupPage";
import AreasPage from "./pages/AreasPage";
import InventoryCategoriesPage from "./pages/InventoryCategoriesPage";
import CustomerServiceDashboardPage from "./pages/CustomerServiceDashboardPage";
import CustomerServiceFollowUpsPage from "./pages/CustomerServiceFollowUpsPage";
import StationsPage from "./pages/StationsPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, signIn, signUp, isAdmin, isRep, isCustomerService, isWarehouseKeeper, profile, signOut } = useAuth();
  
  // GPS tracking for sales reps
  useGpsTracking(user?.id, isRep);
  // Auto backup at local midnight while admin session stays open on this device
  useAdminAutoBackup(!!user && isAdmin);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={signIn} onRegister={signUp} />;
  }

  // Sales rep sees ONLY the delivery page — no sidebar, no main menu
  if (isRep) {
    return (
      <Routes>
        <Route element={<DashboardLayout isAdmin={false} isRep={true} profile={profile} onSignOut={signOut} />}>
          <Route path="/" element={<RepDeliveryPage userId={user.id} />} />
          <Route path="*" element={<RepDeliveryPage userId={user.id} />} />
        </Route>
      </Routes>
    );
  }

  if (isCustomerService && !isAdmin && !isWarehouseKeeper) {
    return (
      <Routes>
        <Route element={<DashboardLayout isAdmin={false} isCustomerService={true} profile={profile} onSignOut={signOut} />}>
          <Route path="/" element={<CustomerServiceDashboardPage />} />
          <Route path="/customer-service/follow-ups" element={<CustomerServiceFollowUpsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/work-orders" element={<WorkOrdersPage />} />
          <Route path="/visits" element={<VisitsPage />} />
        </Route>
        <Route path="*" element={<CustomerServiceDashboardPage />} />
      </Routes>
    );
  }

  if (isWarehouseKeeper && !isAdmin) {
    return (
      <Routes>
        <Route element={<DashboardLayout isAdmin={false} isWarehouseKeeper={true} profile={profile} onSignOut={signOut} />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<Navigate to="/inventory" replace />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/visits" element={<VisitsHubPage />} />
          <Route path="/maintenance" element={<VisitsHubPage />} />
          <Route path="/work-orders" element={<VisitsHubPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/settings/inventory-categories" element={<InventoryCategoriesPage />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/stations" element={<StationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<DashboardLayout isAdmin={isAdmin} profile={profile} onSignOut={signOut} />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/products" element={<Navigate to="/inventory" replace />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/maintenance" element={<VisitsHubPage />} />
        <Route path="/work-orders" element={<VisitsHubPage />} />
        <Route path="/visits" element={<VisitsHubPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/settings/inventory-categories" element={<InventoryCategoriesPage />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/stations" element={<StationsPage />} />
          <Route path="/sales-reps" element={<SalesRepsPage isAdmin={isAdmin} />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/receipt-vouchers" element={<ReceiptVouchersPage />} />
        <Route path="/returns" element={<ReturnsPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        {isAdmin && <Route path="/tracking" element={<TrackingPage />} />}
        {isAdmin && <Route path="/backup" element={<BackupPage />} />}
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
