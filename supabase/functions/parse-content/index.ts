import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseRequest {
  channelId: string;
  url: string;
  source: 'youtube' | 'telegram' | 'instagram' | 'web';
  daysBack?: number;
}

interface ParsedItem {
  title: string;
  content: string;
  url: string;
  thumbnail: string | null;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  tags?: string[];
  transcript?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId, url, source, daysBack = 30 } = await req.json() as ParseRequest;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Parsing ${source} content from: ${url}, daysBack: ${daysBack}`);

    let parsedItems: ParsedItem[] = [];

    if (source === 'youtube') {
      parsedItems = await parseYouTube(url, daysBack);
    } else if (source === 'telegram') {
      parsedItems = await parseTelegram(url, daysBack);
    } else if (source === 'instagram') {
      parsedItems = await parseInstagram(url, daysBack);
    } else {
      parsedItems = await parseWeb(url, daysBack);
    }

    console.log(`Parsed ${parsedItems.length} items before date filtering`);

    // Filter by date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const filteredItems = parsedItems.filter(item => {
      const publishedDate = new Date(item.publishedAt);
      return publishedDate >= cutoffDate;
    });

    console.log(`After date filter: ${filteredItems.length} items`);

    // Fetch relevance keywords from database
    const { data: keywords } = await supabase
      .from('relevance_keywords')
      .select('keyword, weight, category')
      .eq('is_active', true);
    
    console.log(`Loaded ${keywords?.length || 0} relevance keywords`);

    // Calculate relevance score for each item
    const contentToInsert = filteredItems.map(item => {
      const { relevanceScore, matchedKeywords } = calculateRelevanceScore(item, keywords || []);
      
      return {
        channel_id: channelId,
        title: item.title,
        content: item.content + (item.tags ? `\n\nТеги: ${item.tags.join(', ')}` : '') + (item.transcript ? `\n\nТранскрипт: ${item.transcript}` : ''),
        original_url: item.url,
        thumbnail_url: item.thumbnail,
        views: item.views || 0,
        likes: item.likes || 0,
        comments: item.comments || 0,
        engagement_score: calculateEngagement(item),
        relevance_score: relevanceScore,
        matched_keywords: matchedKeywords,
        published_at: item.publishedAt,
        status: 'parsed'
      };
    });

    if (contentToInsert.length > 0) {
      // Check for duplicates by URL
      const urls = contentToInsert.map(c => c.original_url);
      const { data: existingContent } = await supabase
        .from('parsed_content')
        .select('original_url')
        .in('original_url', urls);

      const existingUrls = new Set((existingContent || []).map(c => c.original_url));
      const newContent = contentToInsert.filter(c => !existingUrls.has(c.original_url));

      if (newContent.length > 0) {
        const { data, error } = await supabase
          .from('parsed_content')
          .insert(newContent)
          .select();

        if (error) throw error;

        // Update channel stats
        const { data: totalCount } = await supabase
          .from('parsed_content')
          .select('id', { count: 'exact', head: true })
          .eq('channel_id', channelId);

        await supabase
          .from('channels')
          .update({ 
            last_parsed_at: new Date().toISOString(),
            posts_count: totalCount?.length || newContent.length
          })
          .eq('id', channelId);

        // Log activity
        await supabase.from('activity_log').insert({
          action: 'parse_complete',
          entity_type: 'channel',
          entity_id: channelId,
          details: { 
            items_count: newContent.length, 
            source,
            daysBack,
            duplicates_skipped: contentToInsert.length - newContent.length
          }
        });

        console.log(`Saved ${newContent.length} new items (${contentToInsert.length - newContent.length} duplicates skipped)`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            count: newContent.length, 
            items: data,
            duplicatesSkipped: contentToInsert.length - newContent.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: 0, items: [], duplicatesSkipped: contentToInsert.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Parse error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateEngagement(item: ParsedItem): number {
  const views = item.views || 1;
  const likes = item.likes || 0;
  const comments = item.comments || 0;
  return Math.round(((likes + comments * 2) / views) * 10000) / 100;
}

interface RelevanceKeyword {
  keyword: string;
  weight: number;
  category: string;
}

function calculateRelevanceScore(
  item: ParsedItem, 
  keywords: RelevanceKeyword[]
): { relevanceScore: number; matchedKeywords: string[] } {
  const text = `${item.title} ${item.content}`.toLowerCase();
  const matchedKeywords: string[] = [];
  let totalScore = 0;
  
  // Category weights - IP (intellectual property) is most important
  const categoryMultipliers: Record<string, number> = {
    'ip': 2.0,      // Товарные знаки, патенты - высший приоритет
    'legal': 1.5,   // Общие юридические термины
    'practice': 1.2,// Практика, кейсы
    'ai': 0.8       // AI - только если связано с юр. тематикой
  };
  
  for (const kw of keywords) {
    const keyword = kw.keyword.toLowerCase();
    
    // Create regex pattern that works with Cyrillic characters
    // Using negative lookbehind/lookahead with word characters including Cyrillic
    const escapedKeyword = escapeRegex(keyword);
    
    // For Cyrillic, \b doesn't work properly, so we use character class boundaries
    // Match keyword at start/end of string or surrounded by non-word characters
    const pattern = `(?:^|[^а-яёa-z0-9])${escapedKeyword}(?:[^а-яёa-z0-9]|$)`;
    const regex = new RegExp(pattern, 'gi');
    const matches = text.match(regex);
    
    if (matches && matches.length > 0) {
      const categoryMultiplier = categoryMultipliers[kw.category] || 1;
      // Count matches but with diminishing returns (log scale)
      const matchCount = Math.min(matches.length, 5);
      const matchScore = kw.weight * categoryMultiplier * (1 + Math.log(matchCount) / 2);
      totalScore += matchScore;
      matchedKeywords.push(kw.keyword);
    } else {
      // Also try partial match for compound keywords (e.g., "товарный знак" should match "товарного знака")
      // Extract first word for partial matching
      const words = keyword.split(' ');
      if (words.length > 1) {
        const firstWord = words[0];
        if (firstWord.length >= 4 && text.includes(firstWord.substring(0, Math.min(firstWord.length, 6)))) {
          // Check if other words are nearby (within ~50 chars)
          const firstWordIndex = text.indexOf(firstWord.substring(0, Math.min(firstWord.length, 6)));
          const nearbyText = text.substring(firstWordIndex, firstWordIndex + 80);
          const allWordsNearby = words.every(w => nearbyText.includes(w.substring(0, Math.min(w.length, 5))));
          
          if (allWordsNearby) {
            const categoryMultiplier = categoryMultipliers[kw.category] || 1;
            // Partial match gets 70% of the weight
            const matchScore = kw.weight * categoryMultiplier * 0.7;
            totalScore += matchScore;
            matchedKeywords.push(kw.keyword);
          }
        }
      }
    }
  }
  
  // Remove duplicates from matched keywords
  const uniqueKeywords = [...new Set(matchedKeywords)];
  
  // Normalize score to 0-100 range
  // A good relevant article should score 20+ (multiple IP keywords matched)
  const normalizedScore = Math.min(100, Math.round(totalScore * 5));
  
  console.log(`Relevance for "${item.title.substring(0, 50)}": score=${normalizedScore}, keywords=${uniqueKeywords.join(', ')}`);
  
  return {
    relevanceScore: normalizedScore,
    matchedKeywords: uniqueKeywords
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===================== YOUTUBE =====================

async function parseYouTube(url: string, daysBack: number): Promise<ParsedItem[]> {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  
  if (!apiKey) {
    console.log('YOUTUBE_API_KEY not found, falling back to HTML parsing');
    return parseYouTubeHTML(url);
  }

  // Extract channel or video ID from URL
  const channelMatch = url.match(/(?:channel\/|c\/|@)([^\/\?]+)/);
  const videoMatch = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([^&\?\s]+)/);
  
  if (videoMatch) {
    // Parse single video via API
    const videoId = videoMatch[1];
    return await fetchYouTubeVideoDetails([videoId], apiKey);
  }
  
  if (channelMatch) {
    // Get channel videos via API
    const channelIdentifier = channelMatch[1];
    return await fetchYouTubeChannelVideos(channelIdentifier, apiKey, daysBack);
  }
  
  return [];
}

async function fetchYouTubeChannelVideos(channelIdentifier: string, apiKey: string, daysBack: number): Promise<ParsedItem[]> {
  try {
    // First, get the channel ID (handle @username format)
    let channelId = channelIdentifier;
    
    if (channelIdentifier.startsWith('@') || !channelIdentifier.startsWith('UC')) {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelIdentifier)}&type=channel&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.items?.[0]?.id?.channelId) {
        channelId = searchData.items[0].id.channelId;
      } else {
        // Try channels list with forHandle
        const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${channelIdentifier.replace('@', '')}&key=${apiKey}`;
        const handleRes = await fetch(handleUrl);
        const handleData = await handleRes.json();
        
        if (handleData.items?.[0]?.id) {
          channelId = handleData.items[0].id;
        } else {
          console.error('Could not find channel ID for:', channelIdentifier);
          return parseYouTubeHTML(`https://www.youtube.com/@${channelIdentifier}/videos`);
        }
      }
    }

    console.log('Found channel ID:', channelId);

    // Get uploads playlist ID
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
    const channelRes = await fetch(channelUrl);
    const channelData = await channelRes.json();
    
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error('Could not find uploads playlist');
      return [];
    }

    // Get videos from playlist
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();
    
    if (!playlistData.items) {
      console.error('No videos found in playlist');
      return [];
    }

    // Filter by date and get video IDs
    const videoIds = playlistData.items
      .filter((item: any) => new Date(item.snippet.publishedAt) >= cutoffDate)
      .map((item: any) => item.contentDetails.videoId);

    console.log(`Found ${videoIds.length} videos within ${daysBack} days`);

    if (videoIds.length === 0) return [];

    // Get full video details
    return await fetchYouTubeVideoDetails(videoIds, apiKey);

  } catch (error) {
    console.error('YouTube API error:', error);
    return parseYouTubeHTML(`https://www.youtube.com/@${channelIdentifier}/videos`);
  }
}

