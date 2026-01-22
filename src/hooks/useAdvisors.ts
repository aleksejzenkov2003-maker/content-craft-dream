import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdvisorPhoto {
  id: string;
  advisor_id: string;
  photo_url: string;
  heygen_asset_id: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface Advisor {
  id: string;
  name: string;
  display_name: string | null;
  speech_speed: number;
  elevenlabs_voice_id: string | null;
  back_cover_template_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  photos?: AdvisorPhoto[];
}

export function useAdvisors() {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdvisors = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('advisors')
        .select(`
          *,
          advisor_photos (*)
        `)
        .order('name');

      if (error) throw error;

      const formattedData = (data || []).map(advisor => ({
        ...advisor,
        photos: advisor.advisor_photos || []
      }));

      setAdvisors(formattedData);
    } catch (error: any) {
      console.error('Error fetching advisors:', error);
      toast.error('Ошибка загрузки духовников');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdvisors();
  }, [fetchAdvisors]);

  const addAdvisor = async (data: { 
    name: string; 
    display_name?: string; 
    speech_speed?: number;
    elevenlabs_voice_id?: string;
  }) => {
    try {
      const { data: newAdvisor, error } = await supabase
        .from('advisors')
        .insert({
          name: data.name,
          display_name: data.display_name || null,
          speech_speed: data.speech_speed || 1.0,
          elevenlabs_voice_id: data.elevenlabs_voice_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchAdvisors();
      toast.success('Духовник добавлен');
      return newAdvisor;
    } catch (error: any) {
      console.error('Error adding advisor:', error);
      toast.error('Ошибка добавления духовника');
      throw error;
    }
  };

  const updateAdvisor = async (id: string, updates: Partial<Advisor>) => {
    try {
      const { error } = await supabase
        .from('advisors')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchAdvisors();
      toast.success('Духовник обновлён');
    } catch (error: any) {
      console.error('Error updating advisor:', error);
      toast.error('Ошибка обновления духовника');
      throw error;
    }
  };

  const deleteAdvisor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('advisors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchAdvisors();
      toast.success('Духовник удалён');
    } catch (error: any) {
      console.error('Error deleting advisor:', error);
      toast.error('Ошибка удаления духовника');
      throw error;
    }
  };

  const addPhoto = async (advisorId: string, photoUrl: string, isPrimary = false) => {
    try {
      // If setting as primary, unset other primary photos first
      if (isPrimary) {
        await supabase
          .from('advisor_photos')
          .update({ is_primary: false })
          .eq('advisor_id', advisorId);
      }

      const { data, error } = await supabase
        .from('advisor_photos')
        .insert({
          advisor_id: advisorId,
          photo_url: photoUrl,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchAdvisors();
      toast.success('Фото добавлено');
      return data;
    } catch (error: any) {
      console.error('Error adding photo:', error);
      toast.error('Ошибка добавления фото');
      throw error;
    }
  };

  const updatePhotoAssetId = async (photoId: string, assetId: string) => {
    try {
      const { error } = await supabase
        .from('advisor_photos')
        .update({ heygen_asset_id: assetId })
        .eq('id', photoId);

      if (error) throw error;

      await fetchAdvisors();
      toast.success('Asset ID обновлён');
    } catch (error: any) {
      console.error('Error updating asset ID:', error);
      toast.error('Ошибка обновления Asset ID');
      throw error;
    }
  };

  const deletePhoto = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('advisor_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      await fetchAdvisors();
      toast.success('Фото удалено');
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast.error('Ошибка удаления фото');
      throw error;
    }
  };

  const setPrimaryPhoto = async (advisorId: string, photoId: string) => {
    try {
      // Unset all primary for this advisor
      await supabase
        .from('advisor_photos')
        .update({ is_primary: false })
        .eq('advisor_id', advisorId);

      // Set the selected one as primary
      const { error } = await supabase
        .from('advisor_photos')
        .update({ is_primary: true })
        .eq('id', photoId);

      if (error) throw error;

      await fetchAdvisors();
      toast.success('Основное фото установлено');
    } catch (error: any) {
      console.error('Error setting primary photo:', error);
      toast.error('Ошибка установки основного фото');
      throw error;
    }
  };

  return {
    advisors,
    loading,
    refetch: fetchAdvisors,
    addAdvisor,
    updateAdvisor,
    deleteAdvisor,
    addPhoto,
    updatePhotoAssetId,
    deletePhoto,
    setPrimaryPhoto,
  };
}
