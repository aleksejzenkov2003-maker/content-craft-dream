import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VoiceoverItem {
  id: string;
  rewritten_content_id: string;
  audio_url: string | null;
  audio_source: 'elevenlabs' | 'recorded' | 'uploaded' | null;
  duration_seconds: number | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
  title: string | null;
  rewritten_content: {
    id: string;
    rewritten_text: string;
    script: string | null;
    hook: string | null;
    cta: string | null;
    parsed_content: {
      title: string;
      channel_id: string | null;
      channels?: {
        name: string;
        source: string;
      } | null;
    } | null;
  } | null;
}

export interface RewriteForVoiceover {
  id: string;
  rewritten_text: string;
  script: string | null;
  hook: string | null;
  cta: string | null;
  created_at: string;
  parsed_content: {
    title: string;
    channel_id: string | null;
    channels?: {
      name: string;
      source: string;
    } | null;
  } | null;
  voiceover?: VoiceoverItem | null;
}

export function useVoiceovers() {
  const [items, setItems] = useState<RewriteForVoiceover[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all rewritten content with their voiceovers
      const { data: rewrites, error: rewritesError } = await supabase
        .from('rewritten_content')
        .select(`
          id,
          rewritten_text,
          script,
          hook,
          cta,
          created_at,
          parsed_content (
            title,
            channel_id,
            channels (
              name,
              source
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (rewritesError) throw rewritesError;

      // Fetch voiceovers
      const { data: voiceovers, error: voiceoversError } = await supabase
        .from('voiceovers')
        .select('*')
        .order('created_at', { ascending: false });

      if (voiceoversError) throw voiceoversError;

      // Merge data
      const merged = (rewrites || []).map((rewrite: any) => {
        const voiceover = voiceovers?.find(v => v.rewritten_content_id === rewrite.id);
        return {
          ...rewrite,
          voiceover: voiceover || null
        };
      });

      setItems(merged);
    } catch (error) {
      console.error('Error fetching voiceovers:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const generateElevenLabs = useCallback(async (rewriteId: string, text: string) => {
    try {
      // Create or update voiceover record
      const { data: existing } = await supabase
        .from('voiceovers')
        .select('id')
        .eq('rewritten_content_id', rewriteId)
        .single();

      if (existing) {
        await supabase
          .from('voiceovers')
          .update({ status: 'processing', audio_source: 'elevenlabs', error_message: null })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('voiceovers')
          .insert({
            rewritten_content_id: rewriteId,
            status: 'processing',
            audio_source: 'elevenlabs'
          });
      }

      // Update local state
      setItems(prev => prev.map(item => 
        item.id === rewriteId 
          ? { ...item, voiceover: { ...item.voiceover, status: 'processing', audio_source: 'elevenlabs' } as any }
          : item
      ));

      // Call edge function
      const response = await supabase.functions.invoke('generate-voiceover', {
        body: { rewriteId, text }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Успех',
        description: 'Озвучка создана'
      });

      await fetchItems();
    } catch (error: any) {
      console.error('ElevenLabs error:', error);
      
      // Update error status
      await supabase
        .from('voiceovers')
        .update({ status: 'error', error_message: error.message })
        .eq('rewritten_content_id', rewriteId);

      toast({
        title: 'Ошибка генерации',
        description: error.message || 'Не удалось создать озвучку',
        variant: 'destructive'
      });
      
      await fetchItems();
    }
  }, [fetchItems, toast]);


  const saveRecordedAudio = useCallback(async (rewriteId: string, audioBlob: Blob, duration: number) => {
    try {
      const fileName = `recorded_${rewriteId}_${Date.now()}.webm`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('voiceovers')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voiceovers')
        .getPublicUrl(fileName);

      // Create or update voiceover record
      const { data: existing } = await supabase
        .from('voiceovers')
        .select('id')
        .eq('rewritten_content_id', rewriteId)
        .single();

      if (existing) {
        await supabase
          .from('voiceovers')
          .update({
            audio_url: publicUrl,
            audio_source: 'recorded',
            duration_seconds: Math.round(duration),
            status: 'ready',
            error_message: null
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('voiceovers')
          .insert({
            rewritten_content_id: rewriteId,
            audio_url: publicUrl,
            audio_source: 'recorded',
            duration_seconds: Math.round(duration),
            status: 'ready'
          });
      }

      toast({
        title: 'Успех',
        description: 'Запись сохранена'
      });

      await fetchItems();
    } catch (error: any) {
      console.error('Save recording error:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить запись',
        variant: 'destructive'
      });
    }
  }, [fetchItems, toast]);

  const uploadAudio = useCallback(async (rewriteId: string, file: File) => {
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const fileName = `uploaded_${rewriteId}_${Date.now()}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('voiceovers')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voiceovers')
        .getPublicUrl(fileName);

      // Create or update voiceover record
      const { data: existing } = await supabase
        .from('voiceovers')
        .select('id')
        .eq('rewritten_content_id', rewriteId)
        .single();

      if (existing) {
        await supabase
          .from('voiceovers')
          .update({
            audio_url: publicUrl,
            audio_source: 'uploaded',
            status: 'ready',
            error_message: null
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('voiceovers')
          .insert({
            rewritten_content_id: rewriteId,
            audio_url: publicUrl,
            audio_source: 'uploaded',
            status: 'ready'
          });
      }

      toast({
        title: 'Успех',
        description: 'Файл загружен'
      });

      await fetchItems();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить файл',
        variant: 'destructive'
      });
    }
  }, [fetchItems, toast]);

  // Generate voiceover from custom text (without rewritten content)
  const generateFromCustomText = useCallback(async (text: string, title: string) => {
    try {
      // Create a parsed_content record to hold the title
      const { data: parsedData, error: parsedError } = await supabase
        .from('parsed_content')
        .insert({
          title: title,
          content: text,
          status: 'rewritten',
          is_manual: true
        })
        .select()
        .single();

      if (parsedError) throw parsedError;

      // Create a rewritten_content record with the custom text
      const { data: rewriteData, error: rewriteError } = await supabase
        .from('rewritten_content')
        .insert({
          rewritten_text: text,
          script: text,
          parsed_content_id: parsedData.id
        })
        .select()
        .single();

      if (rewriteError) throw rewriteError;

      // Create voiceover record with title and set to processing
      await supabase
        .from('voiceovers')
        .insert({
          rewritten_content_id: rewriteData.id,
          title: title,
          status: 'processing',
          audio_source: 'elevenlabs'
        });

      // Call edge function to generate
      const response = await supabase.functions.invoke('generate-voiceover', {
        body: { rewriteId: rewriteData.id, text }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Успех',
        description: 'Озвучка создана'
      });

      await fetchItems();
    } catch (error: any) {
      console.error('Custom text voiceover error:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать озвучку',
        variant: 'destructive'
      });
    }
  }, [fetchItems, toast]);

  // Save recorded audio from custom text
  const saveCustomRecording = useCallback(async (text: string, title: string, audioBlob: Blob, duration: number) => {
    try {
      // First create records
      const { data: parsedData, error: parsedError } = await supabase
        .from('parsed_content')
        .insert({
          title: title,
          content: text,
          status: 'rewritten',
          is_manual: true
        })
        .select()
        .single();

      if (parsedError) throw parsedError;

      const { data: rewriteData, error: rewriteError } = await supabase
        .from('rewritten_content')
        .insert({
          rewritten_text: text,
          script: text,
          parsed_content_id: parsedData.id
        })
        .select()
        .single();

      if (rewriteError) throw rewriteError;

      // Upload audio to storage
      const fileName = `recorded_${rewriteData.id}_${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('voiceovers')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voiceovers')
        .getPublicUrl(fileName);

      // Create voiceover record with title
      await supabase
        .from('voiceovers')
        .insert({
          rewritten_content_id: rewriteData.id,
          title: title,
          audio_url: publicUrl,
          audio_source: 'recorded',
          duration_seconds: Math.round(duration),
          status: 'ready'
        });

      toast({
        title: 'Успех',
        description: 'Запись сохранена'
      });

      await fetchItems();
    } catch (error: any) {
      console.error('Custom recording error:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить запись',
        variant: 'destructive'
      });
    }
  }, [fetchItems, toast]);

  // Upload audio from custom text
  const uploadCustomAudio = useCallback(async (text: string, title: string, file: File) => {
    try {
      // First create records
      const { data: parsedData, error: parsedError } = await supabase
        .from('parsed_content')
        .insert({
          title: title,
          content: text,
          status: 'rewritten',
          is_manual: true
        })
        .select()
        .single();

      if (parsedError) throw parsedError;

      const { data: rewriteData, error: rewriteError } = await supabase
        .from('rewritten_content')
        .insert({
          rewritten_text: text,
          script: text,
          parsed_content_id: parsedData.id
        })
        .select()
        .single();

      if (rewriteError) throw rewriteError;

      // Upload audio to storage
      const ext = file.name.split('.').pop() || 'mp3';
      const fileName = `uploaded_${rewriteData.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('voiceovers')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voiceovers')
        .getPublicUrl(fileName);

      // Create voiceover record with title
      await supabase
        .from('voiceovers')
        .insert({
          rewritten_content_id: rewriteData.id,
          title: title,
          audio_url: publicUrl,
          audio_source: 'uploaded',
          status: 'ready'
        });

      toast({
        title: 'Успех',
        description: 'Файл загружен'
      });

      await fetchItems();
    } catch (error: any) {
      console.error('Custom upload error:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить файл',
        variant: 'destructive'
      });
    }
  }, [fetchItems, toast]);

  const deleteVoiceover = useCallback(async (rewriteId: string) => {
    try {
      await supabase
        .from('voiceovers')
        .delete()
        .eq('rewritten_content_id', rewriteId);

      toast({
        title: 'Удалено',
        description: 'Озвучка удалена'
      });

      await fetchItems();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить озвучку',
        variant: 'destructive'
      });
    }
  }, [fetchItems, toast]);

  const createVideoFromVoiceover = useCallback(async (rewriteId: string, avatarId: string, aspectRatio: '16:9' | '9:16' = '9:16'): Promise<void> => {
    try {
      // Find the item with voiceover
      const item = items.find(i => i.id === rewriteId);
      if (!item?.voiceover?.audio_url) {
        throw new Error('Озвучка не найдена');
      }

      const audioUrl = item.voiceover.audio_url;
      const title = item.parsed_content?.title || 'Видео из озвучки';

      // Create video project
      const { data: project, error: createError } = await supabase
        .from('video_projects')
        .insert({
          title: title,
          rewritten_content_id: rewriteId,
          avatar_id: avatarId,
          voiceover_url: audioUrl,
          status: 'pending',
          progress: 0
        })
        .select()
        .single();

      if (createError) throw createError;

      // Call create-heygen-video with audio URL and aspect ratio
      const { error: fnError } = await supabase.functions.invoke('create-heygen-video', {
        body: {
          videoProjectId: project.id,
          avatarId: avatarId,
          audioUrl: audioUrl,
          aspectRatio: aspectRatio
        }
      });

      if (fnError) throw fnError;

      toast({
        title: 'Видео создается',
        description: 'Перейдите во вкладку "Видео" для отслеживания статуса'
      });
    } catch (error: any) {
      console.error('Create video error:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать видео',
        variant: 'destructive'
      });
      throw error;
    }
  }, [items, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const pendingCount = items.filter(item => !item.voiceover || item.voiceover.status === 'pending').length;
  const readyCount = items.filter(item => item.voiceover?.status === 'ready').length;

  return {
    items,
    loading,
    pendingCount,
    readyCount,
    refetch: fetchItems,
    generateElevenLabs,
    saveRecordedAudio,
    uploadAudio,
    deleteVoiceover,
    createVideoFromVoiceover,
    generateFromCustomText,
    saveCustomRecording,
    uploadCustomAudio
  };
}
