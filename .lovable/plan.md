

## Решение: concat-video через n8n + FFmpeg

### Что сделано

Edge Function `concat-video` полностью переписана — убран ~750-строчный MP4 binary parser. Теперь функция:

1. Резолвит свежий HeyGen URL (как раньше)
2. Отправляет POST на `N8N_WEBHOOK_URL` с телом:
   ```json
   {
     "publication_id": "...",
     "main_video_url": "...",
     "back_cover_video_url": "...",
     "output_file_name": "concat/{id}_{ts}.mp4",
     "storage_upload_url": "...",
     "supabase_url": "...",
     "supabase_service_key": "..."
   }
   ```
3. Ожидает ответ с `final_video_url` и обновляет publication

### Что нужно настроить на стороне n8n

Создать workflow:
1. **Webhook** trigger (POST)
2. **Download File** — скачать `main_video_url`
3. **Download File** — скачать `back_cover_video_url`  
4. **Execute Command** (FFmpeg):
   ```bash
   ffmpeg -i main.mp4 -i backcover.mp4 \
     -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" \
     -map "[v]" -map "[a]" -c:v copy -c:a aac -b:a 128k output.mp4
   ```
5. **HTTP Request** — загрузить результат в Supabase Storage через `storage_upload_url`
6. **Respond to Webhook** — вернуть `{ "final_video_url": "public_url" }`