async function fetchYouTubeVideoDetails(videoIds: string[], apiKey: string): Promise<ParsedItem[]> {
  const items: ParsedItem[] = [];
  
  // YouTube API allows up to 50 videos per request
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error('YouTube API error:', data.error);
      continue;
    }

    for (const video of data.items || []) {
      const snippet = video.snippet;
      const stats = video.statistics || {};
      
      items.push({
        title: snippet.title,
        content: snippet.description || '',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
        views: parseInt(stats.viewCount) || 0,
        likes: parseInt(stats.likeCount) || 0,
        comments: parseInt(stats.commentCount) || 0,
        publishedAt: snippet.publishedAt,
        tags: snippet.tags || [],
      });
    }
  }
  
  return items;
}

async function parseYouTubeHTML(url: string): Promise<ParsedItem[]> {
  // Fallback to HTML parsing if API fails
  const html = await fetchHTML(url);
  
  const videoMatch = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([^&\?\s]+)/);
  if (videoMatch) {
    return [parseYouTubeVideoFromHTML(html, videoMatch[1])];
  }
  
  // Parse channel page
  const items: ParsedItem[] = [];
  const videoIds = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/g) || [];
  const uniqueIds = [...new Set(videoIds.map(v => v.replace('/watch?v=', '')))].slice(0, 20);
  
  // Try to extract more data from ytInitialData
  const initialDataMatch = html.match(/var ytInitialData = ({.*?});/);
  if (initialDataMatch) {
    try {
      const initialData = JSON.parse(initialDataMatch[1]);
      const tabs = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      
      for (const tab of tabs) {
        const tabContent = tab?.tabRenderer?.content?.richGridRenderer?.contents || [];
        for (const content of tabContent) {
          const video = content?.richItemRenderer?.content?.videoRenderer;
          if (video) {
            items.push({
              title: video.title?.runs?.[0]?.text || video.title?.simpleText || 'Unknown',
              content: video.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || '',
              url: `https://www.youtube.com/watch?v=${video.videoId}`,
              thumbnail: video.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg`,
              views: parseViewCount(video.viewCountText?.simpleText || '0'),
              likes: 0,
              comments: 0,
              publishedAt: video.publishedTimeText?.simpleText ? parseRelativeDate(video.publishedTimeText.simpleText) : new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.error('Error parsing ytInitialData:', e);
    }
  }
  
  // Fallback if no videos found
  if (items.length === 0) {
    for (const videoId of uniqueIds) {
      items.push({
        title: `Video ${videoId}`,
        content: '',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        views: 0,
        likes: 0,
        comments: 0,
        publishedAt: new Date().toISOString(),
      });
    }
  }
  
  return items;
}

function parseYouTubeVideoFromHTML(html: string, videoId: string): ParsedItem {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Title';
  
  const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  const content = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
  
  const viewsMatch = html.match(/"viewCount":"(\d+)"/);
  const views = viewsMatch ? parseInt(viewsMatch[1]) : 0;
  
  const likesMatch = html.match(/"likeCount":"(\d+)"/);
  const likes = likesMatch ? parseInt(likesMatch[1]) : 0;
  
  const dateMatch = html.match(/"publishDate":"([^"]+)"/);
  const publishedAt = dateMatch ? dateMatch[1] : new Date().toISOString();
  
  const tagsMatch = html.match(/"keywords":\[([^\]]+)\]/);
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.replace(/"/g, '').trim()) : [];
  
  return {
    title,
    content,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    views,
    likes,
    comments: 0,
    publishedAt,
    tags,
  };
}

// ===================== TELEGRAM =====================

async function parseTelegram(url: string, daysBack: number): Promise<ParsedItem[]> {
  const match = url.match(/t\.me\/([^\/\?]+)/);
  if (!match) return [];
  
  const channelName = match[1];
  const html = await fetchHTML(`https://t.me/s/${channelName}`);
  return parseTelegramHTML(html, channelName, daysBack);
}

function parseTelegramHTML(html: string, channelName: string, daysBack: number): ParsedItem[] {
  const items: ParsedItem[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  // Parse message blocks - improved regex
  const messageRegex = /<div class="tgme_widget_message_wrap[^"]*"[^>]*>[\s\S]*?<div class="tgme_widget_message text_not_supported_wrap[^"]*"[^>]*data-post="([^"]+)"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
  const simpleMessageRegex = /<div[^>]*data-post="([^"]+)"[^>]*class="[^"]*tgme_widget_message[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  
  let match;
  const processedPosts = new Set<string>();
  
  // Try to find all message blocks
  const messageBlocks = html.match(/<div[^>]*class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*tgme_widget_message [^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];
  
  console.log(`Found ${messageBlocks.length} message blocks`);
  
  for (const block of messageBlocks) {
    // Extract post ID
    const postIdMatch = block.match(/data-post="[^\/]+\/(\d+)"/);
    if (!postIdMatch) continue;
    
    const postId = postIdMatch[1];
    if (processedPosts.has(postId)) continue;
    processedPosts.add(postId);
    
    // Extract text
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let text = textMatch ? textMatch[1].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').trim() : '';
    
    if (!text) continue;
    
    // Extract date
    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const publishedAt = dateMatch ? dateMatch[1] : new Date().toISOString();
    
    // Check if within date range
    if (new Date(publishedAt) < cutoffDate) continue;
    
    // Extract views
    const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/);
    const views = viewsMatch ? parseViewCount(viewsMatch[1]) : 0;
    
    // Extract media
    const imageMatch = block.match(/background-image:url\('([^']+)'\)/);
    const thumbnail = imageMatch ? imageMatch[1] : null;
    
    items.push({
      title: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      content: text,
      url: `https://t.me/${channelName}/${postId}`,
      thumbnail,
      views,
      likes: 0,
      comments: 0,
      publishedAt,
    });
  }
  
  console.log(`Parsed ${items.length} Telegram posts`);
  return items;
}

// ===================== INSTAGRAM =====================

async function parseInstagram(url: string, daysBack: number): Promise<ParsedItem[]> {
  console.log('Instagram parsing - using Firecrawl API');
  
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return parseInstagramFallback(url);
  }
  
  try {
    // Use Firecrawl to scrape Instagram profile
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 3000, // Wait for JS to load
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl API error:', response.status, errorText);
      return parseInstagramFallback(url);
    }

    const data = await response.json();
    console.log('Firecrawl response received');
    
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    
    return parseInstagramFromFirecrawl(html, markdown, url);
  } catch (error) {
    console.error('Instagram Firecrawl parsing error:', error);
    return parseInstagramFallback(url);
  }
}

function parseInstagramFromFirecrawl(html: string, markdown: string, baseUrl: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  
  // Try to extract from shared data in HTML
  const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
  if (sharedDataMatch) {
    try {
      const data = JSON.parse(sharedDataMatch[1]);
      const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
      
      if (user?.edge_owner_to_timeline_media?.edges) {
        for (const edge of user.edge_owner_to_timeline_media.edges) {
          const node = edge.node;
          items.push({
            title: (node.edge_media_to_caption?.edges?.[0]?.node?.text || '').substring(0, 100),
            content: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            url: `https://www.instagram.com/p/${node.shortcode}/`,
            thumbnail: node.display_url || node.thumbnail_src,
            views: node.video_view_count || 0,
            likes: node.edge_liked_by?.count || 0,
            comments: node.edge_media_to_comment?.count || 0,
            publishedAt: new Date(node.taken_at_timestamp * 1000).toISOString(),
          });
        }
      }
    } catch (e) {
      console.error('Error parsing Instagram shared data:', e);
    }
  }
  
  // Try alternative JSON structure
  if (items.length === 0) {
    const additionalDataMatch = html.match(/window\.__additionalDataLoaded\s*\(\s*['"][^'"]+['"]\s*,\s*({.+?})\s*\)/);
    if (additionalDataMatch) {
      try {
        const data = JSON.parse(additionalDataMatch[1]);
        const edges = data?.graphql?.user?.edge_owner_to_timeline_media?.edges || 
                      data?.user?.edge_owner_to_timeline_media?.edges || [];
        
        for (const edge of edges) {
          const node = edge.node;
          items.push({
            title: (node.edge_media_to_caption?.edges?.[0]?.node?.text || '').substring(0, 100),
            content: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            url: `https://www.instagram.com/p/${node.shortcode}/`,
            thumbnail: node.display_url || node.thumbnail_src,
            views: node.video_view_count || 0,
            likes: node.edge_liked_by?.count || 0,
            comments: node.edge_media_to_comment?.count || 0,
            publishedAt: new Date(node.taken_at_timestamp * 1000).toISOString(),
          });
        }
      } catch (e) {
        console.error('Error parsing Instagram additional data:', e);
      }
    }
  }
  
  // Parse from markdown content if no structured data found
  if (items.length === 0 && markdown) {
    // Extract post links from markdown
    const postLinks = markdown.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/g) || [];
    const uniqueLinks = [...new Set(postLinks)];
    
    for (const link of uniqueLinks.slice(0, 20)) {
      const shortcode = link.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1];
      if (shortcode) {
        items.push({
          title: `Instagram Post ${shortcode}`,
          content: '',
          url: `https://www.instagram.com/p/${shortcode}/`,
          thumbnail: null,
          views: 0,
          likes: 0,
          comments: 0,
          publishedAt: new Date().toISOString(),
        });
      }
    }
  }
  
  // Fallback: try to extract from meta tags
  if (items.length === 0) {
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    
    if (titleMatch || descMatch) {
      items.push({
        title: titleMatch?.[1] || 'Instagram Post',
        content: descMatch?.[1] || '',
        url: baseUrl,
        thumbnail: imageMatch?.[1] || null,
        views: 0,
        likes: 0,
        comments: 0,
        publishedAt: new Date().toISOString(),
      });
    }
  }
  
  console.log(`Parsed ${items.length} Instagram items from Firecrawl data`);
  return items;
}

