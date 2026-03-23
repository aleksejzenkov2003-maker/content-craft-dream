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
  question_id: number | null;
  generation_status: string | null;
  reel_status: string | null;
  voiceover_status: string | null;
  cover_status: string | null;
  generation_count: number | null;
  updated_at: string;
  advisor?: { id: string; name: string; display_name: string | null } | null;
  logs: ProcessLog[];
}

export interface ActivePublication {
  id: string;
  publication_status: string | null;
  video_title: string | null;
  channel_name: string | null;
  updated_at: string;
  logs: ProcessLog[];
}

const ACTIVE_STATUSES = ['generating', 'processing'];
const ACTIVE_WINDOW_MINUTES = 30;
const HISTORY_LIMIT = 10;

export function useActiveProcesses() {
  const [activeVideos, setActiveVideos] = useState<ActiveVideo[]>([]);
  const [recentVideos, setRecentVideos] = useState<ActiveVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProcesses = useCallback(async () => {
    try {
      const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000).toISOString();
      // Fetch only truly active videos updated recently
      const { data: active, error: activeErr } = await supabase
        .from('videos')
        .select('id, video_number, video_title, question, question_id, generation_status, reel_status, voiceover_status, cover_status, generation_count, updated_at, advisor:advisors(id, name, display_name)')
        .or('generation_status.in.(generating,processing),reel_status.eq.generating,voiceover_status.eq.generating,cover_status.eq.generating')
        .gte('updated_at', activeSince)
        .order('updated_at', { ascending: false });

      if (activeErr) throw activeErr;

      // Fetch video history regardless of the last 24h window
      const { data: recent, error: recentErr } = await supabase
        .from('videos')
        .select('id, video_number, video_title, question, question_id, generation_status, reel_status, voiceover_status, cover_status, generation_count, updated_at, advisor:advisors(id, name, display_name)')
        .in('generation_status', ['ready', 'error'])
        .order('updated_at', { ascending: false })
        .limit(HISTORY_LIMIT);

      if (recentErr) throw recentErr;

      // Fetch active publications
      const { data: activePubs } = await supabase
        .from('publications')
        .select('id, publication_status, updated_at, video:videos(video_title), channel:publishing_channels(name)')
        .in('publication_status', ['publishing', 'generating_text', 'concatenating'])
        .order('updated_at', { ascending: false })
        .limit(20);

      // Fetch recent publications
      const { data: recentPubs } = await supabase
        .from('publications')
        .select('id, publication_status, updated_at, video:videos(video_title), channel:publishing_channels(name)')
        .in('publication_status', ['published', 'error'])
        .order('updated_at', { ascending: false })
        .limit(HISTORY_LIMIT);

      const allVideoIds = [
        ...(active || []).map(v => v.id),
        ...(recent || []).map(v => v.id),
      ];

      const allPubIds = [
        ...(activePubs || []).map(p => p.id),
        ...(recentPubs || []).map(p => p.id),
      ];

      let logsMap: Record<string, ProcessLog[]> = {};

      if (allVideoIds.length > 0 || allPubIds.length > 0) {
        const allEntityIds = [...allVideoIds, ...allPubIds];
        const { data: logs } = await supabase
          .from('activity_log')
          .select('*')
          .in('entity_id', allEntityIds)
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

      const mapPub = (p: any): ActivePublication => ({
        id: p.id,
        publication_status: p.publication_status,
        video_title: Array.isArray(p.video) ? p.video[0]?.video_title : p.video?.video_title || null,
        channel_name: Array.isArray(p.channel) ? p.channel[0]?.name : p.channel?.name || null,
        updated_at: p.updated_at,
        logs: logsMap[p.id] || [],
      });

      setActiveVideos((active || []).map(mapVideo));
      setRecentVideos((recent || []).map(mapVideo));
      setActivePublications((activePubs || []).map(mapPub));
      setRecentPublications((recentPubs || []).map(mapPub));
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
