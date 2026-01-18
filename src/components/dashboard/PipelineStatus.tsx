import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Rss, FileText, Video, Upload } from 'lucide-react';

interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  count: number;
}

interface PipelineStatusProps {
  parsedCount?: number;
  rewrittenCount?: number;
  videoCount?: number;
  publishedCount?: number;
  isProcessing?: {
    parsing?: boolean;
    rewriting?: boolean;
    video?: boolean;
    publishing?: boolean;
  };
}

const stepIcons = [Rss, FileText, Video, Upload];

export function PipelineStatus({
  parsedCount = 0,
  rewrittenCount = 0,
  videoCount = 0,
  publishedCount = 0,
  isProcessing = {}
}: PipelineStatusProps) {
  
  const steps: PipelineStep[] = useMemo(() => {
    const getStatus = (count: number, isRunning?: boolean, prevCompleted?: boolean): 'pending' | 'running' | 'completed' => {
      if (isRunning) return 'running';
      if (count > 0) return 'completed';
      return 'pending';
    };

    return [
      { 
        id: '1', 
        name: 'Парсинг', 
        status: getStatus(parsedCount, isProcessing.parsing),
        count: parsedCount 
      },
      { 
        id: '2', 
        name: 'Рерайт', 
        status: getStatus(rewrittenCount, isProcessing.rewriting, parsedCount > 0),
        count: rewrittenCount 
      },
      { 
        id: '3', 
        name: 'Видео', 
        status: getStatus(videoCount, isProcessing.video, rewrittenCount > 0),
        count: videoCount 
      },
      { 
        id: '4', 
        name: 'Публикация', 
        status: getStatus(publishedCount, isProcessing.publishing, videoCount > 0),
        count: publishedCount 
      },
    ];
  }, [parsedCount, rewrittenCount, videoCount, publishedCount, isProcessing]);

  return (
    <div className="rounded-xl p-6 card-gradient border border-border">
      <h3 className="text-lg font-semibold mb-6">Пайплайн</h3>

      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const StepIcon = stepIcons[index];
          return (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300',
                    step.status === 'completed' && 'bg-success/20 border-2 border-success/30',
                    step.status === 'running' && 'bg-primary/20 border-2 border-primary/30 animate-pulse-glow',
                    step.status === 'pending' && 'bg-muted border-2 border-border',
                    step.status === 'failed' && 'bg-destructive/20 border-2 border-destructive/30'
                  )}
                >
                  <StepIcon
                    className={cn(
                      'w-6 h-6',
                      step.status === 'completed' && 'text-success',
                      step.status === 'running' && 'text-primary',
                      step.status === 'pending' && 'text-muted-foreground',
                      step.status === 'failed' && 'text-destructive'
                    )}
                  />
                  {step.status === 'running' && (
                    <div className="absolute -top-1 -right-1">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    </div>
                  )}
                  {step.count > 0 && (
                    <div className={cn(
                      "absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-bold",
                      step.status === 'completed' && 'bg-success text-success-foreground',
                      step.status === 'running' && 'bg-primary text-primary-foreground',
                      step.status === 'pending' && 'bg-muted-foreground text-muted'
                    )}>
                      {step.count}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    step.status === 'running' && 'text-primary',
                    step.status === 'completed' && 'text-success',
                    step.status === 'pending' && 'text-muted-foreground'
                  )}
                >
                  {step.name}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 mt-[-24px]">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      step.status === 'completed' && 'bg-success',
                      step.status === 'running' && 'bg-gradient-to-r from-primary to-muted',
                      step.status === 'pending' && 'bg-muted',
                      step.status === 'failed' && 'bg-destructive'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