function parseInstagramFallback(url: string): ParsedItem[] {
  console.log('Instagram fallback - returning empty (requires Firecrawl API)');
  return [];
}

// ===================== WEB =====================

async function parseWeb(url: string, daysBack: number): Promise<ParsedItem[]> {
  const html = await fetchHTML(url);
  
  // Check for RSS feed
  const rssMatch = html.match(/<link[^>]+type="application\/rss\+xml"[^>]+href="([^"]+)"/i) ||
                   html.match(/<link[^>]+href="([^"]+)"[^>]+type="application\/rss\+xml"/i);
  
  if (rssMatch) {
    try {
      const rssUrl = new URL(rssMatch[1], url).href;
      console.log('Found RSS feed:', rssUrl);
      return await parseRSS(rssUrl, daysBack);
    } catch (e) {
      console.error('Error parsing RSS:', e);
    }
  }
  
  // Check for Atom feed
  const atomMatch = html.match(/<link[^>]+type="application\/atom\+xml"[^>]+href="([^"]+)"/i);
  if (atomMatch) {
    try {
      const atomUrl = new URL(atomMatch[1], url).href;
      console.log('Found Atom feed:', atomUrl);
      return await parseRSS(atomUrl, daysBack);
    } catch (e) {
      console.error('Error parsing Atom:', e);
    }
  }
  
  // No RSS/Atom - extract article links and scrape each
  console.log('No RSS feed found, extracting article links from HTML');
  return await parseWebWithArticleLinks(html, url, daysBack);
}

