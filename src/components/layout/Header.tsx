import { Bell, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
  notificationCount?: number;
  onRefresh?: () => void;
}

export function Header({ title, subtitle, notificationCount = 0 }: HeaderProps) {
  const { signOut, user } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-primary">
              {notificationCount}
            </Badge>
          )}
        </Button>

        {/* User & Logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <span className="text-sm text-muted-foreground hidden md:block">
              {user.email}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={signOut}
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
