import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Video } from './useVideos';
import { AdvisorPhoto } from './useAdvisors';

interface UseVideoGenerationOptions {
  onVideoUpdated?: () => void;
}

export function useVideoGeneration(options?: UseVideoGenerationOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const uploadPhotoToHeygen = useCallback(async (photo: AdvisorPhoto): Promise<string | null> => {
    setIsUploadingPhoto(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-heygen-photo', {
        body: { photoId: photo.id, photoUrl: photo.photo_url },
      });

      if (error) throw error;

      if (data.success && data.assetId) {
        return data.assetId;
      } else {
        throw new Error(data.error || 'Failed to upload photo');
      }
    } catch (error: any) {
      console.error('Error uploading photo to HeyGen:', error);
      toast.error('Ошибка загрузки фото в HeyGen');
      return null;
    } finally {
      setIsUploadingPhoto(false);
    }
  }, []);

  const generateVideo = useCallback(async (video: Video, photoAssetId: string) => {
    if (!video.advisor_answer) {
      toast.error('Нет текста для озвучки');
      return;
    }

    setIsGenerating(true);
    setGeneratingVideoId(video.id);

    try {
      // Update status to generating
      await supabase
        .from('videos')
        .update({ generation_status: 'generating' })
        .eq('id', video.id);

      options?.onVideoUpdated?.();

      // Call edge function
      const { data, error } = await supabase.functions.invoke('generate-video-heygen', {
        body: {
          videoId: video.id,
          photoAssetId,
          script: video.advisor_answer,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to start video generation');
      }

      toast.success('Генерация видео запущена');

      // Start polling for status
      startPolling(video.id);
    } catch (error: any) {
      console.error('Error generating video:', error);
      toast.error('Ошибка запуска генерации');
      
      await supabase
        .from('videos')
        .update({ generation_status: 'error' })
        .eq('id', video.id);
      
      setIsGenerating(false);
      setGeneratingVideoId(null);
      options?.onVideoUpdated?.();
    }
  }, [options]);

  const startPolling = useCallback((videoId: string) => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-video-status', {
          body: { videoId },
        });

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        if (data.status === 'ready') {
          stopPolling();
          setIsGenerating(false);
          setGeneratingVideoId(null);
          toast.success('Видео готово!');
          options?.onVideoUpdated?.();
        } else if (data.status === 'failed' || data.status === 'error') {
          stopPolling();
          setIsGenerating(false);
          setGeneratingVideoId(null);
          toast.error(data?.errorMessage || 'Ошибка генерации видео');
          options?.onVideoUpdated?.();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 10000); // Check every 10 seconds
  }, [stopPolling, options]);

  const checkStatus = useCallback(async (videoId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-video-status', {
        body: { videoId },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error checking status:', error);
      return null;
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopPolling();
  }, [stopPolling]);

  return {
    isGenerating,
    isUploadingPhoto,
    generatingVideoId,
    uploadPhotoToHeygen,
    generateVideo,
    checkStatus,
    cleanup,
  };
}
