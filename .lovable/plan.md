

## Fix: Prompt not loading in Publication Edit Dialog

### Root Cause
The `PublicationEditDialog` fetches the prompt template by checking `publication.channel?.post_text_prompt` (a legacy raw text field). However, channels now use a relational `prompt_id` field linking to the `prompts` table. The dialog never reads `prompt_id`, so it finds nothing.

Additionally, the `Publication` interface in `usePublications.ts` doesn't include `prompt_id` in the channel join, so even if the dialog tried to use it, the data wouldn't be available.

### Changes

**1. `src/hooks/usePublications.ts`**
- Add `prompt_id` to the `channel` interface in `Publication`
- Add `prompt_id` to the Supabase select query for `channel:publishing_channels`

**2. `src/components/publishing/PublicationEditDialog.tsx`**
- Update `fetchPrompt` to mirror the priority chain from `generate-post-text` edge function:
  1. If `channel.prompt_id` exists → fetch `system_prompt` + `user_template` from `prompts` table
  2. Else if `channel.post_text_prompt` exists → use that raw text
  3. Else → fetch active `post_text` prompt from DB
- Display both system prompt and filled user template in the Prompt tab so the user sees the full context

