import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Users,
  Eye,
  Loader2,
  Filter,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
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
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OperatorStats {
  id: string;
  name: string;
  email: string;
  total: number;
  completed: number;
  pending: number;
  late: number;
  completionRate: number;
  lateRate: number;
}

interface DailyRecord {
  id: string;
  user_id: string;
  activity_id: string;
  date: string;
  status: string;
  justification: string | null;
  activities: { name: string };
  profiles: { full_name: string; email: string };
}

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(210, 100%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

const AdminReports: React.FC = () => {
  const { isAdminOrSupervisor } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [operatorStats, setOperatorStats] = useState<OperatorStats[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [detailModal, setDetailModal] = useState<{ open: boolean; operator: OperatorStats | null }>({ open: false, operator: null });
  const [operatorDetails, setOperatorDetails] = useState<DailyRecord[]>([]);

  useEffect(() => {
    if (!isAdminOrSupervisor) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [isAdminOrSupervisor, navigate, period]);

  const getDateRange = () => {
    const today = new Date();
    let start: Date, end: Date;
    
    switch (period) {
      case 'day':
        start = today;
        end = today;
        break;
      case 'week':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'month':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
    }
    
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  };

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    try {
      const { data: records, error } = await supabase
        .from('daily_records')
        .select(`
          id,
          user_id,
          activity_id,
          date,
          status,
          justification,
          activities (name),
          profiles!inner(full_name, email)
        `)
        .gte('date', start)
        .lte('date', end);

      if (error) throw error;

      // Calculate operator stats
      const statsMap: Record<string, OperatorStats> = {};
      
      records?.forEach((record: any) => {
        const userId = record.user_id;
        const profile = record.profiles;
        
        if (!statsMap[userId]) {
          statsMap[userId] = {
            id: userId,
            name: profile?.full_name || profile?.email || 'Usuário',
            email: profile?.email || '',
            total: 0,
            completed: 0,
            pending: 0,
            late: 0,
            completionRate: 0,
            lateRate: 0,
          };
        }
        
        statsMap[userId].total++;
        if (record.status === 'concluida') statsMap[userId].completed++;
        if (record.status === 'pendente' || (record.status === 'nao_iniciada' && !record.justification)) {
          statsMap[userId].pending++;
        }
        if (record.status === 'concluida_com_atraso') statsMap[userId].late++;
      });

      // Calculate rates
      Object.values(statsMap).forEach(stat => {
        stat.completionRate = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
        stat.lateRate = stat.total > 0 ? Math.round(((stat.pending + stat.late) / stat.total) * 100) : 0;
      });

      const sortedStats = Object.values(statsMap).sort((a, b) => b.completionRate - a.completionRate);
      setOperatorStats(sortedStats);

      // Calculate daily data
      const dailyMap: Record<string, { date: string; concluida: number; pendente: number; em_andamento: number }> = {};
      
      records?.forEach((record: any) => {
        const date = record.date;
        if (!dailyMap[date]) {
          dailyMap[date] = { date, concluida: 0, pendente: 0, em_andamento: 0 };
        }
        if (record.status === 'concluida') dailyMap[date].concluida++;
        if (record.status === 'pendente') dailyMap[date].pendente++;
        if (record.status === 'em_andamento') dailyMap[date].em_andamento++;
      });

      setDailyData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));

      // Calculate status distribution
      const statusMap: Record<string, number> = {};
      records?.forEach((record: any) => {
        statusMap[record.status] = (statusMap[record.status] || 0) + 1;
      });

      const distribution = Object.entries(statusMap).map(([status, count]) => ({
        name: getStatusLabel(status),
        value: count,
        status,
      }));
      setStatusDistribution(distribution);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar os dados.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchOperatorDetails = async (operatorId: string) => {
    const { start, end } = getDateRange();

    try {
      const { data, error } = await supabase
        .from('daily_records')
        .select(`
          id,
          user_id,
          activity_id,
          date,
          status,
          justification,
          activities (name),
          profiles!inner(full_name, email)
        `)
        .eq('user_id', operatorId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });

      if (error) throw error;
      setOperatorDetails(data as DailyRecord[] || []);
    } catch (error) {
      console.error('Error fetching operator details:', error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Email', 'Total', 'Concluídas', 'Pendentes', 'Com Atraso', 'Taxa Conclusão', 'Taxa Atraso'];
    const rows = operatorStats.map(op => [
      op.name,
      op.email,
      op.total,
      op.completed,
      op.pending,
      op.late,
      `${op.completionRate}%`,
      `${op.lateRate}%`,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${period}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({ title: 'Exportado', description: 'Relatório exportado com sucesso.' });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      concluida: 'Concluída',
      em_andamento: 'Em Andamento',
      nao_iniciada: 'Não Iniciada',
      pendente: 'Pendente',
      concluida_com_atraso: 'Com Atraso',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      concluida: COLORS[0],
      em_andamento: COLORS[1],
      pendente: COLORS[2],
      concluida_com_atraso: COLORS[3],
      nao_iniciada: '#9ca3af',
    };
    return colors[status] || '#9ca3af';
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Relatórios e Análises
          </h1>
          <p className="text-muted-foreground">Acompanhe o desempenho da equipe</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoje</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ranking">
        <TabsList>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="daily">Por Dia</TabsTrigger>
        </TabsList>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Operadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="table-corporate">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Operador</th>
                      <th>Total</th>
                      <th>Concluídas</th>
                      <th>Pendentes</th>
                      <th>Taxa Conclusão</th>
                      <th>Taxa Atraso</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {operatorStats.map((op, index) => (
                      <tr key={op.id}>
                        <td>
                          <div className="flex items-center justify-center">
                            {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                            {index === 1 && <Trophy className="h-5 w-5 text-gray-400" />}
                            {index === 2 && <Trophy className="h-5 w-5 text-amber-600" />}
                            {index > 2 && <span>{index + 1}</span>}
                          </div>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium">{op.name}</p>
                            <p className="text-xs text-muted-foreground">{op.email}</p>
                          </div>
                        </td>
                        <td>{op.total}</td>
                        <td className="text-green-600">{op.completed}</td>
                        <td className="text-yellow-600">{op.pending}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${op.completionRate}%` }}
                              />
                            </div>
                            <span className="text-sm">{op.completionRate}%</span>
                          </div>
                        </td>
                        <td>
                          <Badge 
                            variant={op.lateRate > 20 ? 'destructive' : op.lateRate > 10 ? 'default' : 'outline'}
                          >
                            {op.lateRate}%
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDetailModal({ open: true, operator: op });
                              fetchOperatorDetails(op.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Desempenho por Operador</CardTitle>
              </CardHeader>
              <CardContent>
                {operatorStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={operatorStats.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Taxa']} />
                      <Bar dataKey="completionRate" fill={COLORS[0]} name="Conclusão" />
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
        </TabsContent>

        {/* Daily Tab */}
        <TabsContent value="daily" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Atividades por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date + 'T12:00:00'), 'dd/MM')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    />
                    <Legend />
                    <Bar dataKey="concluida" stackId="a" fill={COLORS[0]} name="Concluídas" />
                    <Bar dataKey="em_andamento" stackId="a" fill={COLORS[1]} name="Em Andamento" />
                    <Bar dataKey="pendente" stackId="a" fill={COLORS[2]} name="Pendentes" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={detailModal.open} onOpenChange={(open) => setDetailModal({ ...detailModal, open })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalhes - {detailModal.operator?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {operatorDetails.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{record.activities?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(record.date + 'T12:00:00'), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <Badge className={`
                    ${record.status === 'concluida' ? 'bg-green-100 text-green-700' : ''}
                    ${record.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${record.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' : ''}
                    ${record.status === 'concluida_com_atraso' ? 'bg-red-100 text-red-700' : ''}
                    ${record.status === 'nao_iniciada' ? 'bg-gray-100 text-gray-700' : ''}
                  `}>
                    {getStatusLabel(record.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReports;
