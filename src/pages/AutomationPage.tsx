import { ButtonActionsSettings } from '@/components/settings/ButtonActionsSettings';

export function AutomationPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Автоматизация</h2>
      <p className="text-sm text-muted-foreground">
        Управление автоматическими действиями при нажатии кнопок. Отключите процессы, которые не нужно запускать автоматически.
      </p>
      <ButtonActionsSettings />
    </div>
  );
}
