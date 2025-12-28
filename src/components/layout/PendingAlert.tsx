import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Volume2 } from 'lucide-react';

interface PendingAlertProps {
  pendingCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGotoPending: () => void;
}

export const PendingAlert: React.FC<PendingAlertProps> = ({
  pendingCount,
  open,
  onOpenChange,
  onGotoPending,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (open && pendingCount > 0) {
      speakAlert();
    }
  }, [open, pendingCount]);

  const speakAlert = () => {
    if (typeof window === 'undefined') return;
    setIsSpeaking(true);
    try {
      const msg = `Atenção! Você tem ${pendingCount} pendência${pendingCount > 1 ? 's' : ''} no sistema. Acesse a aba de pendências para resolver.`;
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis unavailable', e);
      setIsSpeaking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-red-300 dark:border-red-800">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-lg text-red-700 dark:text-red-400">
                Pendências Encontradas
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <DialogDescription className="text-base text-slate-700 dark:text-slate-300">
          Você tem <strong>{pendingCount} pendência{pendingCount > 1 ? 's' : ''}</strong> aguardando resolução no sistema.
        </DialogDescription>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 my-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Clique em <strong>"Ver Pendências"</strong> para visualizar e resolver as atividades pendentes, ou <strong>"Fechar"</strong> para continuar navegando.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Fechar
          </Button>
          <Button
            onClick={() => {
              onGotoPending();
              onOpenChange(false);
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Ver Pendências
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={speakAlert}
            disabled={isSpeaking}
            className="ml-auto"
          >
            <Volume2 className="h-4 w-4 mr-1" />
            {isSpeaking ? 'Falando...' : 'Ouvir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
