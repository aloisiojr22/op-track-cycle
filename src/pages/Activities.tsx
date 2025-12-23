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
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface ActivityData {
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
  date?: string;
}

interface UserActivity {
  activity_id: string;
  activities: ActivityData;
}

interface PendingActivity {
  id: string;
  activityName: string;
  date: string;
  status: string;
  daysOverdue?: number;
}

type ActivityStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'pendente' | 'concluida_com_atraso' | 'plantao' | 'conferencia_mensal';
type PeriodFilter = 'today' | 'week' | 'month';

const COLORS = {
  concluida: 'hsl(142, 71%, 45%)',
  em_andamento: 'hsl(210, 100%, 50%)',
  nao_iniciada: 'hsl(220, 10%, 60%)',
  pendente: 'hsl(38, 92%, 50%)',
  concluida_com_atraso: 'hsl(0, 84%, 60%)',
};

const Activities: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [dailyRecords, setDailyRecords] = useState<Map<string, DailyRecord>>(new Map());
  const [dayStarted, setDayStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    pending: 0,
    late: 0,
  });
  
  // Pending activities summary
  const [pendingActivities, setPendingActivities] = useState<PendingActivity[]>([]);
  
  // Comparison data
  const [comparisonData, setComparisonData] = useState<{
    current: { completed: number; pending: number; rate: number };
    previous: { completed: number; pending: number; rate: number };
  }>({ current: { completed: 0, pending: 0, rate: 0 }, previous: { completed: 0, pending: 0, rate: 0 } });
  
  // Chart data
  const [chartData, setChartData] = useState<any[]>([]);
  
  const [justificationModal, setJustificationModal] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string;
  }>({ open: false, activityId: null, activityName: '' });
  const [justification, setJustification] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const getDateRange = (periodFilter: PeriodFilter, offset: 'current' | 'previous' = 'current') => {
    const now = new Date();
    switch (periodFilter) {
      case 'today': {
        const date = offset === 'current' ? now : new Date(now.getTime() - 86400000);
        return { start: format(date, 'yyyy-MM-dd'), end: format(date, 'yyyy-MM-dd') };
      }
      case 'week': {
        const baseDate = offset === 'current' ? now : subWeeks(now, 1);
        return {
          start: format(startOfWeek(baseDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(baseDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      }
      case 'month': {
        const baseDate = offset === 'current' ? now : subMonths(now, 1);
        return {
          start: format(startOfMonth(baseDate), 'yyyy-MM-dd'),
          end: format(endOfMonth(baseDate), 'yyyy-MM-dd'),
        };
      }
    }
  };

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
      setDayStarted(records && records.length > 0);
      
      // Fetch stats for current period
      const { start, end } = getDateRange(period);
      const { data: periodRecords } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);

      if (periodRecords) {
        setStats({
          total: periodRecords.length,
          completed: periodRecords.filter(r => r.status === 'concluida').length,
          inProgress: periodRecords.filter(r => r.status === 'em_andamento').length,
          notStarted: periodRecords.filter(r => r.status === 'nao_iniciada').length,
          pending: periodRecords.filter(r => r.status === 'pendente').length,
          late: periodRecords.filter(r => r.status === 'concluida_com_atraso').length,
        });

        // Chart data grouped by date
        const grouped = periodRecords.reduce((acc: any, record) => {
          const date = record.date;
          if (!acc[date]) {
            acc[date] = { date, concluida: 0, pendente: 0, em_andamento: 0, nao_iniciada: 0 };
          }
          if (record.status) {
            acc[date][record.status] = (acc[date][record.status] || 0) + 1;
          }
          return acc;
        }, {});
        setChartData(Object.values(grouped));
      }
      
      // Fetch comparison data for previous period
      const prevRange = getDateRange(period, 'previous');
      const { data: prevRecords } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', prevRange.start)
        .lte('date', prevRange.end);

      if (periodRecords && prevRecords) {
        const currentCompleted = periodRecords.filter(r => r.status === 'concluida').length;
        const currentPending = periodRecords.filter(r => r.status === 'pendente').length;
        const currentTotal = periodRecords.length;
        
        const prevCompleted = prevRecords.filter(r => r.status === 'concluida').length;
        const prevPending = prevRecords.filter(r => r.status === 'pendente').length;
        const prevTotal = prevRecords.length;
        
        setComparisonData({
          current: {
            completed: currentCompleted,
            pending: currentPending,
            rate: currentTotal > 0 ? Math.round((currentCompleted / currentTotal) * 100) : 0,
          },
          previous: {
            completed: prevCompleted,
            pending: prevPending,
            rate: prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0,
          },
        });
      }
      
      // Fetch pending/overdue activities
      const { data: pendingData } = await supabase
        .from('daily_records')
        .select(`
          id,
          activity_id,
          status,
          date,
          activities (name)
        `)
        .eq('user_id', user.id)
        .in('status', ['pendente', 'nao_iniciada', 'em_andamento'])
        .order('date', { ascending: true })
        .limit(5);

      if (pendingData) {
        const pending: PendingActivity[] = pendingData.map((item: any) => {
          const activityDate = new Date(item.date + 'T12:00:00');
          const todayDate = new Date();
          const diffTime = todayDate.getTime() - activityDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          return {
            id: item.id,
            activityName: item.activities?.name || 'Atividade',
            date: item.date,
            status: item.status,
            daysOverdue: diffDays > 0 ? diffDays : 0,
          };
        });
        setPendingActivities(pending.filter(p => p.daysOverdue && p.daysOverdue > 0));
      }
      
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
  }, [user, today, period, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startDay = async () => {
    if (!user || userActivities.length === 0) return;
    
    setSaving(true);
    try {
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
      const inProgressRecords = Array.from(dailyRecords.values())
        .filter(r => r.status === 'em_andamento');

      for (const record of inProgressRecords) {
        const { error: insertError } = await supabase.from('pending_items').insert([{
          original_user_id: user.id,
          activity_id: record.activity_id,
          original_date: today,
          justification: record.justification,
          action_taken: record.action_taken,
        }]);

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from('daily_records')
          .update({ status: 'pendente' })
          .eq('id', record.id);

        if (updateError) throw updateError;
      }

      const notStartedWithoutJustification = Array.from(dailyRecords.values())
        .filter(r => r.status === 'nao_iniciada' && !r.justification);

      for (const record of notStartedWithoutJustification) {
        const { error: insertError } = await supabase.from('pending_items').insert([{
          original_user_id: user.id,
          activity_id: record.activity_id,
          original_date: today,
        }]);

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from('daily_records')
          .update({ status: 'pendente' })
          .eq('id', record.id);

        if (updateError) throw updateError;
      }

      toast({
        title: 'Dia Finalizado!',
        description: 'Suas atividades foram salvas. Bom descanso!',
      });
      
      setDayStarted(false);
      setDailyRecords(new Map());
      // Refresh data to reflect persisted changes
      await fetchData();
    } catch (error) {
      console.error('Error ending day:', error);
      toast({
        title: 'Erro',
        description: (error as any)?.message || 'Não foi possível finalizar o dia.',
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
      
      await fetchData();
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
      concluida_com_atraso: 'Com Atraso',
      plantao: 'Plantão',
      conferencia_mensal: 'Conferência',
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      concluida: <CheckCircle2 className="h-3 w-3" />,
      em_andamento: <Clock className="h-3 w-3" />,
      nao_iniciada: <XCircle className="h-3 w-3" />,
      pendente: <AlertTriangle className="h-3 w-3" />,
      concluida_com_atraso: <AlertTriangle className="h-3 w-3" />,
    };
    return icons[status] || null;
  };

  const getAvailableStatuses = (activity: ActivityData): ActivityStatus[] => {
    const baseStatuses: ActivityStatus[] = ['nao_iniciada', 'em_andamento', 'concluida'];
    
    if (activity.is_duty_activity) {
      return [...baseStatuses, 'plantao'];
    }
    
    if (activity.is_monthly_conference) {
      return [...baseStatuses, 'conferencia_mensal'];
    }
    
    return baseStatuses;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return { current: 'Hoje', previous: 'Ontem' };
      case 'week': return { current: 'Esta Semana', previous: 'Semana Passada' };
      case 'month': return { current: 'Este Mês', previous: 'Mês Passado' };
    }
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const rateDiff = comparisonData.current.rate - comparisonData.previous.rate;
  const completedDiff = comparisonData.current.completed - comparisonData.previous.completed;

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
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}!
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="today" className="text-xs px-3 h-7">Hoje</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">Semana</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3 h-7">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {!dayStarted ? (
            <Button onClick={startDay} disabled={saving || userActivities.length === 0} size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
              Iniciar
            </Button>
          ) : (
            <Button onClick={endDay} disabled={saving} size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3 mr-1" />}
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Pending Activities Alert */}
      {pendingActivities.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              Atividades Pendentes/Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="space-y-2">
              {pendingActivities.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      item.status === 'pendente' && "bg-yellow-500",
                      item.status === 'nao_iniciada' && "bg-muted-foreground",
                      item.status === 'em_andamento' && "bg-blue-500"
                    )} />
                    <span className="truncate max-w-[200px]">{item.activityName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{format(new Date(item.date + 'T12:00:00'), 'dd/MM')}</span>
                    {item.daysOverdue && item.daysOverdue > 0 && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">
                        {item.daysOverdue}d atraso
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {pendingActivities.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{pendingActivities.length - 3} outras atividades atrasadas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Concluídas</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-green-500 opacity-50" />
          </div>
          {period !== 'today' && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              {completedDiff > 0 ? (
                <ArrowUp className="h-3 w-3 text-green-500" />
              ) : completedDiff < 0 ? (
                <ArrowDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={cn(
                completedDiff > 0 && "text-green-600",
                completedDiff < 0 && "text-red-600",
                completedDiff === 0 && "text-muted-foreground"
              )}>
                {completedDiff > 0 ? '+' : ''}{completedDiff} vs {getPeriodLabel().previous.toLowerCase()}
              </span>
            </div>
          )}
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            <Clock className="h-6 w-6 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <AlertTriangle className="h-6 w-6 text-yellow-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Taxa</p>
              <p className="text-2xl font-bold text-primary">{completionRate}%</p>
            </div>
            <Target className="h-6 w-6 text-primary opacity-50" />
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionRate}%` }} />
          </div>
          {period !== 'today' && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              {rateDiff > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : rateDiff < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={cn(
                rateDiff > 0 && "text-green-600",
                rateDiff < 0 && "text-red-600",
                rateDiff === 0 && "text-muted-foreground"
              )}>
                {rateDiff > 0 ? '+' : ''}{rateDiff}% vs {getPeriodLabel().previous.toLowerCase()}
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* Activities + Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Activities Section */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Atividades de Hoje
            </h2>
            {dayStarted && (
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {Array.from(dailyRecords.values()).filter(r => r.status === 'concluida').length}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  {Array.from(dailyRecords.values()).filter(r => r.status === 'em_andamento').length}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  {Array.from(dailyRecords.values()).filter(r => r.status === 'nao_iniciada').length}
                </span>
              </div>
            )}
          </div>

          {dayStarted ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {userActivities.map(({ activities: activity, activity_id }) => {
                const record = dailyRecords.get(activity_id);
                const status = record?.status || 'nao_iniciada';
                const availableStatuses = getAvailableStatuses(activity);
                const hasJustification = record?.justification && record.justification.trim().length > 0;

                return (
                  <Card key={activity_id} className={cn(
                    "p-3 relative overflow-hidden",
                    status === 'concluida' && "border-green-500/50",
                    status === 'em_andamento' && "border-blue-500/50",
                    status === 'nao_iniciada' && hasJustification && "border-green-500/50"
                  )}>
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-0.5",
                      status === 'concluida' && "bg-green-500",
                      status === 'em_andamento' && "bg-blue-500",
                      status === 'pendente' && "bg-yellow-500",
                      status === 'nao_iniciada' && !hasJustification && "bg-muted-foreground/30",
                      status === 'nao_iniciada' && hasJustification && "bg-green-500"
                    )} />
                    
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.name}</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1",
                          status === 'concluida' && "bg-green-500/20 text-green-600",
                          status === 'em_andamento' && "bg-blue-500/20 text-blue-600",
                          status === 'pendente' && "bg-yellow-500/20 text-yellow-600",
                          status === 'nao_iniciada' && !hasJustification && "bg-muted text-muted-foreground",
                          status === 'nao_iniciada' && hasJustification && "bg-green-500/20 text-green-600"
                        )}>
                          {getStatusIcon(status)}
                          {getStatusLabel(status)}
                          {status === 'nao_iniciada' && hasJustification && ' ✓'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => openJustificationModal(activity_id, activity.name)}
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                    
                    <Select value={status} onValueChange={(v) => updateStatus(activity_id, v as ActivityStatus)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            <span className="flex items-center gap-1">
                              {getStatusIcon(s)}
                              {getStatusLabel(s)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <Play className="h-10 w-10 text-primary mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground mb-3">
                Clique em "Iniciar" para começar. Você tem <span className="font-medium text-primary">{userActivities.length}</span> atividades.
              </p>
            </Card>
          )}
        </div>

        {/* Charts Section */}
        <div className="space-y-4">
          {/* Performance comparison chart */}
          <Card className="p-3">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Comparativo: {getPeriodLabel().current} vs {getPeriodLabel().previous}
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">{getPeriodLabel().previous}</p>
                <p className="text-lg font-bold">{comparisonData.previous.rate}%</p>
                <p className="text-xs text-muted-foreground">{comparisonData.previous.completed} concluídas</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">{getPeriodLabel().current}</p>
                <p className="text-lg font-bold text-primary">{comparisonData.current.rate}%</p>
                <p className="text-xs text-muted-foreground">{comparisonData.current.completed} concluídas</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              {rateDiff > 0 ? (
                <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                  <ArrowUp className="h-3 w-3 mr-1" />
                  Melhoria de {rateDiff}%
                </Badge>
              ) : rateDiff < 0 ? (
                <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
                  <ArrowDown className="h-3 w-3 mr-1" />
                  Queda de {Math.abs(rateDiff)}%
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Minus className="h-3 w-3 mr-1" />
                  Sem alteração
                </Badge>
              )}
            </div>
          </Card>

          {/* Bar chart */}
          <Card className="p-3">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {getPeriodLabel().current}
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d + 'T12:00:00'), 'dd/MM')} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name) => [value, getStatusLabel(name as string)]} labelFormatter={(d) => format(new Date(d + 'T12:00:00'), 'dd/MM')} />
                  <Bar dataKey="concluida" stackId="a" fill={COLORS.concluida} />
                  <Bar dataKey="em_andamento" stackId="a" fill={COLORS.em_andamento} />
                  <Bar dataKey="pendente" stackId="a" fill={COLORS.pendente} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-xs text-muted-foreground">
                Sem dados
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Justification Modal */}
      <Dialog open={justificationModal.open} onOpenChange={(open) => setJustificationModal({ ...justificationModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Justificativa - {justificationModal.activityName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="justification" className="text-xs">Justificativa</Label>
              <Textarea id="justification" placeholder="Motivo..." value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="action" className="text-xs">Ação Tomada</Label>
              <Textarea id="action" placeholder="Ação..." value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setJustificationModal({ open: false, activityId: null, activityName: '' })}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveJustification}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Activities;
