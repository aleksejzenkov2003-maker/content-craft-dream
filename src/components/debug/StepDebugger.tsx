import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Clock, Zap, DollarSign, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  duration_ms: number | null;
  tokens_used: number | null;
  cost_estimate: number | null;
  step_number: number | null;
  created_at: string;
}

interface StepDebuggerProps {
  entityId?: string;
  entityType?: string;
  className?: string;
}

export function StepDebugger({ entityId, entityType, className = '' }: StepDebuggerProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as ActivityLog[]) || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityId, entityType]);

  const toggleStep = (id: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSteps(newExpanded);
  };

  const getActionColor = (action: string) => {
    if (action.includes('error') || action.includes('failed')) return 'destructive';
    if (action.includes('complete') || action.includes('success')) return 'default';
    if (action.includes('start') || action.includes('created')) return 'secondary';
    return 'outline';
  };

  const formatJson = (data: unknown) => {
    if (!data) return null;
    return JSON.stringify(data, null, 2);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Лог операций</CardTitle>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Загрузка...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Нет записей</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Collapsible key={log.id} open={expandedSteps.has(log.id)}>
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger
                      className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleStep(log.id)}
                    >
                      {expandedSteps.has(log.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      
                      <Badge variant={getActionColor(log.action)} className="font-mono text-xs">
                        {log.action}
                      </Badge>
                      
                      <span className="text-sm text-muted-foreground flex-1">
                        {log.entity_type}
                        {log.entity_id && (
                          <span className="text-xs ml-2 font-mono">
                            {log.entity_id.substring(0, 8)}...
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {log.duration_ms && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {log.duration_ms}ms
                          </span>
                        )}
                        {log.tokens_used && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {log.tokens_used}
                          </span>
                        )}
                        {log.cost_estimate && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${log.cost_estimate.toFixed(4)}
                          </span>
                        )}
                        <span>
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-3 pt-0 space-y-3 border-t bg-muted/30">
                        {log.details && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Детали:</p>
                            <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
                              {formatJson(log.details)}
                            </pre>
                          </div>
                        )}
                        
                        {log.input_data && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <span className="text-blue-500">→</span> Входные данные:
                            </p>
                            <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-40">
                              {formatJson(log.input_data)}
                            </pre>
                          </div>
                        )}

                        {log.output_data && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <span className="text-green-500">←</span> Выходные данные:
                            </p>
                            <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-40">
                              {formatJson(log.output_data)}
                            </pre>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          <Button variant="outline" size="sm">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Повторить
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
