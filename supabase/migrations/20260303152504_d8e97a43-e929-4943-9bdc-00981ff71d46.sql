UPDATE public.playlist_scenes 
SET status = 'approved' 
WHERE lower(trim(status)) IN ('сцена готова', 'одобрено', 'готово', 'ready', 'done')
  AND status != 'approved';