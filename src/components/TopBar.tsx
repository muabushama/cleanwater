import { Bell, ChevronDown, User, LogOut, Settings, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { branches, notifications } from '@/data/demo-data';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface TopBarProps {
  currentBranch: string;
  onBranchChange: (branch: string) => void;
  userName?: string;
  onSignOut?: () => Promise<{ error: any }>;
  isRep?: boolean;
}

export function TopBar({ currentBranch, onBranchChange, userName, onSignOut, isRep }: TopBarProps) {
  const [isDark, setIsDark] = useState(false);
  const currentBranchData = branches.find(b => b.id === currentBranch);
  const unreadCount = notifications.filter(n => !n.read).length;
  const { toast } = useToast();

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleSignOut = async () => {
    if (!onSignOut) return;
    try {
      const { error } = await onSignOut();
      if (error) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
    }
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 card-shadow">
      <div className="flex items-center gap-3">
        {!isRep && <SidebarTrigger className="text-muted-foreground hover:text-foreground" />}
        {!isRep && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span className="text-sm">{currentBranchData?.name}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {branches.map(branch => (
                <DropdownMenuItem key={branch.id} onClick={() => onBranchChange(branch.id)}>
                  {branch.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {isRep && (
          <span className="text-sm font-bold text-primary">أوردرات التوصيل</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDark} className="text-muted-foreground">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {!isRep && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-sm">الإشعارات</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className={`p-3 border-b last:border-0 ${!n.read ? 'bg-accent/50' : ''}`}>
                    <div className="flex items-start gap-2">
                      <Badge variant={n.type === 'danger' ? 'destructive' : n.type === 'warning' ? 'outline' : 'secondary'} className="text-[10px] mt-0.5">
                        {n.type === 'danger' ? '⚠️' : n.type === 'warning' ? '🔔' : n.type === 'success' ? '✅' : 'ℹ️'}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm hidden md:inline">{userName || 'مستخدم'}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Settings className="h-4 w-4 ml-2" /> الإعدادات
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 ml-2" /> تسجيل خروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
