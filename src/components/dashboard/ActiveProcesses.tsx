import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Zap, DollarSign, ExternalLink, Loader2, CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { useActiveProcesses, type ActiveVideo, type ActivePublication, type ProcessLog } from '@/hooks/useActiveProcesses';

interface FFmpegProgress {
  phase: string;
  progress: number;
}

interface ActiveProcessesProps {
  onNavigateToVideo: (videoId: string) => void;
  ffmpegProgress?: Record<string, FFmpegProgress>;
}

function getOverallStatus(v: ActiveVideo, ffmpeg?: FFmpegProgress): { label: string; color: string } {
  if (ffmpeg) {
  const phaseLabels: Record<string, string> = {
      reducing_bitrate: 'Сжатие битрейта...',
      burning_subtitles: 'Вшивка субтитров...',
      downloading: 'Скачивание видео...',
      uploading_result: 'Загрузка результата...',
      loading_ffmpeg: 'Загрузка FFmpeg...',
      creating_intro: 'Создание интро из обложки...',
      done: 'Готово',
    };
    return { label: phaseLabels[ffmpeg.phase] || ffmpeg.phase, color: 'text-cyan-500' };
  }
  if (v.voiceover_status === 'generating') return { label: 'Озвучка...', color: 'text-blue-500' };
  if (v.cover_status === 'generating') return { label: 'Обложка...', color: 'text-purple-500' };
  if (v.generation_status === 'generating') return { label: 'HeyGen генерация...', color: 'text-amber-500' };
  if (v.generation_status === 'processing') return { label: 'Постобработка...', color: 'text-cyan-500' };
  if (v.reel_status === 'generating') return { label: 'FFmpeg обработка...', color: 'text-teal-500' };
  if (v.generation_status === 'ready') return { label: 'Готово', color: 'text-emerald-500' };
  return { label: v.generation_status || '—', color: 'text-muted-foreground' };
}

function getStepIcon(action: string) {
  if (action.includes('error') || action.includes('failed')) return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (action.includes('warning') || action.includes('fallback') || action.includes('not_ready')) return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  if (action.includes('complete') || action.includes('success') || action.includes('generated') || action.includes('created') || action.includes('uploaded') || action.includes('ready') || action.includes('started')) return <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (action.includes('begin') || action.includes('request') || action.includes('processing')) return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />;
  return <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function ProcessCard({ video, onNavigate, ffmpeg }: { video: ActiveVideo; onNavigate: () => void; ffmpeg?: FFmpegProgress }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const status = getOverallStatus(video, ffmpeg);
  const title = video.video_title || video.question || `#${video.video_number || '?'}`;
  const advisorName = video.advisor?.display_name || video.advisor?.name || '';

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${status.color}`}>●</span>
            <span className="text-sm font-medium truncate">{title}</span>
            {advisorName && <Badge variant="outline" className="text-xs shrink-0">{advisorName}</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className={status.color}>{status.label}</span>
            {video.generation_count ? <span>· Попытка #{video.generation_count}</span> : null}
          </div>
          {ffmpeg && ffmpeg.phase !== 'done' && (
            <Progress value={ffmpeg.progress} className="h-1.5 mt-2" />
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onNavigate} title="Перейти к ролику">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {video.logs.length > 0 && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className="w-full px-3 pb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            История шагов ({video.logs.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-1">
              {video.logs.map((log) => (
                <LogEntry key={log.id} log={log} isExpanded={expandedLog === log.id} onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function LogEntry({ log, isExpanded, onToggle }: { log: ProcessLog; isExpanded: boolean; onToggle: () => void }) {
  const hasDetails = log.details || log.input_data || log.output_data;

  return (
    <div className="rounded border bg-muted/30">
      <button className="w-full px-2 py-1.5 flex items-center gap-2 text-left hover:bg-muted/50 transition-colors" onClick={hasDetails ? onToggle : undefined}>
        {getStepIcon(log.action)}
        <span className="text-xs font-mono text-foreground">{log.action}</span>
        <span className="flex-1" />
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {log.duration_ms != null && (
            <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{log.duration_ms}ms</span>
          )}
          {log.tokens_used != null && (
            <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" />{log.tokens_used}</span>
          )}
          {log.cost_estimate != null && (
            <span className="flex items-center gap-0.5"><DollarSign className="h-2.5 w-2.5" />${log.cost_estimate.toFixed(4)}</span>
          )}
          <span>{new Date(log.created_at).toLocaleTimeString()}</span>
        </div>
      </button>

      {isExpanded && hasDetails && (
        <div className="px-2 pb-2 space-y-1.5 border-t bg-background/50">
          {log.details && (
            <DetailBlock label="Детали" data={log.details} />
          )}
          {log.input_data && (
            <DetailBlock label="Вход" data={log.input_data} color="text-blue-500" />
          )}
          {log.output_data && (
            <DetailBlock label="Выход" data={log.output_data} color="text-emerald-500" />
          )}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, data, color }: { label: string; data: unknown; color?: string }) {
  return (
    <div className="mt-1">
      <p className={`text-[10px] font-medium ${color || 'text-muted-foreground'} mb-0.5`}>{label}:</p>
      <pre className="text-[10px] bg-muted p-1.5 rounded overflow-x-auto max-h-28 leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function ActiveProcesses({ onNavigateToVideo, ffmpegProgress }: ActiveProcessesProps) {
  const { activeVideos, recentVideos, loading } = useActiveProcesses();

  // Merge ffmpegProgress videos that might not be in activeVideos
  const ffmpegVideoIds = ffmpegProgress ? Object.keys(ffmpegProgress) : [];

  if (loading && activeVideos.length === 0 && recentVideos.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Активные процессы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Загрузка...
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasContent = activeVideos.length > 0 || recentVideos.length > 0 || ffmpegVideoIds.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Активные процессы
          {(activeVideos.length > 0 || ffmpegVideoIds.length > 0) && (
            <Badge variant="default" className="ml-1">{Math.max(activeVideos.length, ffmpegVideoIds.length)}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasContent ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Нет активных процессов</p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto space-y-4 pr-1">
            {activeVideos.length > 0 && (
              <div className="space-y-2">
                {activeVideos.map(v => (
                  <ProcessCard key={v.id} video={v} onNavigate={() => onNavigateToVideo(v.id)} ffmpeg={ffmpegProgress?.[v.id]} />
                ))}
              </div>
            )}

            {recentVideos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">История роликов</p>
                {recentVideos.map(v => (
                  <ProcessCard key={v.id} video={v} onNavigate={() => onNavigateToVideo(v.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}