import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AI: React.FC = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    setLoading(true);
    try {
      // Very simple heuristic assistant: if asks about pendências, fetch counts
      const q = query.toLowerCase();
      if (q.includes('pend') || q.includes('pendênc') || q.includes('pendencia')) {
        const { count } = await supabase
          .from('pending_items')
          .select('*', { count: 'exact', head: true })
          .eq('resolved', false);
        setAnswer(`Atualmente existem ${count || 0} pendência(s) não resolvidas.`);
      } else if (q.includes('como usar') || q.includes('ajuda')) {
        setAnswer('Este assistente pode responder perguntas rápidas sobre o sistema e retornar contagens. Pergunte por pendências, chat ou atividades.');
      } else {
        setAnswer('Desculpe, não entendi completamente. Tente perguntar sobre pendências, atividades ou chat.');
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível processar a consulta.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assistente IA</h1>
          <p className="text-sm text-muted-foreground">Faça perguntas rápidas ao sistema (pendências, uso, chat).</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Converse com a IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pergunte algo (ex: quantas pendências existem?)" rows={4} />
            <div className="flex gap-2">
              <Button onClick={handleAsk} disabled={loading || !query.trim()}>
                {loading ? 'Aguarde...' : 'Perguntar'}
              </Button>
              <Button variant="outline" onClick={() => { setQuery(''); setAnswer(''); }}>Limpar</Button>
            </div>
            {answer && (
              <div className="p-3 bg-muted/30 rounded">
                <strong>Resposta:</strong>
                <p className="mt-2">{answer}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AI;
