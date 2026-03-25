
Проблема сейчас уже не в порядке шагов, а в том, что шаг фона может зависнуть навсегда.

Что я проверил:
- По видео `b7362907-84e8-474e-b177-db09af2a7f37` в базе есть только `overlay_compositing_started`, дальше нет ни `overlay_compositing_complete`, ни `overlay_compositing_failed`.
- В `videos` запись зависла в `reel_status = 'generating'`, а `video_path` и `reduced_video_url` пустые.
- В `src/lib/videoOverlay.ts` у `fetch` уже есть таймаут 60с, но у самого `ff.exec(...)` на шаге композита таймаута нет вообще.
- Наложение сейчас идет в браузере в высоком качестве: 1080x1920, chromakey, alphaextract/erosion/boxblur/alphamerge, `libx264`, `preset slow`, `crf 20`. Это очень тяжелая операция и на слабой машине/в превью может идти очень долго или зависать без завершения.
- В `src/pages/Index.tsx` пайплайн считает шаг запущенным, ставит `reel_status='generating'`, но если overlay завис, дальше уже ничего не произойдет и система не восстановится сама.

Вывод:
- Сейчас главный баг: нет watchdog/таймаута и нет механизма восстановления именно для шага overlay.
- Дополнительно текущая “строгая последовательность” визуально есть, но не хватает явной фиксации текущего этапа и причины зависания.

План исправления

1. Усилить шаг наложения фона
- В `src/lib/videoOverlay.ts` обернуть `ff.exec(...)` в жесткий watchdog-таймаут.
- Если таймаут превышен:
  - прерывать процесс,
  - вызывать `terminateSharedFFmpeg()`,
  - бросать понятную ошибку вроде `Overlay compositing timeout`.
- Добавить сбор последних FFmpeg логов, чтобы в `activity_log` писать не просто “failed”, а причину зависания/последние строки FFmpeg.

2. Сделать overlay отдельным контролируемым этапом
- В `src/pages/Index.tsx` логировать не только `overlay_compositing_started`, но и:
  - `overlay_download_started/complete`,
  - `overlay_ffmpeg_started`,
  - `overlay_upload_started/complete`.
- Так станет видно, где именно зависание: скачивание, сам FFmpeg или загрузка результата.

3. Зафиксировать строгий порядок пайплайна по этапам
- Оставить только последовательность:
  1. HeyGen без фона
  2. Наложение на фон
  3. Битрейт
  4. Субтитры
- В `postProcessVideo` явно хранить текущий этап в локальной переменной и в логах, чтобы следующий шаг не стартовал, пока предыдущий не завершился записью результата.
- Сохранение промежуточного результата оставить после overlay и после bitrate, чтобы при падении следующего шага видео не исчезало.

4. Починить восстановление после зависания
- В auto-resume логике не просто смотреть на `reel_status='generating'`, а учитывать последний action из `activity_log`.
- Если видео висит слишком долго на `overlay_compositing_started` без `complete/failed`, считать шаг сломанным:
  - сбрасывать зависший процесс,
  - либо перезапускать overlay,
  - либо переводить запись в `error` с понятной причиной.
- Это не даст ролику висеть по 23 минуты без конца.

5. Добавить защиту от “вечного generating”
- В `Index.tsx` перед resume проверять возраст последнего шага.
- Если этап фона длится дольше допустимого окна, не держать бесконечно `reel_status='generating'`.
- Обновлять статус на `error` и показывать пользователю понятное уведомление: завис шаг фона, можно перезапустить.

6. Улучшить пользовательскую диагностику
- В UI прогресса показывать не просто “FFmpeg обработка…”, а конкретный этап:
  - Шаг 1/3: наложение фона
  - Скачивание исходников / композитинг / загрузка результата
- Если сработал watchdog, показывать отдельное уведомление, что завис именно шаг наложения, а не субтитры или битрейт.

Технические изменения
- `src/lib/videoOverlay.ts`
  - добавить timeout/watcher вокруг `ff.exec`
  - лог-сбор FFmpeg
  - аварийное завершение через `terminateSharedFFmpeg()`
- `src/pages/Index.tsx`
  - расширить step logging
  - добавить recovery для “overlay started too long ago”
  - сохранить строгую блокировку запуска следующего шага только после успешного завершения предыдущего
- при необходимости использовать уже существующий паттерн таймаута из `videoConcat.ts` как основу для overlay watchdog

Ожидаемый результат после реализации
- Если overlay реально работает — он завершится и только потом пойдут bitrate и subtitles.
- Если overlay завис — процесс не будет висеть бесконечно 23 минуты, а завершится с явной ошибкой и возможностью перезапуска.
- В логах и в интерфейсе будет сразу видно, на каком подшаге сломалось: скачивание, композитинг или upload.

<lov-actions>
<lov-suggestion message="Test the full video pipeline end-to-end and confirm the steps run strictly in order: HeyGen without background, overlay, bitrate, then subtitles.">Verify that it works</lov-suggestion>
<lov-suggestion message="Implement a watchdog timeout and recovery flow for the overlay step so stuck background compositing is aborted and marked as an error instead of hanging forever.">Add overlay watchdog</lov-suggestion>
<lov-suggestion message="Add detailed per-step activity logs for overlay download, FFmpeg compositing, and upload so it is clear exactly where the pipeline hangs.">Improve pipeline logging</lov-suggestion>
<lov-suggestion message="Show the current pipeline phase and subphase in the UI progress banner, including overlay download/compositing/upload states.">Improve progress UI</lov-suggestion>
</lov-actions>