// Extract article links from a page and scrape each article
async function parseWebWithArticleLinks(html: string, baseUrl: string, daysBack: number): Promise<ParsedItem[]> {
  const articleLinks = extractArticleLinks(html, baseUrl);
  console.log(`Found ${articleLinks.length} article links`);
  
  if (articleLinks.length === 0) {
    // Fallback to generic HTML parsing
    return parseGenericHTML(html, baseUrl);
  }
  
  const items: ParsedItem[] = [];
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  // Limit to first 20 articles to avoid excessive requests
  const linksToScrape = articleLinks.slice(0, 20);
  
  for (const link of linksToScrape) {
    try {
      const article = await scrapeArticle(link, firecrawlApiKey);
      if (article) {
        items.push(article);
      }
    } catch (e) {
      console.error(`Error scraping article ${link}:`, e);
    }
  }
  
  console.log(`Scraped ${items.length} articles`);
  return items;
}

// Extract article links from HTML
function extractArticleLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  
  // Pattern 1: Links inside <article> tags
  const articleBlocks = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];
  for (const block of articleBlocks) {
    const hrefMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
    if (hrefMatch) {
      try {
        const url = new URL(hrefMatch[1], baseUrl).href;
        if (url.startsWith(baseUrlObj.origin)) {
          links.add(url);
        }
      } catch {}
    }
  }
  
  // Pattern 2: Links with common article class names
  const classPatterns = [
    /class="[^"]*(?:post|article|entry|news|blog|story|item)[^"]*"[^>]*href="([^"]+)"/gi,
    /href="([^"]+)"[^>]*class="[^"]*(?:post|article|entry|news|blog|story|item)[^"]*"/gi,
  ];
  
  for (const pattern of classPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const url = new URL(match[1], baseUrl).href;
        if (url.startsWith(baseUrlObj.origin) && url !== baseUrl) {
          links.add(url);
        }
      } catch {}
    }
  }
  
  // Pattern 3: Links with common article URL patterns
  const urlPatterns = /href="(\/(?:post|article|news|blog|story|p|entry|content)\/[^"]+|\/\d{4}\/\d{2}\/[^"]+|\/[^"]*-[^"]*-[^"]*\.html?)"/gi;
  let match;
  while ((match = urlPatterns.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl).href;
      if (url.startsWith(baseUrlObj.origin)) {
        links.add(url);
      }
    } catch {}
  }
  
  // Pattern 4: h2/h3 headings with links inside
  const headingLinks = html.match(/<h[23][^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>/gi) || [];
  for (const headingLink of headingLinks) {
    const hrefMatch = headingLink.match(/href="([^"]+)"/i);
    if (hrefMatch) {
      try {
        const url = new URL(hrefMatch[1], baseUrl).href;
        if (url.startsWith(baseUrlObj.origin) && url !== baseUrl) {
          links.add(url);
        }
      } catch {}
    }
  }
  
  return Array.from(links);
}

