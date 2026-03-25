/**
 * Helper to call the VPS FFmpeg processing via edge function.
 */
import { supabase } from '@/integrations/supabase/client';

export type VpsOperation = 'concat' | 'overlay' | 'reduce' | 'subtitles' | 'normalize-audio';

export interface VpsResult {
  success: boolean;
  url?: string;
  error?: string;
  duration_ms?: number;
}

export async function callVpsFFmpeg(
  operation: VpsOperation,
  params: Record<string, unknown>,
): Promise<VpsResult> {
  const { data, error } = await supabase.functions.invoke('process-video-vps', {
    body: { operation, params },
  });

  if (error) {
    throw new Error(error.message || 'VPS processing failed');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'VPS returned unsuccessful result');
  }

  return data as VpsResult;
}
