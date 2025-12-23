import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getSupabaseLogs,
  clearSupabaseLogs,
  SupabaseLog,
} from '@/lib/supabaseDebug';
import {
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

const Logs: React.FC = () => {
  const { isAdminOrSupervisor } = useAuth();
  const [logs, setLogs] = useState<SupabaseLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadLogs();
    // Refresh logs every 3 seconds
    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadLogs = () => {
    const allLogs = getSupabaseLogs();
    setLogs(allLogs);
  };

  const handleClear = () => {
    if (confirm('Tem certeza que quer limpar todos os logs?')) {
      clearSupabaseLogs();
      setLogs([]);
    }
  };

  const handleDownload = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLog = (log: SupabaseLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.error?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isAdminOrSupervisor) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-16 w-16 text-warning" />
        <h2 className="text-xl font-semibold">Acesso Negado</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Você não tem permissão para visualizar logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs do Supabase</h1>
          <p className="text-muted-foreground">
            Monitore operações e erros da API em tempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            className="h-8 text-xs"
          >
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-8 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Exportar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClear}
            className="h-8 text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Total de logs: <span className="text-primary font-bold">{filteredLogs.length}</span>
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por operação, tabela..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[600px] w-full rounded-md border p-2">
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">Nenhum log encontrado</p>
                </div>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg border border-muted hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === idx ? null : idx)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {log.error ? (
                          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">
                            {log.operation} {log.table && `(${log.table})`}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {format(
                              new Date(log.timestamp),
                              'HH:mm:ss.SSS',
                              { locale: ptBR }
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={log.error ? 'destructive' : 'secondary'}
                        className="text-[10px] flex-shrink-0"
                      >
                        {log.error ? 'Erro' : 'OK'}
                      </Badge>
                    </div>

                    {expandedId === idx && (
                      <div className="mt-2 p-2 bg-muted rounded text-[10px] space-y-1 font-mono max-h-96 overflow-auto">
                        <div>
                          <p className="font-bold text-muted-foreground">Operação:</p>
                          <p>{log.operation}</p>
                        </div>
                        {log.table && (
                          <div>
                            <p className="font-bold text-muted-foreground">Tabela:</p>
                            <p>{log.table}</p>
                          </div>
                        )}
                        {log.payload && (
                          <div>
                            <p className="font-bold text-muted-foreground">Payload:</p>
                            <pre className="overflow-auto">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.response && (
                          <div>
                            <p className="font-bold text-muted-foreground">Response:</p>
                            <pre className="overflow-auto">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.error && (
                          <div>
                            <p className="font-bold text-red-500">Erro:</p>
                            <p className="text-red-400">
                              {typeof log.error === 'string'
                                ? log.error
                                : JSON.stringify(log.error, null, 2)}
                            </p>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 mt-2 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLog(log);
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Logs;