// Scrape a single article page
async function scrapeArticle(url: string, firecrawlApiKey?: string): Promise<ParsedItem | null> {
  try {
    if (firecrawlApiKey) {
      // Use Firecrawl for better extraction
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const metadata = data.data.metadata || {};
        return {
          title: metadata.title || metadata.ogTitle || 'Untitled',
          content: data.data.markdown || '',
          url,
          thumbnail: metadata.ogImage || null,
          views: 0,
          likes: 0,
          comments: 0,
          publishedAt: metadata.publishedTime || new Date().toISOString(),
        };
      }
    }
    
    // Fallback: simple HTML fetch
    const html = await fetchHTML(url);
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    
    // Extract main content
    let content = '';
    
    // Try to find article body
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                         html.match(/<div[^>]*class="[^"]*(?:content|article|post-body|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (articleMatch) {
      content = articleMatch[1];
    } else {
      // Fallback to body
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      content = bodyMatch ? bodyMatch[1] : '';
    }
    
    // Clean up content
    content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    content = content.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    content = content.replace(/<aside[\s\S]*?<\/aside>/gi, '');
    content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract image
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const thumbnail = ogImage ? ogImage[1] : null;
    
    // Extract date
    const dateMatch = html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i) ||
                      html.match(/<time[^>]+datetime="([^"]+)"/i) ||
                      html.match(/"datePublished":\s*"([^"]+)"/i);
    const publishedAt = dateMatch ? dateMatch[1] : new Date().toISOString();
    
    return {
      title,
      content: content.substring(0, 10000),
      url,
      thumbnail,
      views: 0,
      likes: 0,
      comments: 0,
      publishedAt,
    };
  } catch (e) {
    console.error(`Failed to scrape article ${url}:`, e);
    return null;
  }
}

