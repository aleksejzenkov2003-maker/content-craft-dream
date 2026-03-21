import { useAutomationSettings, SINGLE_STEPS, BULK_STEPS } from '@/hooks/useAutomationSettings';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function AutomationPage() {
  const { mode, isLoading } = useAutomationSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const steps = mode === 'bulk' ? BULK_STEPS : SINGLE_STEPS;
  const modeLabel = mode === 'bulk' ? 'Массовый' : 'Единичный';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Автоматизация</h2>
        <Badge variant="secondary">{modeLabel} режим</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Текущий сценарий определяет какие процессы запускаются автоматически. Переключить режим можно в Настройках → Видеоформат.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Кнопка</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Автоматические действия</th>
            </tr>
          </thead>
          <tbody>
            {steps.map(step => (
              <tr key={step.buttonKey} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{step.buttonLabel}</td>
                <td className="px-4 py-3">
                  <ul className="space-y-0.5">
                    {step.processes.map(p => (
                      <li key={p.key} className="text-muted-foreground">— {p.label}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
