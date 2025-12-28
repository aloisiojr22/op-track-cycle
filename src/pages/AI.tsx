import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryAI, type AIResponse } from '@/lib/aiEngine';
import { Send, Loader2, Volume2 } from 'lucide-react';

const RobotIcon = () => (
  <svg className="w-24 h-24 mx-auto mb-4" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    {/* Robot body */}
    <rect x="50" y="70" width="100" height="90" rx="8" fill="#1e3a5f" stroke="#0066cc" strokeWidth="2" />
    
    {/* Robot head */}
    <rect x="60" y="20" width="80" height="60" rx="6" fill="#1e3a5f" stroke="#0066cc" strokeWidth="2" />
    
    {/* Left eye */}
    <circle cx="80" cy="45" r="8" fill="#00ff00" />
    <circle cx="82" cy="43" r="3" fill="#000" />
    
    {/* Right eye */}
    <circle cx="120" cy="45" r="8" fill="#00ff00" />
    <circle cx="122" cy="43" r="3" fill="#000" />
    
    {/* Mouth */}
    <path d="M 85 60 Q 100 68 115 60" stroke="#0066cc" strokeWidth="2" fill="none" />
    
    {/* Left arm */}
    <rect x="20" y="100" width="35" height="15" rx="7" fill="#0066cc" />
    <circle cx="25" cy="107" r="6" fill="#00ff00" />
    
    {/* Right arm */}
    <rect x="145" y="100" width="35" height="15" rx="7" fill="#0066cc" />
    <circle cx="175" cy="107" r="6" fill="#00ff00" />
    
    {/* Antenna */}
    <line x1="100" y1="20" x2="100" y2="0" stroke="#0066cc" strokeWidth="3" />
    <circle cx="100" cy="0" r="5" fill="#0066cc" />
  </svg>
);

interface MessageHistory {
  id: string;
  question: string;
  response: AIResponse;
  timestamp: Date;
}

const AI: React.FC = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MessageHistory[]>([]);
  const [speaking, setSpeaking] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await queryAI(query);
      
      const message: MessageHistory = {
        id: Date.now().toString(),
        question: query,
        response,
        timestamp: new Date(),
      };
      
      setHistory(prev => [message, ...prev]);
      setQuery('');
      
      toast({
        title: 'Resposta obtida',
        description: `Confiança: ${response.confidence}%`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar a consulta.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const speakResponse = (text: string) => {
    if (typeof window === 'undefined') return;
    setSpeaking(true);
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      utterance.onend = () => setSpeaking(false);
      speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis unavailable', e);
      setSpeaking(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-8 text-white shadow-lg border border-slate-700">
        <div className="flex items-center gap-6">
          <RobotIcon />
          <div>
            <h1 className="text-3xl font-bold">Assistente IA</h1>
            <p className="text-slate-300 text-sm mt-2">
              Assistente inteligente para dúvidas sobre o sistema FollowUpCCO. Faça perguntas sobre pendências, atividades, chat, admin, relatórios e mais.
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <Card className="shadow-lg border-slate-700 bg-slate-50 dark:bg-slate-900">
        <CardHeader className="bg-slate-100 dark:bg-slate-800 rounded-t-lg">
          <CardTitle className="text-lg">Faça sua pergunta</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleAsk();
              }}
              placeholder="Exemplos: Como finalizar o dia? Qual é o status de minhas atividades? Como usar o chat privado? Quem pode editar usuários?"
              rows={3}
              className="border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAsk}
                disabled={loading || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md flex-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {loading ? 'Processando...' : 'Enviar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setHistory([]);
                }}
                className="border-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversation History */}
      <div className="space-y-4">
        {history.length === 0 ? (
          <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <CardContent className="pt-6 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">Nenhuma pergunta feita ainda. Digite uma pergunta acima para começar.</p>
            </CardContent>
          </Card>
        ) : (
          history.map((msg) => (
            <div key={msg.id} className="space-y-3">
              {/* Question */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sua pergunta:</p>
                <p className="text-slate-900 dark:text-slate-100 font-medium mt-1">{msg.question}</p>
              </div>

              {/* Response */}
              <Card className="bg-slate-50 dark:bg-slate-900 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-lg">🤖</div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Confiança: {msg.response.confidence}%
                        </span>
                        {msg.response.sources && (
                          <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                            {msg.response.sources[0]}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-900 dark:text-slate-100 leading-relaxed">
                        {msg.response.answer}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => speakResponse(msg.response.answer)}
                      disabled={speaking}
                      className="flex-shrink-0 border-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold">Nota:</span> Este assistente está treinado com informações completas sobre o sistema FollowUpCCO. Faça perguntas específicas para obter respostas melhores. O sistema entende contexto e variações de perguntas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AI;
