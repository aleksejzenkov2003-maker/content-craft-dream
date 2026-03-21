import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  duration_ms: number | null;
  tokens_used: number | null;
  cost_estimate: number | null;
  step_number: number | null;
  created_at: string;
}

export interface ActiveVideo {
  id: string;
  video_number: number | null;
  video_title: string | null;
  question: string | null;
  generation_status: string | null;
  reel_status: string | null;
  voiceover_status: string | null;
  cover_status: string | null;
  generation_count: number | null;
  updated_at: string;
  advisor?: { id: string; name: string; display_name: string | null } | null;
  logs: ProcessLog[];
}

const ACTIVE_STATUSES = ['generating', 'processing'];

export function useActiveProcesses() {
  const [activeVideos, setActiveVideos] = useState<ActiveVideo[]>([]);
  const [recentVideos, setRecentVideos] = useState<ActiveVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProcesses = useCallback(async () => {
    try {
      // Fetch active videos
      const { data: active, error: activeErr } = await supabase
        .from('videos')
        .select('id, video_number, video_title, question, generation_status, reel_status, voiceover_status, cover_status, generation_count, updated_at, advisor:advisors(id, name, display_name)')
        .or('generation_status.in.(generating,processing),reel_status.eq.generating,voiceover_status.eq.generating,cover_status.eq.generating');

      if (activeErr) throw activeErr;

      // Fetch recent completed (last 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent, error: recentErr } = await supabase
        .from('videos')
        .select('id, video_number, video_title, question, generation_status, reel_status, voiceover_status, cover_status, generation_count, updated_at, advisor:advisors(id, name, display_name)')
        .eq('generation_status', 'ready')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (recentErr) throw recentErr;

      const allVideoIds = [
        ...(active || []).map(v => v.id),
        ...(recent || []).map(v => v.id),
      ];

      let logsMap: Record<string, ProcessLog[]> = {};

      if (allVideoIds.length > 0) {
        const { data: logs } = await supabase
          .from('activity_log')
          .select('*')
          .in('entity_id', allVideoIds)
          .eq('entity_type', 'video')
          .order('created_at', { ascending: true })
          .limit(500);

        if (logs) {
          for (const log of logs) {
            const eid = log.entity_id!;
            if (!logsMap[eid]) logsMap[eid] = [];
            logsMap[eid].push(log as ProcessLog);
          }
        }
      }

      const mapVideo = (v: any): ActiveVideo => ({
        ...v,
        advisor: Array.isArray(v.advisor) ? v.advisor[0] || null : v.advisor,
        logs: logsMap[v.id] || [],
      });

      setActiveVideos((active || []).map(mapVideo));
      setRecentVideos((recent || []).map(mapVideo));
    } catch (err) {
      console.error('Error fetching active processes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 10000);
    return () => clearInterval(interval);
  }, [fetchProcesses]);

  // Realtime subscription for instant status updates
  useEffect(() => {
    const channel = supabase
      .channel('active-processes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
        fetchProcesses();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProcesses]);

  return { activeVideos, recentVideos, loading, refetch: fetchProcesses };
}
