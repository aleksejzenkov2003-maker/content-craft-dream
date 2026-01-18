import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DbVideoProject {
  id: string;
  rewritten_content_id: string | null;
  title: string;
  status: 'pending' | 'voiceover' | 'generating' | 'editing' | 'ready' | 'published';
  voiceover_url: string | null;
  heygen_video_id: string | null;
  heygen_video_url: string | null;
  final_video_url: string | null;
  avatar_id: string | null;
  voice_id: string | null;
  duration: number | null;
  progress: number;
  error_message: string | null;
  created_at: string;
  submagic_project_id: string | null;
  submagic_video_url: string | null;
  is_edited: boolean;
  // Joined data
  rewritten_content?: {
    id: string;
    rewritten_text: string;
    hook: string | null;
    cta: string | null;
    script: string | null;
    parsed_content?: {
      id: string;
      title: string;
      content: string | null;
      original_url: string | null;
      channels?: {
        name: string;
        source: string;
      } | null;
    } | null;
  } | null;
}

export function useVideoProjects() {
  const [projects, setProjects] = useState<DbVideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('video_projects')
        .select(`
          *,
          rewritten_content (
            id,
            rewritten_text,
            hook,
            cta,
            script,
            parsed_content (
              id,
              title,
              content,
              original_url,
              channels (
                name,
                source
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type assertion for the joined data
      const typedData = (data || []).map(project => ({
        ...project,
        rewritten_content: project.rewritten_content as DbVideoProject['rewritten_content']
      }));
      
      setProjects(typedData);
    } catch (error: unknown) {
      console.error('Error fetching video projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Auto-polling for generating and editing projects
  useEffect(() => {
    const generatingProjects = projects.filter(p => p.status === 'generating');
    const editingProjects = projects.filter(p => p.status === 'editing');
    
    if (generatingProjects.length === 0 && editingProjects.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const project of generatingProjects) {
        await checkVideoStatus(project.id);
      }
      for (const project of editingProjects) {
        await checkSubmagicStatus(project.id);
      }
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(pollInterval);
  }, [projects]);

  const createProject = async (title: string, rewrittenContentId?: string) => {
    try {
      const { data, error } = await supabase
        .from('video_projects')
        .insert({
          title,
          rewritten_content_id: rewrittenContentId || null,
          status: 'pending',
          progress: 0
        })
        .select()
        .single();

      if (error) throw error;
      
      setProjects(prev => [data, ...prev]);
      toast({
        title: 'Проект создан',
        description: title
      });
      
      return data;
    } catch (error: unknown) {
      console.error('Error creating project:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать проект',
        variant: 'destructive'
      });
    }
  };

  const generateVoiceover = async (projectId: string, text: string, voiceId?: string) => {
    toast({
      title: 'Генерация озвучки',
      description: 'Это может занять некоторое время...'
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-voiceover', {
        body: { videoProjectId: projectId, text, voiceId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Озвучка готова'
        });
        
        setProjects(prev => prev.map(p => 
          p.id === projectId ? { 
            ...p, 
            status: 'voiceover' as const,
            voiceover_url: data.voiceoverUrl,
            progress: 50
          } : p
        ));
        
        return data.voiceoverUrl;
      } else {
        throw new Error(data?.error || 'Voiceover failed');
      }
    } catch (error: unknown) {
      console.error('Voiceover error:', error);
      toast({
        title: 'Ошибка озвучки',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const createHeyGenVideo = async (projectId: string, script: string, avatarId?: string) => {
    toast({
      title: 'Создание видео',
      description: 'Отправляем в HeyGen...'
    });

    try {
      // Update local state immediately
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { 
          ...p, 
          status: 'generating' as const,
          avatar_id: avatarId || null,
          progress: 60
        } : p
      ));

      const { data, error } = await supabase.functions.invoke('create-heygen-video', {
        body: { videoProjectId: projectId, script, avatarId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Видео создается',
          description: 'Следите за статусом в панели'
        });
        
        setProjects(prev => prev.map(p => 
          p.id === projectId ? { 
            ...p, 
            status: 'generating' as const,
            heygen_video_id: data.heygenVideoId,
            progress: 70
          } : p
        ));
        
        return data.heygenVideoId;
      } else {
        throw new Error(data?.error || 'HeyGen failed');
      }
    } catch (error: unknown) {
      console.error('HeyGen error:', error);
      
      // Revert status on error
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { 
          ...p, 
          status: 'pending' as const,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          progress: 0
        } : p
      ));
      
      toast({
        title: 'Ошибка HeyGen',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const checkVideoStatus = useCallback(async (projectId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-heygen-status', {
        body: { videoProjectId: projectId }
      });

      if (error) throw error;

      if (data?.success) {
        if (data.status === 'completed' && data.videoUrl) {
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { 
              ...p, 
              status: 'ready' as const,
              heygen_video_url: data.videoUrl,
              final_video_url: data.videoUrl,
              duration: data.duration || null,
              progress: 100
            } : p
          ));
          
          toast({
            title: '🎉 Видео готово!',
            description: 'Можно скачать или опубликовать'
          });
        } else if (data.status === 'processing') {
          // Update progress
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { 
              ...p, 
              progress: Math.min(p.progress + 5, 95)
            } : p
          ));
        } else if (data.status === 'failed') {
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { 
              ...p, 
              status: 'pending' as const,
              error_message: data.error || 'Video generation failed',
              progress: 0
            } : p
          ));
          
          toast({
            title: 'Ошибка генерации',
            description: data.error || 'Video generation failed',
            variant: 'destructive'
          });
        }
        
        return data;
      }
    } catch (error: unknown) {
      console.error('Status check error:', error);
    }
  }, [toast]);

  const sendToSubmagic = async (projectId: string, templateName?: string) => {
    toast({
      title: 'Отправка на монтаж',
      description: 'Видео отправляется в Submagic...'
    });

    try {
      // Update local state immediately
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { 
          ...p, 
          status: 'editing' as const,
          progress: 75
        } : p
      ));

      const { data, error } = await supabase.functions.invoke('send-to-submagic', {
        body: { videoProjectId: projectId, templateName }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Видео на монтаже',
          description: 'Следите за статусом в панели'
        });
        
        setProjects(prev => prev.map(p => 
          p.id === projectId ? { 
            ...p, 
            status: 'editing' as const,
            submagic_project_id: data.submagicProjectId,
            progress: 75
          } : p
        ));
        
        return data.submagicProjectId;
      } else {
        throw new Error(data?.error || 'Submagic failed');
      }
    } catch (error: unknown) {
      console.error('Submagic error:', error);
      
      // Revert status on error
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { 
          ...p, 
          status: 'ready' as const,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          progress: 100
        } : p
      ));
      
      toast({
        title: 'Ошибка Submagic',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const checkSubmagicStatus = useCallback(async (projectId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-submagic-status', {
        body: { videoProjectId: projectId }
      });

      if (error) throw error;

      if (data?.success) {
        if (data.isEdited && data.videoUrl) {
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { 
              ...p, 
              status: 'ready' as const,
              submagic_video_url: data.videoUrl,
              final_video_url: data.videoUrl,
              is_edited: true,
              duration: data.duration || null,
              progress: 100
            } : p
          ));
          
          toast({
            title: '🎬 Монтаж завершён!',
            description: 'Смонтированное видео готово'
          });
        } else if (data.status === 'processing' || data.status === 'pending') {
          // Update progress
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { 
              ...p, 
              progress: Math.min(p.progress + 5, 95)
            } : p
          ));
        } else if (data.status === 'failed') {
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { 
              ...p, 
              status: 'ready' as const,
              error_message: data.error || 'Submagic editing failed',
              progress: 100
            } : p
          ));
          
          toast({
            title: 'Ошибка монтажа',
            description: data.error || 'Submagic editing failed',
            variant: 'destructive'
          });
        }
        
        return data;
      }
    } catch (error: unknown) {
      console.error('Submagic status check error:', error);
    }
  }, [toast]);

  const updateProject = async (projectId: string, updates: Partial<DbVideoProject>) => {
    try {
      const { error } = await supabase
        .from('video_projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, ...updates } : p
      ));
    } catch (error: unknown) {
      console.error('Error updating project:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить проект',
        variant: 'destructive'
      });
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('video_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast({
        title: 'Видео удалено',
        description: 'Проект успешно удален'
      });
    } catch (error: unknown) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить проект',
        variant: 'destructive'
      });
    }
  };

  return {
    projects,
    loading,
    createProject,
    generateVoiceover,
    createHeyGenVideo,
    checkVideoStatus,
    sendToSubmagic,
    checkSubmagicStatus,
    updateProject,
    deleteProject,
    refetch: fetchProjects
  };
}
