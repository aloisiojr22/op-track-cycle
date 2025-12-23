import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  ClipboardList,
  BarChart3,
  Shield,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Bell,
  TrendingUp,
  AlertTriangle,
  Clock,
  Download,
  Filter,
  Trophy,
  Save,
  FileText,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Types
interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  approval_status: string;
  created_at: string;
}

interface Activity {
  id: string;
  name: string;
  description: string | null;
  is_duty_activity: boolean;
  is_monthly_conference: boolean;
  created_at: string;
}

interface UserActivity {
  user_id: string;
  activity_id: string;
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

interface JustificationItem {
  id: string;
  userName: string;
  activityName: string;
  date: string;
  justification: string;
  actionTaken: string | null;
  status: string;
}

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

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operador', label: 'Operador' },
  { value: 'operador_12_36_diurno', label: 'Operador 12/36 Diurno' },
  { value: 'operador_12_36_noturno', label: 'Operador 12/36 Noturno' },
];

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(210, 100%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

const AdminPanel: React.FC = () => {
  const { isAdminOrSupervisor, profile: currentProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Dashboard state
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
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    operatorName: string;
    activities: DetailedActivity[];
    filterStatus: string | null;
  }>({ open: false, operatorName: '', activities: [], filterStatus: null });
  
  // Users state
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editUserModal, setEditUserModal] = useState<{
    open: boolean;
    user: Profile | null;
  }>({ open: false, user: null });
  const [editUserData, setEditUserData] = useState({ full_name: '', email: '', role: '' });
  const [deleteUserDialog, setDeleteUserDialog] = useState<{
    open: boolean;
    user: Profile | null;
  }>({ open: false, user: null });
  
  // Activities state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [createActivityModal, setCreateActivityModal] = useState(false);
  const [editActivityModal, setEditActivityModal] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });
  const [assignModal, setAssignModal] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });
  const [deleteActivityDialog, setDeleteActivityDialog] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });
  const [activityFormData, setActivityFormData] = useState({
    name: '',
    description: '',
    is_duty_activity: false,
    is_monthly_conference: false,
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // Reports state
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [reportStats, setReportStats] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  
  // Justifications state
  const [justifications, setJustifications] = useState<JustificationItem[]>([]);
  const [justificationsLoading, setJustificationsLoading] = useState(false);

  useEffect(() => {
    if (!isAdminOrSupervisor) {
      navigate('/activities');
      return;
    }
    fetchAllData();
  }, [isAdminOrSupervisor, navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchUsers(),
      fetchActivities(),
      fetchJustifications(),
    ]);
    setLoading(false);
  };

  const fetchJustifications = async () => {
    setJustificationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_records')
        .select(`
          id,
          justification,
          action_taken,
          status,
          date,
          profiles!inner(full_name, email),
          activities!inner(name)
        `)
        .not('justification', 'is', null)
        .neq('justification', '')
        .order('date', { ascending: false })
        .limit(100);

      if (error) throw error;

      const items: JustificationItem[] = (data || []).map((record: any) => ({
        id: record.id,
        userName: record.profiles?.full_name || record.profiles?.email || 'Usuário',
        activityName: record.activities?.name || 'Atividade',
        date: record.date,
        justification: record.justification,
        actionTaken: record.action_taken,
        status: record.status,
      }));
      
      setJustifications(items);
    } catch (error) {
      console.error('Error fetching justifications:', error);
    } finally {
      setJustificationsLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
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

      // Operator ranking
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

      Object.values(userStats).forEach(user => {
        user.completionRate = user.total > 0 
          ? Math.round(((user.completed + user.completedLate) / user.total) * 100) 
          : 0;
      });

      setOperatorRanking(Object.values(userStats).sort((a, b) => b.completionRate - a.completionRate));
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const [activitiesResult, usersResult, assignmentsResult] = await Promise.all([
        supabase.from('activities').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, email').eq('approval_status', 'approved'),
        supabase.from('user_activities').select('user_id, activity_id'),
      ]);

      setActivities(activitiesResult.data || []);
      setUserActivities(assignmentsResult.data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  // User actions
  const approveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', userId);

      if (error) throw error;
      toast({ title: 'Usuário aprovado' });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível aprovar.', variant: 'destructive' });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'rejected' })
        .eq('id', userId);

      if (error) throw error;
      toast({ title: 'Usuário rejeitado' });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível rejeitar.', variant: 'destructive' });
    }
  };

  const openEditUserModal = (user: Profile) => {
    setEditUserData({
      full_name: user.full_name || '',
      email: user.email,
      role: user.role,
    });
    setEditUserModal({ open: true, user });
  };

  const saveUserChanges = async () => {
    if (!editUserModal.user) return;

    try {
      const payload: any = {
        full_name: editUserData.full_name.trim() || null,
        role: editUserData.role as any,
      };
      // Update email if changed
      if (editUserData.email && editUserData.email.trim() !== editUserModal.user.email) {
        payload.email = editUserData.email.trim();
      }

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', editUserModal.user.id);

      // If updating current user's email, also update auth user record
      if (editUserModal.user.id === currentProfile?.id && editUserData.email && editUserData.email.trim() !== currentProfile?.email) {
        try {
          // This updates the currently authenticated user's email
          const { data: authData, error: authError } = await supabase.auth.updateUser({ email: editUserData.email.trim() });
          if (authError) {
            console.error('Error updating auth user email:', authError);
            toast({ title: 'Aviso', description: 'Email atualizado no profile, mas não foi possível atualizar no Auth.', variant: 'destructive' });
          } else {
            toast({ title: 'Email atualizado', description: 'Email atualizado no Auth.' });
          }
        } catch (e) {
          console.error('Auth update error:', e);
          toast({ title: 'Aviso', description: 'Email atualizado no profile, mas não foi possível atualizar no Auth.', variant: 'destructive' });
        }
      }

      if (error) throw error;
      toast({ title: 'Usuário atualizado' });
      setEditUserModal({ open: false, user: null });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
    }
  };

  const deleteUser = async () => {
    if (!deleteUserDialog.user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleteUserDialog.user.id);

      if (error) throw error;
      toast({ title: 'Usuário excluído' });
      setDeleteUserDialog({ open: false, user: null });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' });
    }
  };

  // Activity actions
  const createActivity = async () => {
    if (!activityFormData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('activities').insert([{
        name: activityFormData.name.trim(),
        description: activityFormData.description.trim() || null,
        is_duty_activity: activityFormData.is_duty_activity,
        is_monthly_conference: activityFormData.is_monthly_conference,
      }]);

      if (error) throw error;
      toast({ title: 'Atividade criada' });
      setCreateActivityModal(false);
      resetActivityForm();
      fetchActivities();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível criar.', variant: 'destructive' });
    }
  };

  const updateActivity = async () => {
    if (!editActivityModal.activity || !activityFormData.name.trim()) return;

    try {
      const { error } = await supabase
        .from('activities')
        .update({
          name: activityFormData.name.trim(),
          description: activityFormData.description.trim() || null,
          is_duty_activity: activityFormData.is_duty_activity,
          is_monthly_conference: activityFormData.is_monthly_conference,
        })
        .eq('id', editActivityModal.activity.id);

      if (error) throw error;
      toast({ title: 'Atividade atualizada' });
      setEditActivityModal({ open: false, activity: null });
      resetActivityForm();
      fetchActivities();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
    }
  };

  const deleteActivity = async () => {
    if (!deleteActivityDialog.activity) return;

    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', deleteActivityDialog.activity.id);

      if (error) throw error;
      toast({ title: 'Atividade excluída' });
      setDeleteActivityDialog({ open: false, activity: null });
      fetchActivities();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' });
    }
  };

  const saveAssignments = async () => {
    if (!assignModal.activity) return;

    try {
      await supabase
        .from('user_activities')
        .delete()
        .eq('activity_id', assignModal.activity.id);

      if (selectedUsers.length > 0) {
        const assignments = selectedUsers.map(userId => ({
          user_id: userId,
          activity_id: assignModal.activity!.id,
        }));

        const { error } = await supabase.from('user_activities').insert(assignments);
        if (error) throw error;
      }

      toast({ title: 'Atribuições salvas' });
      setAssignModal({ open: false, activity: null });
      fetchActivities();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    }
  };

  const openEditActivityModal = (activity: Activity) => {
    setActivityFormData({
      name: activity.name,
      description: activity.description || '',
      is_duty_activity: activity.is_duty_activity,
      is_monthly_conference: activity.is_monthly_conference,
    });
    setEditActivityModal({ open: true, activity });
  };

  const openAssignModal = (activity: Activity) => {
    const assigned = userActivities
      .filter(ua => ua.activity_id === activity.id)
      .map(ua => ua.user_id);
    setSelectedUsers(assigned);
    setAssignModal({ open: true, activity });
  };

  const resetActivityForm = () => {
    setActivityFormData({ name: '', description: '', is_duty_activity: false, is_monthly_conference: false });
  };

  const getAssignedCount = (activityId: string) => {
    return userActivities.filter(ua => ua.activity_id === activityId).length;
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

  // Helpers
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || user.approval_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredActivities = activities.filter(a => 
    a.name.toLowerCase().includes(activitySearchTerm.toLowerCase())
  );

  const pendingUsersCount = users.filter(u => u.approval_status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 text-xs">Aprovado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pendente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 text-xs">Rejeitado</Badge>;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleLabel = ROLES.find(r => r.value === role)?.label || role;
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      supervisor: 'bg-purple-100 text-purple-700',
      operador: 'bg-blue-100 text-blue-700',
      operador_12_36_diurno: 'bg-yellow-100 text-yellow-700',
      operador_12_36_noturno: 'bg-indigo-100 text-indigo-700',
    };
    return <Badge className={`${colors[role] || 'bg-gray-100 text-gray-700'} text-xs`}>{roleLabel}</Badge>;
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

  const approvedUsers = users.filter(u => u.approval_status === 'approved');

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Painel Administrativo</h1>
        </div>
        <Button onClick={fetchAllData} variant="outline" size="sm">
          Atualizar
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2 text-sm relative">
            <Users className="h-4 w-4" />
            Usuários
            {pendingUsersCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {pendingUsersCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2 text-sm">
            <ClipboardList className="h-4 w-4" />
            Atividades
          </TabsTrigger>
          <TabsTrigger value="justifications" className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            Justificativas
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4" />
            Ranking
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          {/* KPI Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('users')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Usuários Ativos</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
                <Users className="h-5 w-5 text-primary opacity-50" />
              </div>
              {stats.pendingUsers > 0 && (
                <Badge variant="destructive" className="mt-1 text-xs">
                  {stats.pendingUsers} pendente(s)
                </Badge>
              )}
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Atividades</p>
                  <p className="text-2xl font-bold">{stats.totalActivities}</p>
                </div>
                <ClipboardList className="h-5 w-5 text-green-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pending')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pendências</p>
                  <p className="text-2xl font-bold">{stats.totalPending}</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-yellow-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Concluídas Hoje</p>
                  <p className="text-2xl font-bold">{stats.todayCompleted}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500 opacity-50" />
              </div>
            </Card>
          </div>

          {/* Period Stats */}
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xl font-bold">{stats.todayCompleted}</div>
                  <p className="text-xs text-muted-foreground">Concluídas Hoje</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xl font-bold">{stats.weekCompleted}</div>
                  <p className="text-xs text-muted-foreground">Concluídas na Semana</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-xl font-bold">{stats.monthCompleted}</div>
                  <p className="text-xs text-muted-foreground">Concluídas no Mês</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card className="p-3">
            <h3 className="text-sm font-semibold mb-3">Pendências por Dia (Últimos 7 dias)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={pendingByDay}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date + 'T12:00:00'), 'dd/MM')}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
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
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-4">
          {/* Filters */}
          <Card className="p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Pending Alert */}
          {pendingUsersCount > 0 && filterStatus !== 'pending' && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 p-3">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-yellow-600" />
                <span className="text-sm flex-1">{pendingUsersCount} usuário(s) aguardando aprovação</span>
                <Button size="sm" onClick={() => setFilterStatus('pending')}>
                  Ver Pendentes
                </Button>
              </div>
            </Card>
          )}

          {/* Users Table */}
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{user.full_name || 'Sem nome'}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>{getStatusBadge(user.approval_status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {user.approval_status === 'pending' && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-green-600"
                                    onClick={() => approveUser(user.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-red-600"
                                    onClick={() => rejectUser(user.id)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {user.id !== currentProfile?.id && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => openEditUserModal(user)}
                                  title="Editar permissões"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && user.id !== currentProfile?.id && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-600"
                                  onClick={() => setDeleteUserDialog({ open: true, user })}
                                  title="Excluir usuário"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atividade..."
                value={activitySearchTerm}
                onChange={(e) => setActivitySearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button size="sm" onClick={() => { resetActivityForm(); setCreateActivityModal(true); }}>
              <Plus className="mr-1 h-4 w-4" />
              Nova Atividade
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((activity) => (
              <Card key={activity.id} className="p-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-medium leading-tight">{activity.name}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openAssignModal(activity)}
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEditActivityModal(activity)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteActivityDialog({ open: true, activity })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {activity.is_duty_activity && (
                    <Badge variant="outline" className="text-xs">Plantão</Badge>
                  )}
                  {activity.is_monthly_conference && (
                    <Badge variant="outline" className="text-xs">Conferência</Badge>
                  )}
                </div>
                {activity.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {activity.description}
                  </p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {getAssignedCount(activity.id)} operador(es)
                </div>
              </Card>
            ))}
          </div>

          {filteredActivities.length === 0 && (
            <Card className="p-8 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Nenhuma atividade encontrada</h3>
              <p className="text-sm text-muted-foreground">Crie uma nova atividade para começar.</p>
            </Card>
          )}
        </TabsContent>

        {/* Justifications Tab */}
        <TabsContent value="justifications" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Relação de Justificativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {justificationsLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : justifications.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operador</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Justificativa</TableHead>
                        <TableHead>Ação Tomada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {justifications.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.userName}</TableCell>
                          <TableCell className="text-sm">{item.activityName}</TableCell>
                          <TableCell className="text-sm">{format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(item.status)}`}>
                              {getStatusLabel(item.status)}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs text-sm">
                            <p className="line-clamp-2">{item.justification}</p>
                          </TableCell>
                          <TableCell className="max-w-xs text-sm">
                            <p className="line-clamp-2">{item.actionTaken || '-'}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
                  Nenhuma justificativa encontrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
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
                        <TableHead className="text-center">Concluídas</TableHead>
                        <TableHead className="text-center">Com Atraso</TableHead>
                        <TableHead className="text-center">Pendentes</TableHead>
                        <TableHead className="text-center">Não Iniciadas</TableHead>
                        <TableHead className="text-center">Taxa</TableHead>
                        <TableHead className="text-center">Ver</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operatorRanking.map((operator, index) => (
                        <TableRow key={operator.userId}>
                          <TableCell className="font-bold text-muted-foreground text-sm">
                            {index + 1}º
                          </TableCell>
                          <TableCell className="font-medium text-sm">{operator.name}</TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 text-green-500 hover:text-green-600"
                              onClick={() => viewOperatorDetails(operator.userId, operator.name, 'concluida')}
                            >
                              {operator.completed}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 text-orange-500 hover:text-orange-600"
                              onClick={() => viewOperatorDetails(operator.userId, operator.name, 'concluida_com_atraso')}
                            >
                              {operator.completedLate}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 text-yellow-500 hover:text-yellow-600"
                              onClick={() => viewOperatorDetails(operator.userId, operator.name, 'pendente')}
                            >
                              {operator.pending}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 text-gray-500 hover:text-gray-600"
                              onClick={() => viewOperatorDetails(operator.userId, operator.name, 'nao_iniciada')}
                            >
                              {operator.notStarted}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={operator.completionRate >= 80 ? 'default' : operator.completionRate >= 50 ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {operator.completionRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => viewOperatorDetails(operator.userId, operator.name)}
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
                <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 5 Chart */}
          <Card className="p-3">
            <h3 className="text-sm font-semibold mb-3">Top 5 Operadores por Conclusão</h3>
            {operatorRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={operatorRanking.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill={COLORS[0]} name="Concluídas" />
                  <Bar dataKey="completedLate" stackId="a" fill={COLORS[2]} name="Com Atraso" />
                  <Bar dataKey="pending" stackId="a" fill={COLORS[3]} name="Pendentes" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Modal */}
      <Dialog open={editUserModal.open} onOpenChange={(open) => setEditUserModal({ ...editUserModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Edit2 className="h-4 w-4" />
              Editar Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editUserData.full_name}
                onChange={(e) => setEditUserData({ ...editUserData, full_name: e.target.value })}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-sm">Email</Label>
              <Input
                id="edit-email"
                value={editUserData.email}
                onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Função</Label>
              <Select
                value={editUserData.role}
                onValueChange={(v) => setEditUserData({ ...editUserData, role: v })}
                disabled={currentProfile?.role !== 'admin'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentProfile?.role !== 'admin' && (
                <p className="text-xs text-muted-foreground">Somente administradores podem alterar a função.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditUserModal({ open: false, user: null })}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveUserChanges}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteUserDialog.open} onOpenChange={(open) => setDeleteUserDialog({ ...deleteUserDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteUserDialog.user?.full_name || deleteUserDialog.user?.email}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Activity Modal */}
      <Dialog open={createActivityModal} onOpenChange={setCreateActivityModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Nova Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Nome *</Label>
              <Input
                id="name"
                value={activityFormData.name}
                onChange={(e) => setActivityFormData({ ...activityFormData, name: e.target.value })}
                placeholder="Nome da atividade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">Descrição</Label>
              <Textarea
                id="description"
                value={activityFormData.description}
                onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                placeholder="Descrição"
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="duty"
                checked={activityFormData.is_duty_activity}
                onCheckedChange={(checked) => setActivityFormData({ ...activityFormData, is_duty_activity: checked as boolean })}
              />
              <Label htmlFor="duty" className="text-sm">Plantão</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="conference"
                checked={activityFormData.is_monthly_conference}
                onCheckedChange={(checked) => setActivityFormData({ ...activityFormData, is_monthly_conference: checked as boolean })}
              />
              <Label htmlFor="conference" className="text-sm">Conferência Mensal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateActivityModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={createActivity}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Modal */}
      <Dialog open={editActivityModal.open} onOpenChange={(open) => setEditActivityModal({ ...editActivityModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Editar Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-act-name" className="text-sm">Nome *</Label>
              <Input
                id="edit-act-name"
                value={activityFormData.name}
                onChange={(e) => setActivityFormData({ ...activityFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-act-description" className="text-sm">Descrição</Label>
              <Textarea
                id="edit-act-description"
                value={activityFormData.description}
                onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-duty"
                checked={activityFormData.is_duty_activity}
                onCheckedChange={(checked) => setActivityFormData({ ...activityFormData, is_duty_activity: checked as boolean })}
              />
              <Label htmlFor="edit-duty" className="text-sm">Plantão</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-conference"
                checked={activityFormData.is_monthly_conference}
                onCheckedChange={(checked) => setActivityFormData({ ...activityFormData, is_monthly_conference: checked as boolean })}
              />
              <Label htmlFor="edit-conference" className="text-sm">Conferência Mensal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditActivityModal({ open: false, activity: null })}>Cancelar</Button>
            <Button size="sm" onClick={updateActivity}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={assignModal.open} onOpenChange={(open) => setAssignModal({ ...assignModal, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Atribuir Operadores</DialogTitle>
            <p className="text-xs text-muted-foreground">{assignModal.activity?.name}</p>
          </DialogHeader>
          <div className="py-4 max-h-72 overflow-y-auto">
            <div className="space-y-2">
              {approvedUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                  />
                  <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer text-sm">
                    {user.full_name || user.email}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignModal({ open: false, activity: null })}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveAssignments}>
              <Save className="mr-1 h-3 w-3" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Activity Dialog */}
      <AlertDialog open={deleteActivityDialog.open} onOpenChange={(open) => setDeleteActivityDialog({ ...deleteActivityDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Atividade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteActivityDialog.activity?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteActivity} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Modal */}
      <Dialog open={detailModal.open} onOpenChange={(open) => setDetailModal({ ...detailModal, open })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Atividades de {detailModal.operatorName}
              {detailModal.filterStatus && (
                <Badge className="ml-2 text-xs">{getStatusLabel(detailModal.filterStatus)}</Badge>
              )}
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
                      <TableCell className="font-medium text-sm">{activity.activityName}</TableCell>
                      <TableCell className="text-sm">{format(new Date(activity.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(activity.status)}`}>
                          {getStatusLabel(activity.status)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {activity.justification || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
                Nenhuma atividade encontrada
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
