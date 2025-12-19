import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Play,
  Square,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pencil,
  Loader2,
  Calendar,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Activity {
  id: string;
  name: string;
  is_duty_activity: boolean;
  is_monthly_conference: boolean;
}

interface DailyRecord {
  id: string;
  activity_id: string;
  status: string;
  justification: string | null;
  action_taken: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface UserActivity {
  activity_id: string;
  activities: Activity;
}

type ActivityStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'pendente' | 'concluida_com_atraso' | 'plantao' | 'conferencia_mensal';

const Activities: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [dailyRecords, setDailyRecords] = useState<Map<string, DailyRecord>>(new Map());
  const [dayStarted, setDayStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [justificationModal, setJustificationModal] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string;
  }>({ open: false, activityId: null, activityName: '' });
  const [justification, setJustification] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user's assigned activities
      const { data: assignments, error: assignError } = await supabase
        .from('user_activities')
        .select(`
          activity_id,
          activities (
            id,
            name,
            is_duty_activity,
            is_monthly_conference
          )
        `)
        .eq('user_id', user.id);

      if (assignError) throw assignError;
      
      setUserActivities(assignments as UserActivity[] || []);

      // Fetch today's records
      const { data: records, error: recordsError } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (recordsError) throw recordsError;

      const recordsMap = new Map<string, DailyRecord>();
      records?.forEach(record => {
        recordsMap.set(record.activity_id, record);
      });
      setDailyRecords(recordsMap);
      
