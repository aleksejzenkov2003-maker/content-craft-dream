import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RelevanceKeyword {
  keyword: string;
  weight: number;
  category: string;
}

interface ParsedContent {
  id: string;
  title: string;
  content: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting relevance recalculation...');

    // Fetch all keywords
    const { data: keywords, error: kwError } = await supabase
      .from('relevance_keywords')
      .select('keyword, weight, category')
      .eq('is_active', true);

    if (kwError) {
      throw new Error(`Failed to fetch keywords: ${kwError.message}`);
    }

    console.log(`Loaded ${keywords?.length || 0} keywords`);

    // Fetch all parsed content
    const { data: content, error: contentError } = await supabase
      .from('parsed_content')
      .select('id, title, content');

    if (contentError) {
      throw new Error(`Failed to fetch content: ${contentError.message}`);
    }

    console.log(`Processing ${content?.length || 0} content items`);

    // Process each item
    const updates: { id: string; relevance_score: number; matched_keywords: string[] }[] = [];
    
    for (const item of content || []) {
      const { relevanceScore, matchedKeywords } = calculateRelevanceScore(item, keywords || []);
      updates.push({
        id: item.id,
        relevance_score: relevanceScore,
        matched_keywords: matchedKeywords
      });
    }

    // Update in batches of 50
    let updated = 0;
    const batchSize = 50;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('parsed_content')
          .update({
            relevance_score: update.relevance_score,
            matched_keywords: update.matched_keywords
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`Failed to update ${update.id}: ${updateError.message}`);
        } else {
          updated++;
        }
      }
    }

    console.log(`Successfully updated ${updated} items`);

    // Return summary
    const highRelevance = updates.filter(u => u.relevance_score >= 70).length;
    const mediumRelevance = updates.filter(u => u.relevance_score >= 40 && u.relevance_score < 70).length;
    const lowRelevance = updates.filter(u => u.relevance_score < 40).length;

    return new Response(JSON.stringify({
      success: true,
      message: `Пересчитано ${updated} записей`,
      stats: {
        total: updates.length,
        updated,
        highRelevance,
        mediumRelevance,
        lowRelevance,
        keywordsUsed: keywords?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function calculateRelevanceScore(
  item: ParsedContent, 
  keywords: RelevanceKeyword[]
): { relevanceScore: number; matchedKeywords: string[] } {
  const text = `${item.title} ${item.content || ''}`.toLowerCase();
  const matchedKeywords: string[] = [];
  let totalScore = 0;
  
  const categoryMultipliers: Record<string, number> = {
    'ip': 2.0,
    'legal': 1.5,
    'practice': 1.2,
    'ai': 0.8
  };
  
  for (const kw of keywords) {
    const keyword = kw.keyword.toLowerCase();
    const escapedKeyword = escapeRegex(keyword);
    
    // Pattern that works with Cyrillic
    const pattern = `(?:^|[^а-яёa-z0-9])${escapedKeyword}(?:[^а-яёa-z0-9]|$)`;
    const regex = new RegExp(pattern, 'gi');
    const matches = text.match(regex);
    
    if (matches && matches.length > 0) {
      const categoryMultiplier = categoryMultipliers[kw.category] || 1;
      const matchCount = Math.min(matches.length, 5);
      const matchScore = kw.weight * categoryMultiplier * (1 + Math.log(matchCount) / 2);
      totalScore += matchScore;
      matchedKeywords.push(kw.keyword);
    } else {
      // Partial match for compound keywords
      const words = keyword.split(' ');
      if (words.length > 1) {
        const firstWord = words[0];
        if (firstWord.length >= 4 && text.includes(firstWord.substring(0, Math.min(firstWord.length, 6)))) {
          const firstWordIndex = text.indexOf(firstWord.substring(0, Math.min(firstWord.length, 6)));
          const nearbyText = text.substring(firstWordIndex, firstWordIndex + 80);
          const allWordsNearby = words.every(w => nearbyText.includes(w.substring(0, Math.min(w.length, 5))));
          
          if (allWordsNearby) {
            const categoryMultiplier = categoryMultipliers[kw.category] || 1;
            const matchScore = kw.weight * categoryMultiplier * 0.7;
            totalScore += matchScore;
            matchedKeywords.push(kw.keyword);
          }
        }
      }
    }
  }
  
  const uniqueKeywords = [...new Set(matchedKeywords)];
  const normalizedScore = Math.min(100, Math.round(totalScore * 5));
  
  return {
    relevanceScore: normalizedScore,
    matchedKeywords: uniqueKeywords
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
