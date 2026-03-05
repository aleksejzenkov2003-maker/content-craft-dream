
-- Create proxy_servers table
CREATE TABLE public.proxy_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  login text,
  password text,
  server text NOT NULL,
  port integer NOT NULL DEFAULT 8080,
  protocol text NOT NULL DEFAULT 'HTTP',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proxy_servers ENABLE ROW LEVEL SECURITY;

-- Allow all for now (no auth required based on existing patterns)
CREATE POLICY "Allow all access to proxy_servers" ON public.proxy_servers
  FOR ALL USING (true) WITH CHECK (true);

-- Add proxy_id FK to publishing_channels
ALTER TABLE public.publishing_channels
  ADD COLUMN proxy_id uuid REFERENCES public.proxy_servers(id) ON DELETE SET NULL;

-- Add unique constraint on name for upsert support
ALTER TABLE public.proxy_servers ADD CONSTRAINT proxy_servers_name_key UNIQUE (name);