      // Check if day has started (any record exists for today)
      setDayStarted(records && records.length > 0);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as atividades.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, today, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startDay = async () => {
    if (!user || userActivities.length === 0) return;
    
    setSaving(true);
    try {
      // Create records for all assigned activities
      const records = userActivities.map(ua => ({
        user_id: user.id,
        activity_id: ua.activity_id,
        date: today,
        status: 'nao_iniciada' as ActivityStatus,
      }));

      const { error } = await supabase
        .from('daily_records')
        .upsert(records, { onConflict: 'user_id,activity_id,date' });

      if (error) throw error;

      toast({
        title: 'Dia Iniciado!',
        description: 'Suas atividades estão prontas para serem executadas.',
      });
      
      await fetchData();
    } catch (error) {
      console.error('Error starting day:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar o dia.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const endDay = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Get all in-progress activities and mark them as pending
      const inProgressRecords = Array.from(dailyRecords.values())
        .filter(r => r.status === 'em_andamento');

      for (const record of inProgressRecords) {
        // Create pending item
        await supabase.from('pending_items').insert({
          original_user_id: user.id,
          activity_id: record.activity_id,
          original_date: today,
          justification: record.justification,
          action_taken: record.action_taken,
        });

        // Update record to pending
        await supabase
          .from('daily_records')
          .update({ status: 'pendente' })
          .eq('id', record.id);
      }

      // Check for not started without justification - mark as pending
      const notStartedWithoutJustification = Array.from(dailyRecords.values())
        .filter(r => r.status === 'nao_iniciada' && !r.justification);

      for (const record of notStartedWithoutJustification) {
        await supabase.from('pending_items').insert({
          original_user_id: user.id,
          activity_id: record.activity_id,
          original_date: today,
        });

        await supabase
          .from('daily_records')
          .update({ status: 'pendente' })
          .eq('id', record.id);
      }

      toast({
        title: 'Dia Finalizado!',
        description: 'Suas atividades foram salvas. Bom descanso!',
      });
      
      // Reset for new day
      setDayStarted(false);
      setDailyRecords(new Map());
    } catch (error) {
      console.error('Error ending day:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível finalizar o dia.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (activityId: string, newStatus: ActivityStatus) => {
    if (!user) return;
    
    const record = dailyRecords.get(activityId);
    if (!record) return;

    try {
      const updateData: Record<string, any> = { status: newStatus };
      
      if (newStatus === 'em_andamento' && !record.started_at) {
        updateData.started_at = new Date().toISOString();
      }
      
      if (newStatus === 'concluida') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('daily_records')
        .update(updateData)
        .eq('id', record.id);

      if (error) throw error;

      // Update local state
      const newRecords = new Map(dailyRecords);
      const updatedRecord: DailyRecord = { 
        ...record, 
        status: newStatus,
        started_at: updateData.started_at || record.started_at,
        completed_at: updateData.completed_at || record.completed_at 
      };
      newRecords.set(activityId, updatedRecord);
      setDailyRecords(newRecords);

      toast({
        title: 'Status atualizado',
        description: `Atividade marcada como ${getStatusLabel(newStatus)}.`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const openJustificationModal = (activityId: string, activityName: string) => {
    const record = dailyRecords.get(activityId);
    setJustification(record?.justification || '');
    setActionTaken(record?.action_taken || '');
    setJustificationModal({ open: true, activityId, activityName });
  };

  const saveJustification = async () => {
    if (!justificationModal.activityId) return;
    
    const record = dailyRecords.get(justificationModal.activityId);
    if (!record) return;

    try {
      const { error } = await supabase
        .from('daily_records')
        .update({
          justification,
          action_taken: actionTaken,
        })
        .eq('id', record.id);

      if (error) throw error;

      // Update local state
      const newRecords = new Map(dailyRecords);
      newRecords.set(justificationModal.activityId, {
        ...record,
        justification,
        action_taken: actionTaken,
      });
      setDailyRecords(newRecords);

      toast({
        title: 'Justificativa salva',
        description: 'A justificativa foi registrada com sucesso.',
      });
      
      setJustificationModal({ open: false, activityId: null, activityName: '' });
    } catch (error) {
      console.error('Error saving justification:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a justificativa.',
        variant: 'destructive',
      });
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      concluida: 'Concluída',
      em_andamento: 'Em Andamento',
      nao_iniciada: 'Não Iniciada',
      pendente: 'Pendente',
      concluida_com_atraso: 'Concluída com Atraso',
      plantao: 'Plantão',
      conferencia_mensal: 'Conferência Mensal',
    };
    return labels[status] || status;
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      concluida: 'status-concluida',
      em_andamento: 'status-em-andamento',
      nao_iniciada: 'status-nao-iniciada',
      pendente: 'status-pendente',
      concluida_com_atraso: 'status-concluida-com-atraso',
      plantao: 'status-plantao',
      conferencia_mensal: 'status-conferencia-mensal',
    };
    return classes[status] || '';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      concluida: <CheckCircle2 className="h-4 w-4" />,
      em_andamento: <Clock className="h-4 w-4" />,
      nao_iniciada: <XCircle className="h-4 w-4" />,
      pendente: <AlertTriangle className="h-4 w-4" />,
      concluida_com_atraso: <AlertTriangle className="h-4 w-4" />,
    };
    return icons[status] || null;
  };

  const getAvailableStatuses = (activity: Activity): ActivityStatus[] => {
    const baseStatuses: ActivityStatus[] = ['nao_iniciada', 'em_andamento', 'concluida'];
    
    if (activity.is_duty_activity) {
      return [...baseStatuses, 'plantao'];
    }
    
    if (activity.is_monthly_conference) {
      return [...baseStatuses, 'conferencia_mensal'];
    }
    
    return baseStatuses;
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile?.approval_status !== 'approved') {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-16 w-16 text-warning" />
        <h2 className="text-xl font-semibold">Aguardando Aprovação</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Sua conta está pendente de aprovação. Aguarde o administrador aprovar seu acesso.
        </p>
      </div>
    );
  }

  if (userActivities.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <Calendar className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Nenhuma Atividade Atribuída</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Você ainda não tem atividades atribuídas. Aguarde o administrador atribuir suas atividades.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minhas Atividades</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        
        {!dayStarted ? (
          <Button
            onClick={startDay}
            disabled={saving}
            className="btn-corporate-success"
            size="lg"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Iniciar Atividades
          </Button>
        ) : (
          <Button
            onClick={endDay}
            disabled={saving}
            className="btn-corporate-danger"
            size="lg"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Square className="mr-2 h-4 w-4" />
            )}
            Finalizar o Dia
          </Button>
        )}
      </div>

      {/* Activities Grid */}
      {dayStarted ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userActivities.map(({ activities: activity, activity_id }) => {
            const record = dailyRecords.get(activity_id);
            const status = record?.status || 'nao_iniciada';
            const availableStatuses = getAvailableStatuses(activity);

            return (
              <Card key={activity_id} className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium leading-tight">
                      {activity.name}
                    </CardTitle>
                    {status === 'nao_iniciada' && (
                      <button
                        onClick={() => openJustificationModal(activity_id, activity.name)}
                        className="p-1 hover:bg-muted rounded"
                        title="Adicionar justificativa"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {(activity.is_duty_activity || activity.is_monthly_conference) && (
                    <div className="flex gap-1 mt-1">
                      {activity.is_duty_activity && (
                        <Badge variant="outline" className="text-xs">Plantão</Badge>
                      )}
                      {activity.is_monthly_conference && (
                        <Badge variant="outline" className="text-xs">Conferência Mensal</Badge>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`status-badge ${getStatusBadgeClass(status)}`}>
                        {getStatusIcon(status)}
                        <span className="ml-1">{getStatusLabel(status)}</span>
                      </span>
                    </div>
                    
                    <Select
                      value={status}
                      onValueChange={(value) => updateStatus(activity_id, value as ActivityStatus)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Alterar status" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {getStatusLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {record?.justification && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <strong>Justificativa:</strong> {record.justification}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-corporate">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Play className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Pronto para começar?</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Clique em "Iniciar Atividades" para começar seu dia de trabalho.
              Você tem {userActivities.length} atividades atribuídas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Justification Modal */}
      <Dialog 
        open={justificationModal.open} 
        onOpenChange={(open) => setJustificationModal({ ...justificationModal, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificativa - {justificationModal.activityName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="justification">Justificativa</Label>
              <Textarea
                id="justification"
                placeholder="Descreva o motivo de não ter iniciado esta atividade..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Ação Tomada</Label>
              <Textarea
                id="action"
                placeholder="Descreva a ação tomada (se houver)..."
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setJustificationModal({ open: false, activityId: null, activityName: '' })}
            >
              Cancelar
            </Button>
            <Button onClick={saveJustification}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Activities;
