

## Add Voiceover Step to Video Workflow

Currently voiceover generation is embedded inside the `generate-video-heygen` edge function. The user wants it as a separate, visible step in the pipeline — both in the table and side panel.

### Changes

#### 1. Add voiceover status column to `videos` table
New migration adding `voiceover_status` column (values: `pending`, `generating`, `ready`, `error`).

```sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS voiceover_status text DEFAULT 'pending';
```

#### 2. Create `generate-voiceover-for-video` edge function
A dedicated function that:
- Takes `videoId`
- Reads `advisor_answer` text and advisor's `elevenlabs_voice_id`
- Calls ElevenLabs TTS API
- Uploads audio to Supabase Storage (`media-files` bucket)
- Updates `voiceover_url` and `voiceover_status` on the `videos` record

#### 3. Update `VideosTable.tsx`
- Add a new column "Озвучка" between the Cover and Video columns in the table header and rows
- Show voiceover status indicator (dot + label) 
- Add a "Озвучка" button to trigger generation
- When `voiceover_url` exists, show a small play button to preview audio
- Add `voiceover_status` to status configs and labels

#### 4. Update `VideoSidePanel.tsx`
- Add a new "Озвучка" section between "Ответ духовника" and "Обложка"
- Include: generate button, audio player (when URL exists), status selector
- The audio player shows play/pause with the voiceover audio

#### 5. Update `Index.tsx`
- Add `handleGenerateVoiceover(video)` handler that calls the new edge function
- Pass it as `onGenerateVoiceover` prop to both `VideosTable` and `VideoSidePanel`

#### 6. Update `generate-video-heygen` edge function
- Skip voiceover generation if `voiceover_url` already exists on the video
- This is already partially done (it checks `audioUrl || video.voiceover_url`) — just ensure it works correctly with the new flow

#### 7. Update `Video` interface in `useVideos.ts`
- Add `voiceover_status: string | null` field

### Files to modify
- New migration (add `voiceover_status` column)
- New edge function: `supabase/functions/generate-voiceover-for-video/index.ts`
- `src/hooks/useVideos.ts` — add `voiceover_status` to interface
- `src/pages/Index.tsx` — add handler
- `src/components/videos/VideosTable.tsx` — add column
- `src/components/videos/VideoSidePanel.tsx` — add section

