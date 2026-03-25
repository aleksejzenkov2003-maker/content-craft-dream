import { callVpsFFmpeg } from './vpsClient';

export type OverlayPhase = 'loading_ffmpeg' | 'downloading' | 'compositing' | 'done';

export interface OverlayProgressInfo {
  phase: OverlayPhase;
  progress: number;
}

/**
 * Overlays an avatar video (with green screen background) onto a background video.
 * Processing happens on VPS via edge function.
 */
export async function overlayAvatarOnBackground(
  avatarVideoUrl: string,
  backgroundVideoUrl: string,
  onProgress?: (info: OverlayProgressInfo) => void,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();

  onProgress?.({ phase: 'compositing', progress: 10 });

  const result = await callVpsFFmpeg('overlay', {
    avatar_video_url: avatarVideoUrl,
    background_video_url: backgroundVideoUrl,
  });

  signal?.throwIfAborted();
  onProgress?.({ phase: 'done', progress: 100 });

  if (!result.url) throw new Error('VPS overlay did not return a URL');
  return result.url;
}
