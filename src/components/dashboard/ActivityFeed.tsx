import { cn } from '@/lib/utils';
import { CheckCircle2, Rss, FileText, Video, Upload, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Activity {
  id: string;
  type: 'parse' | 'rewrite' | 'video' | 'publish' | 'error';
  title: string;
  description: string;
  timestamp: Date;
}

const activityIcons: Record<Activity['type'], React.ElementType> = {
  parse: Rss,
  rewrite: FileText,
  video: Video,
  publish: Upload,
  error: AlertCircle,
};

const activityColors: Record<Activity['type'], string> = {
  parse: 'bg-blue-500/20 text-blue-400',
  rewrite: 'bg-primary/20 text-primary',
  video: 'bg-accent/20 text-accent',
  publish: 'bg-success/20 text-success',
  error: 'bg-destructive/20 text-destructive',
};

const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'publish',
    title: 'Видео опубликовано',
    description: 'Новости IP: главные события недели',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '2',
    type: 'video',
    title: 'Видео сгенерировано',
    description: 'Патентные споры 2024',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: '3',
    type: 'rewrite',
    title: 'Контент переписан',
    description: 'Защита товарного знака: гайд',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: '4',
    type: 'parse',
    title: 'Спарсено 12 постов',
    description: 'YouTube: @gardiumIP',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: '5',
    type: 'error',
    title: 'Ошибка парсинга',
    description: 'Instagram: timeout',
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
  },
];

export function ActivityFeed() {
  return (
    <div className="rounded-xl p-6 card-gradient border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Активность</h3>
        <Clock className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="space-y-4">
        {mockActivities.map((activity, index) => {
          const Icon = activityIcons[activity.type];

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn('p-2 rounded-lg', activityColors[activity.type])}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activity.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{activity.description}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: ru })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
