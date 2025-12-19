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
  Eye,
  XCircle,
  X,
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
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

interface OperatorRanking {
  userId: string;
  name: string;
  completed: number;
  completedLate: number;
  pending: number;
  notStarted: number;
  total: number;
  completionRate: number;
}

interface DetailedActivity {
  id: string;
  activityName: string;
  status: string;
  date: string;
  justification?: string;
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
  const [operatorRanking, setOperatorRanking] = useState<OperatorRanking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    operatorName: string;
    activities: DetailedActivity[];
    filterStatus: string | null;
  }>({ open: false, operatorName: '', activities: [], filterStatus: null });

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

      // Pending by day
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

      // Operator ranking with detailed stats
      const { data: rankingData } = await supabase
        .from('daily_records')
        .select(`
          user_id,
          status,
          profiles!inner(id, full_name, email)
        `)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      const userStats: Record<string, OperatorRanking> = {};
      
      rankingData?.forEach((record: any) => {
        const userId = record.user_id;
        const name = record.profiles?.full_name || record.profiles?.email || 'Usuário';
        
        if (!userStats[userId]) {
          userStats[userId] = {
            userId,
            name,
            completed: 0,
            completedLate: 0,
            pending: 0,
            notStarted: 0,
            total: 0,
            completionRate: 0,
          };
        }
        
        userStats[userId].total++;
        if (record.status === 'concluida') userStats[userId].completed++;
        if (record.status === 'concluida_com_atraso') userStats[userId].completedLate++;
        if (record.status === 'pendente') userStats[userId].pending++;
        if (record.status === 'nao_iniciada') userStats[userId].notStarted++;
      });

      // Calculate completion rate
      Object.values(userStats).forEach(user => {
        user.completionRate = user.total > 0 
          ? Math.round(((user.completed + user.completedLate) / user.total) * 100) 
          : 0;
      });

      setOperatorRanking(Object.values(userStats).sort((a, b) => b.completionRate - a.completionRate));
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

  const viewOperatorDetails = async (userId: string, operatorName: string, filterStatus?: string) => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    try {
      const { data } = await supabase
        .from('daily_records')
        .select(`
          id,
          status,
          date,
          justification,
          activities!inner(name)
        `)
        .eq('user_id', userId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });

      let filteredData = data || [];
      if (filterStatus) {
        filteredData = filteredData.filter((r: any) => r.status === filterStatus);
      }

      const activities: DetailedActivity[] = filteredData.map((record: any) => ({
        id: record.id,
        activityName: record.activities?.name || 'Atividade',
        status: record.status,
        date: record.date,
        justification: record.justification,
      }));

      setDetailModal({
        open: true,
        operatorName,
        activities,
        filterStatus: filterStatus || null,
      });
    } catch (error) {
      console.error('Error fetching operator details:', error);
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

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      concluida: 'bg-green-500/20 text-green-500',
      em_andamento: 'bg-blue-500/20 text-blue-500',
      nao_iniciada: 'bg-gray-500/20 text-gray-500',
      pendente: 'bg-yellow-500/20 text-yellow-500',
      concluida_com_atraso: 'bg-orange-500/20 text-orange-500',
    };
    return classes[status] || 'bg-muted text-muted-foreground';
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

      {/* Operator Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ranking de Operadores (Mês Atual)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {operatorRanking.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Concluídas
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4 text-orange-500" />
                        Com Atraso
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Pendentes
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <XCircle className="h-4 w-4 text-gray-500" />
                        Não Iniciadas
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                    <TableHead className="text-center">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operatorRanking.map((operator, index) => (
                    <TableRow key={operator.userId}>
                      <TableCell className="font-bold text-muted-foreground">
                        {index + 1}º
                      </TableCell>
                      <TableCell className="font-medium">{operator.name}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-green-500 hover:text-green-600"
                          onClick={() => viewOperatorDetails(operator.userId, operator.name, 'concluida')}
                        >
                          {operator.completed}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-orange-500 hover:text-orange-600"
                          onClick={() => viewOperatorDetails(operator.userId, operator.name, 'concluida_com_atraso')}
                        >
                          {operator.completedLate}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-yellow-500 hover:text-yellow-600"
                          onClick={() => viewOperatorDetails(operator.userId, operator.name, 'pendente')}
                        >
                          {operator.pending}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-gray-500 hover:text-gray-600"
                          onClick={() => viewOperatorDetails(operator.userId, operator.name, 'nao_iniciada')}
                        >
                          {operator.notStarted}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={operator.completionRate >= 80 ? 'default' : operator.completionRate >= 50 ? 'secondary' : 'destructive'}
                        >
                          {operator.completionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewOperatorDetails(operator.userId, operator.name)}
                          title="Ver todas as atividades"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

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
                  name="Pendências"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Operadores por Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            {operatorRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={operatorRanking.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill={COLORS[0]} name="Concluídas" />
                  <Bar dataKey="completedLate" stackId="a" fill={COLORS[2]} name="Com Atraso" />
                  <Bar dataKey="pending" stackId="a" fill={COLORS[3]} name="Pendentes" />
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

      {/* Detail Modal */}
      <Dialog open={detailModal.open} onOpenChange={(open) => setDetailModal({ ...detailModal, open })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                Atividades de {detailModal.operatorName}
                {detailModal.filterStatus && (
                  <Badge className="ml-2">{getStatusLabel(detailModal.filterStatus)}</Badge>
                )}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {detailModal.activities.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Justificativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailModal.activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">{activity.activityName}</TableCell>
                      <TableCell>{format(new Date(activity.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(activity.status)}`}>
                          {getStatusLabel(activity.status)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {activity.justification || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                Nenhuma atividade encontrada
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
