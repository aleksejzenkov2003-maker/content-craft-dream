

## Диагноз: несовпадение timescale аудио-треков

Логи подтверждают: `Track soun: stsd entries DIFFER (107 vs 107 bytes), merging both`. Оба файла — `mp4a` (AAC), но с разными параметрами (вероятно sample rate: 44100 vs 48000 Hz).

Текущий код делает `mergedStts = [...t1.stts, ...t2.stts]` — просто конкатенирует таблицы таймингов. Но **delta-значения в stts выражены в единицах timescale трека** (из `mdhd`). Если у основного видео timescale=44100, а у обложки timescale=48000, то дельты из обложки интерпретируются неправильно — декодер ищет аудио-семплы не в тех позициях и получает тишину.

Аналогично, `newTrackDuration = t1.duration + t2.duration` складывает значения в разных единицах.

Кроме того, переключение `stsd` entry mid-track ненадёжно в большинстве плееров — лучше привести всё к единому профилю.

## План исправления

### Изменение в `supabase/functions/concat-video/index.ts`

1. **Пересчёт timescale**: при объединении аудио-треков с разным timescale — пересчитать stts-дельты и duration файла 2 в timescale файла 1:
   ```
   ratio = t1.timescale / t2.timescale
   file2_delta_rescaled = Math.round(file2_delta * ratio)
   file2_duration_rescaled = Math.round(t2.duration * ratio)
   ```

2. **Принудительный dedup stsd для аудио**: всегда использовать stsd первого файла для аудио-трека (sdi=1 для обоих). Пересчёт timescale гарантирует, что семплы из файла 2 корректно декодируются с параметрами файла 1.

3. **Диагностическое логирование**: выводить timescale обоих аудио-треков для подтверждения теории.

### Техническая суть

В функции `concatMP4`, в блоке объединения треков (строки ~577-680):

```text
// Для аудио: всегда dedup stsd + rescale timescale
if (t1.handlerType === "soun" && t1.timescale !== t2.timescale) {
  const ratio = t1.timescale / t2.timescale;
  // Пересчитать stts-дельты файла 2
  rescaledStts2 = t2.stts.map(e => ({
    count: e.count,
    delta: Math.round(e.delta * ratio),
  }));
  // Пересчитать длительность
  rescaledDuration2 = Math.round(t2.duration * ratio);
}
// Всегда dedup stsd для аудио (sdi=1 для всех чанков)
```

Также в `mergeStsd`: для `handlerType === "soun"` всегда возвращать только stsd первого файла с `mapSdiFile2: () => 1`, независимо от побайтового совпадения.

