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
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-xl p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              🤖 Assistente IA
            </h1>
            <p className="text-purple-100 text-sm mt-2">Pergunte sobre pendências, atividades, chat e aprenda a usar o sistema</p>
          </div>
        </div>
      </div>

      <Card className="shadow-lg border-purple-200 dark:border-purple-800">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">💬</span> Converse com a IA
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Textarea 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="Exemplos: Quantas pendências existem? Como usar o chat? Como finalizar atividades?" 
                rows={4}
                className="border-2 border-purple-300 dark:border-purple-700 focus:border-purple-600 focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleAsk} 
                disabled={loading || !query.trim()}
                className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white font-semibold shadow-md px-6"
              >
                {loading ? '⏳ Processando...' : '✨ Perguntar'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => { setQuery(''); setAnswer(''); }}
                className="border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                Limpar
              </Button>
            </div>
            {answer && (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/30 dark:to-fuchsia-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-1">🔮</span>
                  <div>
                    <strong className="text-purple-700 dark:text-purple-300">Resposta da IA:</strong>
                    <p className="mt-2 text-foreground">{answer}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <p className="text-sm text-foreground">
            <span className="font-semibold">💡 Dica:</span> Você pode fazer perguntas sobre pendências, atividades, chat, painel admin e tudo mais relacionado ao sistema. A IA responderá com informações relevantes!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AI;
