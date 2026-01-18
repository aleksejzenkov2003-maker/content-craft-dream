import { Bell, Search, Play, Pause, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
  notificationCount?: number;
  onRefresh?: () => void;
}

export function Header({ title, subtitle, notificationCount = 0, onRefresh }: HeaderProps) {
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const { signOut, user } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            className="w-64 pl-10 bg-secondary/50 border-border focus:border-primary"
          />
        </div>

        {/* Pipeline Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={isPipelineRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={() => setIsPipelineRunning(!isPipelineRunning)}
            className={isPipelineRunning ? '' : 'bg-primary hover:bg-primary/90'}
          >
            {isPipelineRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Стоп
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Запустить
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            size="icon" 
            className="border-border"
            onClick={onRefresh}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

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
