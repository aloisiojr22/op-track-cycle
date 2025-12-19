import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Calendar,
  Activity,
  Target,
  Play,
  Square,
  Pencil,
  Loader2,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  date: string;
  activities?: { name: string };
}

interface UserActivity {
  activity_id: string;
  activities: ActivityData;
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

const Dashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    pending: 0,
    late: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Activities state
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [dailyRecords, setDailyRecords] = useState<Map<string, DailyRecord>>(new Map());
  const [dayStarted, setDayStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justificationModal, setJustificationModal] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string;
  }>({ open: false, activityId: null, activityName: '' });
  const [justification, setJustification] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const getDateRange = (periodFilter: PeriodFilter) => {
    const now = new Date();
    switch (periodFilter) {
      case 'today':
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'week':
        return {
          start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          start: format(startOfMonth(now), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { start, end } = getDateRange(period);

    try {
      // Stats
      const { data: records } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);

      if (records) {
        setStats({
          total: records.length,
          completed: records.filter(r => r.status === 'concluida').length,
          inProgress: records.filter(r => r.status === 'em_andamento').length,
          notStarted: records.filter(r => r.status === 'nao_iniciada').length,
          pending: records.filter(r => r.status === 'pendente').length,
          late: records.filter(r => r.status === 'concluida_com_atraso').length,
        });

        // Bar chart data (grouped by date)
        const grouped = records.reduce((acc: any, record) => {
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

        // Pie chart data
        const statusCounts: Record<string, number> = {};
        records.forEach(record => {
          if (record.status) {
            statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
          }
        });
        const pie = Object.entries(statusCounts).map(([status, count]) => ({
          name: getStatusLabel(status),
          value: count,
          status,
        }));
        setPieData(pie);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  const fetchActivities = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data: assignments } = await supabase
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

      setUserActivities(assignments as UserActivity[] || []);

      const { data: records } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      const recordsMap = new Map<string, DailyRecord>();
      records?.forEach(record => {
        recordsMap.set(record.activity_id, record);
      });
      setDailyRecords(recordsMap);
      setDayStarted(records && records.length > 0);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  }, [user, today]);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
    fetchActivities();
  }, [user, fetchDashboardData, fetchActivities]);

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
    if (activity.is_duty_activity) return [...baseStatuses, 'plantao'];
    if (activity.is_monthly_conference) return [...baseStatuses, 'conferencia_mensal'];
    return baseStatuses;
  };

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
      toast({ title: 'Dia Iniciado!', description: 'Suas atividades estão prontas.' });
      await fetchActivities();
      await fetchDashboardData();
    } catch (error) {
      console.error('Error starting day:', error);
      toast({ title: 'Erro', description: 'Não foi possível iniciar o dia.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const endDay = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const inProgressRecords = Array.from(dailyRecords.values()).filter(r => r.status === 'em_andamento');
      for (const record of inProgressRecords) {
        await supabase.from('pending_items').insert({
          original_user_id: user.id,
          activity_id: record.activity_id,
          original_date: today,
          justification: record.justification,
          action_taken: record.action_taken,
        });
        await supabase.from('daily_records').update({ status: 'pendente' }).eq('id', record.id);
      }

      const notStarted = Array.from(dailyRecords.values()).filter(r => r.status === 'nao_iniciada' && !r.justification);
      for (const record of notStarted) {
        await supabase.from('pending_items').insert({
          original_user_id: user.id,
          activity_id: record.activity_id,
          original_date: today,
        });
        await supabase.from('daily_records').update({ status: 'pendente' }).eq('id', record.id);
      }

      toast({ title: 'Dia Finalizado!', description: 'Suas atividades foram salvas.' });
      setDayStarted(false);
      setDailyRecords(new Map());
    } catch (error) {
      console.error('Error ending day:', error);
      toast({ title: 'Erro', description: 'Não foi possível finalizar o dia.', variant: 'destructive' });
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

      const { error } = await supabase.from('daily_records').update(updateData).eq('id', record.id);
      if (error) throw error;

      const newRecords = new Map(dailyRecords);
      newRecords.set(activityId, { ...record, ...updateData });
      setDailyRecords(newRecords);
      await fetchDashboardData();

      toast({ title: 'Status atualizado', description: `Atividade: ${getStatusLabel(newStatus)}.` });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
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
        .update({ justification, action_taken: actionTaken })
        .eq('id', record.id);

      if (error) throw error;

      const newRecords = new Map(dailyRecords);
      newRecords.set(justificationModal.activityId, { ...record, justification, action_taken: actionTaken });
      setDailyRecords(newRecords);
      toast({ title: 'Justificativa salva' });
      setJustificationModal({ open: false, activityId: null, activityName: '' });
    } catch (error) {
      console.error('Error saving justification:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    }
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Hoje';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mês';
    }
  };

  if (profile?.approval_status !== 'approved') {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-16 w-16 text-yellow-500" />
        <h2 className="text-xl font-semibold">Aguardando Aprovação</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Sua conta está pendente de aprovação.
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

                return (
                  <Card key={activity_id} className={cn(
                    "p-3 relative overflow-hidden",
                    status === 'concluida' && "border-green-500/50",
                    status === 'em_andamento' && "border-blue-500/50"
                  )}>
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-0.5",
                      status === 'concluida' && "bg-green-500",
                      status === 'em_andamento' && "bg-blue-500",
                      status === 'pendente' && "bg-yellow-500",
                      status === 'nao_iniciada' && "bg-muted-foreground/30"
                    )} />
                    
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.name}</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1",
                          status === 'concluida' && "bg-green-500/20 text-green-600",
                          status === 'em_andamento' && "bg-blue-500/20 text-blue-600",
                          status === 'pendente' && "bg-yellow-500/20 text-yellow-600",
                          status === 'nao_iniciada' && "bg-muted text-muted-foreground"
                        )}>
                          {getStatusIcon(status)}
                          {getStatusLabel(status)}
                        </span>
                      </div>
                      <button
                        onClick={() => openJustificationModal(activity_id, activity.name)}
                        className="p-1 hover:bg-muted rounded shrink-0"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
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
          <Card className="p-3">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {getPeriodLabel()}
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

          <Card className="p-3">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Distribuição
            </h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={COLORS[entry.status as keyof typeof COLORS] || '#8884d8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Qtd']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-xs text-muted-foreground">
                Sem dados
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[entry.status as keyof typeof COLORS] || '#8884d8' }} />
                  <span>{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
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

export default Dashboard;