async function parseRSS(rssUrl: string, daysBack: number): Promise<ParsedItem[]> {
  const xml = await fetchHTML(rssUrl);
  const items: ParsedItem[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  // Parse RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    
    const title = extractXmlTag(itemXml, 'title');
    const link = extractXmlTag(itemXml, 'link');
    const description = extractXmlTag(itemXml, 'description');
    const content = extractXmlTag(itemXml, 'content:encoded') || description;
    const pubDate = extractXmlTag(itemXml, 'pubDate');
    
    let publishedAt = new Date().toISOString();
    if (pubDate) {
      try {
        publishedAt = new Date(pubDate).toISOString();
      } catch (e) {
        console.error('Error parsing date:', pubDate);
      }
    }
    
    if (new Date(publishedAt) < cutoffDate) continue;
    
    // Extract image
    const imageMatch = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/);
    const mediaMatch = itemXml.match(/<media:content[^>]+url="([^"]+)"/);
    const thumbnail = imageMatch?.[1] || mediaMatch?.[1] || null;
    
    items.push({
      title: title || 'Untitled',
      content: content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '',
      url: link || rssUrl,
      thumbnail,
      views: 0,
      likes: 0,
      comments: 0,
      publishedAt,
    });
  }
  
  // Also try Atom format
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      
      const title = extractXmlTag(entryXml, 'title');
      const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"/);
      const link = linkMatch?.[1];
      const content = extractXmlTag(entryXml, 'content') || extractXmlTag(entryXml, 'summary');
      const published = extractXmlTag(entryXml, 'published') || extractXmlTag(entryXml, 'updated');
      
      let publishedAt = new Date().toISOString();
      if (published) {
        try {
          publishedAt = new Date(published).toISOString();
        } catch (e) {}
      }
      
      if (new Date(publishedAt) < cutoffDate) continue;
      
      items.push({
        title: title || 'Untitled',
        content: content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '',
        url: link || rssUrl,
        thumbnail: null,
        views: 0,
        likes: 0,
        comments: 0,
        publishedAt,
      });
    }
  }
  
  console.log(`Parsed ${items.length} RSS items`);
  return items;
}

function extractXmlTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? (match[1] || match[2])?.trim() : null;
}

function parseGenericHTML(html: string, baseUrl: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const pageTitle = titleMatch ? titleMatch[1] : 'Unknown';
  
  // Try to find article links
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
  let match;
  
  while ((match = articleRegex.exec(html)) !== null) {
    const articleHtml = match[1];
    
    const linkMatch = articleHtml.match(/<a[^>]+href="([^"]+)"[^>]*>/);
    const h2Match = articleHtml.match(/<h[12][^>]*>([^<]+)<\/h[12]>/);
    const pMatch = articleHtml.match(/<p[^>]*>([^<]+)<\/p>/);
    const imgMatch = articleHtml.match(/<img[^>]+src="([^"]+)"/);
    
    if (h2Match || linkMatch) {
      items.push({
        title: h2Match?.[1] || 'Article',
        content: pMatch?.[1] || '',
        url: linkMatch ? new URL(linkMatch[1], baseUrl).href : baseUrl,
        thumbnail: imgMatch ? new URL(imgMatch[1], baseUrl).href : null,
        views: 0,
        likes: 0,
        comments: 0,
        publishedAt: new Date().toISOString(),
      });
    }
  }
  
  // Fallback to single page content
  if (items.length === 0) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    let content = bodyMatch ? bodyMatch[1] : '';
    
    content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
    
    items.push({
      title: pageTitle,
      content: content.substring(0, 5000),
      url: baseUrl,
      thumbnail: ogImage?.[1] || null,
      views: 0,
      likes: 0,
      comments: 0,
      publishedAt: new Date().toISOString(),
    });
  }
  
  return items;
}

