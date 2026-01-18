-- Add relevance columns to parsed_content
ALTER TABLE parsed_content 
ADD COLUMN IF NOT EXISTS relevance_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS matched_keywords JSONB DEFAULT '[]'::jsonb;

-- Create table for configurable keywords
CREATE TABLE IF NOT EXISTS relevance_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  keyword TEXT NOT NULL,
  weight NUMERIC DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE relevance_keywords ENABLE ROW LEVEL SECURITY;

-- RLS policy for relevance_keywords
CREATE POLICY "Allow all access to relevance_keywords" 
ON relevance_keywords FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert initial keywords based on the lexical analysis
INSERT INTO relevance_keywords (category, keyword, weight) VALUES
-- AI & Technology (высокий вес)
('ai', 'ИИ', 2),
('ai', 'нейросеть', 2),
('ai', 'нейросети', 2),
('ai', 'ChatGPT', 2),
('ai', 'Claude', 2),
('ai', 'GPT', 2),
('ai', 'Gemini', 2),
('ai', 'DeepSeek', 2),
('ai', 'AI', 2),
('ai', 'модель', 1.5),
('ai', 'промпт', 1.5),
('ai', 'токен', 1),
('ai', 'API', 1.5),
-- Legal (высокий вес)
('legal', 'юрист', 2),
('legal', 'адвокат', 2),
('legal', 'суд', 2),
('legal', 'судебный', 2),
('legal', 'закон', 2),
('legal', 'договор', 2),
('legal', 'иск', 2),
('legal', 'право', 1.5),
('legal', 'правовой', 1.5),
('legal', 'дело', 1.5),
('legal', 'клиент', 1),
('legal', 'практика', 1.5),
('legal', 'уголовный', 1.5),
('legal', 'гражданский', 1.5),
('legal', 'арбитраж', 2),
-- Practice (средний вес)
('practice', 'документ', 1.5),
('practice', 'анализ', 1.5),
('practice', 'исследование', 1),
('practice', 'кейс', 1.5),
('practice', 'решение', 1),
('practice', 'результат', 1),
('practice', 'задача', 1),
-- Tools (средний вес)
('tools', 'бот', 1.5),
('tools', 'сервис', 1),
('tools', 'автоматизация', 1.5),
('tools', 'интеграция', 1),
('tools', 'инструмент', 1);