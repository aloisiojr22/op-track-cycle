import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Calendar,
  Activity,
  Target,
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
} from 'recharts';

interface DailyRecord {
  id: string;
  status: string;
  date: string;
  activity_id: string;
  activities: {
    name: string;
  };
}

const COLORS = {
  concluida: 'hsl(142, 71%, 45%)',
  em_andamento: 'hsl(210, 100%, 50%)',
  nao_iniciada: 'hsl(220, 10%, 60%)',
  pendente: 'hsl(38, 92%, 50%)',
  concluida_com_atraso: 'hsl(0, 84%, 60%)',
};

const Dashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [todayStats, setTodayStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    pending: 0,
    late: 0,
  });
  const [weekStats, setWeekStats] = useState<any[]>([]);
  const [monthStats, setMonthStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    setLoading(true);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

    try {
      // Today stats
      const { data: todayRecords } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr);

      if (todayRecords) {
        const stats = {
          total: todayRecords.length,
          completed: todayRecords.filter(r => r.status === 'concluida').length,
          inProgress: todayRecords.filter(r => r.status === 'em_andamento').length,
          notStarted: todayRecords.filter(r => r.status === 'nao_iniciada').length,
          pending: todayRecords.filter(r => r.status === 'pendente').length,
          late: todayRecords.filter(r => r.status === 'concluida_com_atraso').length,
        };
        setTodayStats(stats);
      }

      // Week stats
      const { data: weekRecords } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd);

      if (weekRecords) {
        const grouped = weekRecords.reduce((acc: any, record) => {
          const date = record.date;
          if (!acc[date]) {
            acc[date] = { date, concluida: 0, pendente: 0, em_andamento: 0, nao_iniciada: 0 };
          }
          if (record.status) {
            acc[date][record.status] = (acc[date][record.status] || 0) + 1;
          }
          return acc;
        }, {});
        setWeekStats(Object.values(grouped));
      }

      // Month stats - pie chart data
      const { data: monthRecords } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (monthRecords) {
        const statusCounts: Record<string, number> = {};
        monthRecords.forEach(record => {
          if (record.status) {
            statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
          }
        });
        const pieData = Object.entries(statusCounts).map(([status, count]) => ({
          name: getStatusLabel(status),
          value: count,
          status,
        }));
        setMonthStats(pieData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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

  const completionRate = todayStats.total > 0 
    ? Math.round((todayStats.completed / todayStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}!
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="kpi-card kpi-card-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayStats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              de {todayStats.total} atividades
            </p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayStats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">
              atividades em execução
            </p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayStats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              precisam de atenção
            </p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-danger">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <Target className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completionRate}%</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div 
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Bar Chart */}
        <Card className="shadow-corporate">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Atividades da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weekStats}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date + 'T12:00:00'), 'EEE', { locale: ptBR })}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, getStatusLabel(name as string)]}
                    labelFormatter={(date) => format(new Date(date + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                  />
                  <Bar dataKey="concluida" stackId="a" fill={COLORS.concluida} name="concluida" />
                  <Bar dataKey="em_andamento" stackId="a" fill={COLORS.em_andamento} name="em_andamento" />
                  <Bar dataKey="pendente" stackId="a" fill={COLORS.pendente} name="pendente" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Nenhum dado disponível para esta semana
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Pie Chart */}
        <Card className="shadow-corporate">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribuição Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={monthStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {monthStats.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[entry.status as keyof typeof COLORS] || '#8884d8'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Quantidade']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Nenhum dado disponível para este mês
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-corporate">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              className="btn-corporate-primary"
              onClick={() => window.location.href = '/activities'}
            >
              Ver Minhas Atividades
            </Button>
            <Button 
              variant="outline"
              className="btn-corporate-outline"
              onClick={() => window.location.href = '/pending'}
            >
              Ver Pendências
            </Button>
            <Button 
              variant="outline"
              className="btn-corporate-outline"
              onClick={() => window.location.href = '/history'}
            >
              Ver Histórico
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