// ===================== UTILS =====================

async function fetchHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5,ru;q=0.3',
      'Cache-Control': 'no-cache',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  
  return await response.text();
}

function parseViewCount(str: string): number {
  if (!str) return 0;
  const num = parseFloat(str.replace(/[^\d.,KMБ]/gi, '').replace(',', '.'));
  const upper = str.toUpperCase();
  if (upper.includes('K') || upper.includes('К')) return Math.round(num * 1000);
  if (upper.includes('M') || upper.includes('М')) return Math.round(num * 1000000);
  if (upper.includes('B') || upper.includes('Б')) return Math.round(num * 1000000000);
  return Math.round(num) || 0;
}

function parseRelativeDate(relativeStr: string): string {
  const now = new Date();
  const lower = relativeStr.toLowerCase();
  
  if (lower.includes('час') || lower.includes('hour')) {
    const hours = parseInt(relativeStr) || 1;
    now.setHours(now.getHours() - hours);
  } else if (lower.includes('день') || lower.includes('дня') || lower.includes('дней') || lower.includes('day')) {
    const days = parseInt(relativeStr) || 1;
    now.setDate(now.getDate() - days);
  } else if (lower.includes('недел') || lower.includes('week')) {
    const weeks = parseInt(relativeStr) || 1;
    now.setDate(now.getDate() - weeks * 7);
  } else if (lower.includes('месяц') || lower.includes('month')) {
    const months = parseInt(relativeStr) || 1;
    now.setMonth(now.getMonth() - months);
  } else if (lower.includes('год') || lower.includes('year') || lower.includes('лет')) {
    const years = parseInt(relativeStr) || 1;
    now.setFullYear(now.getFullYear() - years);
  }
  
  return now.toISOString();
}
