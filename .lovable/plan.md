

## Full Workflow Audit

### Pipeline Overview
```text
Questions → Videos → Voiceover → Cover (Atmosphere→Overlay) → HeyGen Video → Publications (Text + Concat) → Publish
```

### Block-by-Block Status

---

#### 1. Questions (QuestionsTable)
**Status: Working**
- Questions are grouped from `videos` table by `question_id`
- Status change to "Взят в работу" + planned date triggers `triggerAutoGeneration`
- Bulk update status/date works via `bulkUpdateAll`

**Issue found**: `triggerAutoGeneration` (line 418-463) uses `uniqueKey` format `questionId_questionText`, but `onUpdateQuestion` (line 814) passes `parseInt(uniqueKey)` as questionId — this parses only the numeric part correctly, BUT `triggerAutoGeneration` tries to extract the question text after the separator, which won't match since `onUpdateQuestion` passes just the number. Auto-generation may silently fail to find matching videos.

---

#### 2. Videos (VideosTable + useVideos)
**Status: Working**
- CRUD operations, bulk import with auto-creation of advisors/playlists
- Filters by status tabs (В работе / Отработанные / Все)
- Video side panel for detailed editing

---

#### 3. Voiceover Generation
**Status: Working**
- `generate-voiceover-for-video` Edge Function calls ElevenLabs API
- Uses `advisor.elevenlabs_voice_id` with fallback
- Updates `voiceover_url` and `voiceover_status` on video

---

#### 4. Cover Generation (2-step)
**Status: Working**
- **Step 1 (Atmosphere)**: Fetches prompt from `prompts` table (type=`atmosphere`), generates via AI (Lovable gateway → Gemini), then sends to Kie.ai `nano-banana` for image. Saves to `atmosphere_url` + `cover_thumbnails`.
- **Step 2 (Overlay)**: Programmatic compositing via Satori — atmosphere + circular advisor photo + hook text. Saves to `front_cover_url`.

**No issues found** — properly uses `prompts` table for atmosphere prompts.

---

#### 5. Scene Generation
**Status: Working**
- `generate-scene` Edge Function fetches prompt from `prompts` table (type=`scene`)
- Uses Kie.ai `nano-banana-pro` model
- Saves to `playlist_scenes` table

**No issues found** — properly uses `prompts` table for scene prompts.

---

#### 6. HeyGen Video Generation
**Status: Working**
- `generate-video-heygen` Edge Function — uses av4 API
- Requires `voiceover_url` as prerequisite (enforced in UI)
- Image priority: approved scene → `front_cover_url` → `atmosphere_url` → advisor photo
- Polling via `check-video-status` every 12 seconds

---

#### 7. Publications & Text Generation
**Status: Working with gap**
- Publications are created when user publishes video to channels
- Auto text generation via `generate-post-text` Edge Function (Anthropic Claude)
- Auto concat via `concat-video` for channels with back covers

**Issue found**: `generate-post-text` (line 56) reads `post_text_prompt` directly from `publishing_channels` but does NOT use the new `prompt_id` → `prompts` table linkage. If a channel has `prompt_id` set (via the new Prompts page) but no `post_text_prompt` text, it falls back to a generic DB prompt lookup. The `prompt_id` FK on channels is essentially **decorative** — never read by the actual generation logic.

---

#### 8. Back Covers & Concat
**Status: Working**
- Back cover videos stored on `publishing_channels.back_cover_video_url`
- Server-side concat via `concat-video` Edge Function
- Auto-recovery for stuck jobs (>5 min)

---

#### 9. Prompts Page (new)
**Status: Partially working**
- Card grid, edit dialog, channel linking — all functional
- Channel linking updates `prompt_id` on `publishing_channels` — but as noted above, this field is **not consumed** by `generate-post-text`

---

### Summary of Issues Found

| # | Severity | Block | Issue |
|---|----------|-------|-------|
| 1 | **Medium** | Text Generation | `generate-post-text` does not use `prompt_id` from channels — it reads `post_text_prompt` text field directly. New prompt linkage is unused. |
| 2 | **Low** | Auto-generation | `triggerAutoGeneration` may have key format mismatch between Questions table and the auto-trigger logic, potentially preventing auto-generation on status change. |

### Recommended Fixes

**Fix 1 — Make `generate-post-text` use `prompt_id`:**
- When a channel has `prompt_id`, fetch that prompt's `system_prompt` + `user_template` from `prompts` table
- Use as the generation prompt instead of `post_text_prompt` raw text
- Fall back to `post_text_prompt` if no `prompt_id` is set

**Fix 2 — Verify auto-generation key format:**
- Audit `QuestionsTable` to confirm what `uniqueKey` format it passes to `onUpdateQuestion` and `onBulkUpdateStatus`
- Ensure `triggerAutoGeneration` parsing matches

