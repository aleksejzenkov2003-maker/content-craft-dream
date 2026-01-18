import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Rss,
  FileText,
  Video,
  Settings,
  TrendingUp,
  Zap,
  ChevronLeft,
  ChevronRight,
  Bug,
  Sparkles,
  Volume2,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: 'sources' | 'content' | 'videos' | 'rewrites' | 'voiceovers';
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { id: 'sources', label: 'Источники', icon: Rss, badgeKey: 'sources' },
  { id: 'parsed', label: 'Контент', icon: FileText, badgeKey: 'content' },
  { id: 'rewrite', label: 'Рерайт', icon: Sparkles, badgeKey: 'rewrites' },
  { id: 'voiceover', label: 'Озвучка', icon: Volume2, badgeKey: 'voiceovers' },
  { id: 'videos', label: 'Видео', icon: Video, badgeKey: 'videos' },
  { id: 'pipeline', label: 'Пайплайн', icon: Zap },
  { id: 'debug', label: 'Отладка', icon: Bug },
  { id: 'analytics', label: 'Аналитика', icon: TrendingUp },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts?: {
    sources?: number;
    content?: number;
    videos?: number;
    rewrites?: number;
    voiceovers?: number;
  };
}

export function Sidebar({ activeTab, onTabChange, counts = {} }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getBadge = (key?: 'sources' | 'content' | 'videos' | 'rewrites' | 'voiceovers') => {
    if (!key) return undefined;
    const count = counts[key];
    return count !== undefined && count > 0 ? count : undefined;
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 glow">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-lg font-bold gradient-text">ContentFlow</span>
            <span className="text-xs text-muted-foreground">Автоматизация</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const badge = getBadge(item.badgeKey);
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200',
                'hover:bg-sidebar-accent',
                activeTab === item.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-sidebar-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 flex-shrink-0',
                  activeTab === item.id ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                  {badge !== undefined && (
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        activeTab === item.id
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200',
            'hover:bg-sidebar-accent text-sidebar-foreground',
            activeTab === 'settings' && 'bg-primary/10 text-primary border border-primary/20'
          )}
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
          {!isCollapsed && <span className="text-sm font-medium">Настройки</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 rounded-full bg-card border border-border hover:bg-muted transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </aside>
  );
}
