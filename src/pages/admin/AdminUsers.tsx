import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  Shield,
  Eye,
  Loader2,
  UserCheck,
  UserX,
  Bell,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  approval_status: string;
  created_at: string;
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operador', label: 'Operador' },
  { value: 'operador_12_36_diurno', label: 'Operador 12/36 Diurno' },
  { value: 'operador_12_36_noturno', label: 'Operador 12/36 Noturno' },
];

const AdminUsers: React.FC = () => {
  const { isAdminOrSupervisor, profile: currentProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [editModal, setEditModal] = useState<{
    open: boolean;
    user: Profile | null;
  }>({ open: false, user: null });
  const [editRole, setEditRole] = useState('');
  
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: Profile | null;
  }>({ open: false, user: null });

  useEffect(() => {
    if (!isAdminOrSupervisor) {
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, [isAdminOrSupervisor, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Usuário aprovado',
        description: 'O usuário agora pode acessar o sistema.',
      });
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar o usuário.',
        variant: 'destructive',
      });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'rejected' })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Usuário rejeitado',
        description: 'O acesso do usuário foi negado.',
      });
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível rejeitar o usuário.',
        variant: 'destructive',
      });
    }
  };

  const updateRole = async () => {
    if (!editModal.user || !editRole) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: editRole as any })
        .eq('id', editModal.user.id);

      if (error) throw error;

      toast({
        title: 'Função atualizada',
        description: `O usuário agora é ${ROLES.find(r => r.value === editRole)?.label}.`,
      });
      setEditModal({ open: false, user: null });
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a função.',
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async () => {
    if (!deleteDialog.user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleteDialog.user.id);

      if (error) throw error;

      toast({
        title: 'Usuário excluído',
        description: 'O usuário foi removido do sistema.',
      });
      setDeleteDialog({ open: false, user: null });
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o usuário.',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || user.approval_status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = users.filter(u => u.approval_status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700">Aprovado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pendente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Rejeitado</Badge>;
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
    return <Badge className={colors[role] || 'bg-gray-100 text-gray-700'}>{roleLabel}</Badge>;
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
            <Users className="h-6 w-6" />
            Gerenciar Usuários
          </h1>
          <p className="text-muted-foreground">
            {users.length} usuários cadastrados
          </p>
        </div>
        
        {pendingCount > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Bell className="h-3 w-3" />
            {pendingCount} aguardando aprovação
          </Badge>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
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
        </CardContent>
      </Card>

      {/* Pending Users Alert */}
      {pendingCount > 0 && filterStatus !== 'pending' && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-100 rounded-full">
                <UserCheck className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{pendingCount} usuário(s) aguardando aprovação</p>
                <p className="text-sm text-muted-foreground">
                  Clique para revisar e aprovar os novos cadastros
                </p>
              </div>
              <Button onClick={() => setFilterStatus('pending')}>
                Ver Pendentes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="table-corporate">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Função</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td>{getRoleBadge(user.role)}</td>
                      <td>{getStatusBadge(user.approval_status)}</td>
                      <td className="text-sm text-muted-foreground">
                        {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          {user.approval_status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => approveUser(user.id)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => rejectUser(user.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {isAdmin && user.id !== currentProfile?.id && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditRole(user.role);
                                  setEditModal({ open: true, user });
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteDialog({ open: true, user })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Role Modal */}
      <Dialog open={editModal.open} onOpenChange={(open) => setEditModal({ ...editModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Alterar Função
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Usuário: {editModal.user?.full_name || editModal.user?.email}
            </p>
            <Label>Nova Função</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger className="mt-2">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal({ open: false, user: null })}>
              Cancelar
            </Button>
            <Button onClick={updateRole}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{deleteDialog.user?.full_name || deleteDialog.user?.email}"?
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
    </div>
  );
};

export default AdminUsers;
