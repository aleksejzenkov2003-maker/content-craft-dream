import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plug, Film } from 'lucide-react';
import { ApiBalancesSettings } from './ApiBalancesSettings';
import { VideoFormatSettings } from './VideoFormatSettings';

const SECTIONS = [
  { key: 'api', label: 'Подключения API / Баланс', icon: Plug },
  { key: 'video_format', label: 'Настройки видеоформата', icon: Film },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('api');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Настройки</h2>

      <nav className="flex gap-1 border-b">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeSection === s.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          );
        })}
      </nav>

      {activeSection === 'api' && <ApiBalancesSettings />}
      {activeSection === 'video_format' && <VideoFormatSettings />}
    </div>
  );
}
