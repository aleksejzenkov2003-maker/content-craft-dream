CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES ('heygen_mode', 'v3');