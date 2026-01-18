import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Volume2, Clock, CheckCircle2 } from 'lucide-react';
import { useVoiceovers } from '@/hooks/useVoiceovers';
import { VoiceoverCard } from '@/components/voiceover/VoiceoverCard';
import { CustomTextVoiceover } from '@/components/voiceover/CustomTextVoiceover';

export default function VoiceoverPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'ready'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    items,
    loading,
    pendingCount,
    readyCount,
    generateElevenLabs,
    saveRecordedAudio,
    uploadAudio,
    deleteVoiceover,
    createVideoFromVoiceover,
    generateFromCustomText,
    saveCustomRecording,
    uploadCustomAudio,
    refetch
  } = useVoiceovers();

  const filteredItems = items.filter(item => {
    // Filter by status
    if (filter === 'pending' && item.voiceover?.status === 'ready') return false;
    if (filter === 'ready' && item.voiceover?.status !== 'ready') return false;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const title = item.parsed_content?.title?.toLowerCase() || '';
      const text = item.rewritten_text?.toLowerCase() || '';
      return title.includes(query) || text.includes(query);
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleGenerateFromCustomText = async (text: string, title: string) => {
    await generateFromCustomText(text, title);
    await refetch();
  };

  const handleSaveCustomRecording = async (text: string, title: string, blob: Blob, duration: number) => {
    await saveCustomRecording(text, title, blob, duration);
    await refetch();
  };

  const handleUploadCustomAudio = async (text: string, title: string, file: File) => {
    await uploadCustomAudio(text, title, file);
    await refetch();
  };

  return (
    <div className="space-y-6">
      {/* Custom Text Voiceover Form */}
      <CustomTextVoiceover
        onGenerateElevenLabs={handleGenerateFromCustomText}
        onSaveRecording={handleSaveCustomRecording}
        onUploadAudio={handleUploadCustomAudio}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
            <Volume2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{items.length}</p>
            <p className="text-sm text-muted-foreground">Всего рерайтов</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-center w-10 h-10 bg-yellow-500/10 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Ожидают озвучки</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-center w-10 h-10 bg-green-500/10 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{readyCount}</p>
            <p className="text-sm text-muted-foreground">Озвучено</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию или тексту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">
              Все ({items.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Ожидают ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="ready">
              Готовы ({readyCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Volume2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? 'Ничего не найдено' : 'Нет рерайтов для озвучки'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery 
              ? 'Попробуйте изменить поисковый запрос'
              : 'Создайте рерайты во вкладке "Рерайт" или добавьте свой текст выше'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <VoiceoverCard
              key={item.id}
              item={item}
              onGenerateElevenLabs={generateElevenLabs}
              onSaveRecording={saveRecordedAudio}
              onUploadAudio={uploadAudio}
              onDelete={deleteVoiceover}
              onCreateVideo={createVideoFromVoiceover}
            />
          ))}
        </div>
      )}
    </div>
  );
}
