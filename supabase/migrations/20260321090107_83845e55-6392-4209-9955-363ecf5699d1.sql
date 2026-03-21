
INSERT INTO public.automation_settings (button_key, process_key, process_label, is_enabled) VALUES
('generate_video', 'motion', 'Motion аватар', false),
('bulk_generate_covers', 'motion', 'Motion аватар', false),
('bulk_publish', 'motion', 'Motion аватар', false),
('prepare_publish', 'motion', 'Motion аватар', false),
('publish', 'motion', 'Motion аватар', false),
('take_in_work', 'motion', 'Motion аватар', false)
ON CONFLICT DO NOTHING;
