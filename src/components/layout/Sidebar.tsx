import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Video, Settings, ChevronLeft, ChevronRight, Users, ListVideo, Send, Globe, Image, HelpCircle, Server, FileText, Layers } from 'lucide-react';
interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: 'advisors' | 'videos' | 'playlists' | 'publications';
}
const navItems: NavItem[] = [{
  id: 'dashboard',
  label: 'Дашборд',
  icon: LayoutDashboard
}, {
  id: 'questions',
  label: 'Вопросы',
  icon: HelpCircle
}, {
  id: 'videos',
  label: 'Ролики',
  icon: Video,
  badgeKey: 'videos'
}, {
  id: 'publications-list',
  label: 'Публикации',
  icon: Send,
  badgeKey: 'publications'
}, {
  id: 'scenes',
  label: 'Сцены монологов',
  icon: Image
}, {
  id: 'advisors',
  label: 'Духовники',
  icon: Users,
  badgeKey: 'advisors'
}, {
  id: 'playlists',
  label: 'Плейлисты',
  icon: ListVideo,
  badgeKey: 'playlists'
}, {
  id: 'channels',
  label: 'Каналы',
  icon: Globe
}, {
  id: 'proxies',
  label: 'Прокси-сервера',
  icon: Server
}, {
  id: 'prompts',
  label: 'Промты',
  icon: FileText
}];
interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts?: {
    advisors?: number;
    videos?: number;
    playlists?: number;
    publications?: number;
  };
}
export function Sidebar({
  activeTab,
  onTabChange,
  counts = {}
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const getBadge = (key?: 'advisors' | 'videos' | 'playlists' | 'publications') => {
    if (!key) return undefined;
    const count = counts[key];
    return count !== undefined && count > 0 ? count : undefined;
  };
  return <aside className={cn('relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300', isCollapsed ? 'w-16' : 'w-64')}>
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 glow overflow-hidden">
          <img src="/favicon.png" alt="ArtPatent" className="w-6 h-6 object-contain" />
        </div>
        {!isCollapsed && <div className="flex flex-col">
            <span className="text-sm font-bold gradient-text">WisdomDialogue AI </span>
            <span className="text-xs text-muted-foreground">Генерация видео</span>
          </div>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
        const badge = getBadge(item.badgeKey);
        return <button key={item.id} onClick={() => onTabChange(item.id)} className={cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200', 'hover:bg-sidebar-accent', activeTab === item.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-sidebar-foreground')}>
              <item.icon className={cn('w-5 h-5 flex-shrink-0', activeTab === item.id ? 'text-primary' : 'text-muted-foreground')} />
              {!isCollapsed && <>
                  <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                  {badge !== undefined && <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', activeTab === item.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                      {badge}
                    </span>}
                </>}
            </button>;
      })}
      </nav>

      {/* Settings at bottom */}
      <div className="p-3 border-t border-sidebar-border">
        <button onClick={() => onTabChange('settings')} className={cn('flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200', 'hover:bg-sidebar-accent text-sidebar-foreground', activeTab === 'settings' && 'bg-primary/10 text-primary border border-primary/20')}>
          <Settings className="w-5 h-5 text-muted-foreground" />
          {!isCollapsed && <span className="text-sm font-medium">Настройки</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 rounded-full bg-card border border-border hover:bg-muted transition-colors">
        {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronLeft className="w-4 h-4 text-muted-foreground" />}
      </button>
    </aside>;
}