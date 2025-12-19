import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

interface Stats {
  totalUsers: number;
  pendingUsers: number;
  totalActivities: number;
  totalPending: number;
  todayCompleted: number;
  todayPending: number;
  weekCompleted: number;
  monthCompleted: number;
}

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(210, 100%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

const AdminDashboard: React.FC = () => {
  const { isAdminOrSupervisor } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingUsers: 0,
    totalActivities: 0,
    totalPending: 0,
    todayCompleted: 0,
    todayPending: 0,
    weekCompleted: 0,
    monthCompleted: 0,
  });
  const [pendingByDay, setPendingByDay] = useState<any[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdminOrSupervisor) {
      navigate('/dashboard');
      return;
    }
    fetchStats();
  }, [isAdminOrSupervisor, navigate]);

  const fetchStats = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    try {
      // Fetch all stats in parallel
      const [
        usersResult,
        pendingUsersResult,
        activitiesResult,
        pendingItemsResult,
        todayRecordsResult,
        weekRecordsResult,
        monthRecordsResult,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('activities').select('*', { count: 'exact', head: true }),
        supabase.from('pending_items').select('*', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('daily_records').select('*').eq('date', today),
        supabase.from('daily_records').select('*').gte('date', weekStart).lte('date', weekEnd),
        supabase.from('daily_records').select('*').gte('date', monthStart).lte('date', monthEnd),
      ]);

      const todayRecords = todayRecordsResult.data || [];
      const weekRecords = weekRecordsResult.data || [];
      const monthRecords = monthRecordsResult.data || [];

      setStats({
        totalUsers: usersResult.count || 0,
        pendingUsers: pendingUsersResult.count || 0,
        totalActivities: activitiesResult.count || 0,
        totalPending: pendingItemsResult.count || 0,
        todayCompleted: todayRecords.filter(r => r.status === 'concluida').length,
        todayPending: todayRecords.filter(r => r.status === 'pendente').length,
        weekCompleted: weekRecords.filter(r => r.status === 'concluida').length,
        monthCompleted: monthRecords.filter(r => r.status === 'concluida').length,
      });

      // Calculate pending by day for last 7 days
      const pendingByDayData: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        pendingByDayData[dateStr] = 0;
      }
      
      const { data: pendingData } = await supabase
        .from('pending_items')
        .select('original_date')
        .gte('original_date', format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
      
      pendingData?.forEach(item => {
        if (pendingByDayData[item.original_date] !== undefined) {
          pendingByDayData[item.original_date]++;
        }
      });

      setPendingByDay(Object.entries(pendingByDayData).map(([date, count]) => ({
        date,
        pendencias: count,
      })));

      // Team performance
      const { data: performanceData } = await supabase
        .from('daily_records')
        .select(`
          user_id,
          status,
          profiles!inner(full_name, email)
        `)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      const userPerformance: Record<string, { name: string; total: number; completed: number; pending: number; late: number }> = {};
      
      performanceData?.forEach((record: any) => {
        const userId = record.user_id;
        const name = record.profiles?.full_name || record.profiles?.email || 'Usuário';
        
        if (!userPerformance[userId]) {
          userPerformance[userId] = { name, total: 0, completed: 0, pending: 0, late: 0 };
        }
        
        userPerformance[userId].total++;
        if (record.status === 'concluida') userPerformance[userId].completed++;
        if (record.status === 'pendente') userPerformance[userId].pending++;
        if (record.status === 'concluida_com_atraso') userPerformance[userId].late++;
      });

      setTeamPerformance(Object.values(userPerformance).sort((a, b) => b.completed - a.completed));
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as estatísticas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground">Visão geral do sistema</p>
        </div>
        <Button onClick={fetchStats} variant="outline">
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="kpi-card kpi-card-primary cursor-pointer" onClick={() => navigate('/admin/users')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
            {stats.pendingUsers > 0 && (
              <Badge variant="destructive" className="mt-2">
                {stats.pendingUsers} pendente(s)
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-success">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Atividades Cadastradas</CardTitle>
            <ClipboardList className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalActivities}</div>
            <p className="text-xs text-muted-foreground mt-1">disponíveis no sistema</p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-warning cursor-pointer" onClick={() => navigate('/pending')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendências</CardTitle>
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalPending}</div>
            <p className="text-xs text-muted-foreground mt-1">aguardando resolução</p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-danger">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.todayCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.todayPending} pendentes hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.todayCompleted}</div>
                <p className="text-xs text-muted-foreground">Concluídas Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{stats.weekCompleted}</div>
                <p className="text-xs text-muted-foreground">Concluídas na Semana</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.monthCompleted}</div>
                <p className="text-xs text-muted-foreground">Concluídas no Mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pendências por Dia (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pendingByDay}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date + 'T12:00:00'), 'dd/MM')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                />
                <Line 
                  type="monotone" 
                  dataKey="pendencias" 
                  stroke="hsl(38, 92%, 50%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(38, 92%, 50%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Desempenho da Equipe (Mês)</CardTitle>
          </CardHeader>
          <CardContent>
            {teamPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamPerformance.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill={COLORS[0]} name="Concluídas" />
                  <Bar dataKey="pending" stackId="a" fill={COLORS[2]} name="Pendentes" />
                  <Bar dataKey="late" stackId="a" fill={COLORS[3]} name="Com Atraso" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/admin/users')}>
              <Users className="mr-2 h-4 w-4" />
              Gerenciar Usuários
            </Button>
            <Button onClick={() => navigate('/admin/activities')} variant="outline">
              <ClipboardList className="mr-2 h-4 w-4" />
              Gerenciar Atividades
            </Button>
            <Button onClick={() => navigate('/admin/reports')} variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              Relatórios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
