import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList,
  Search,
  Plus,
  Trash2,
  Edit2,
  Users,
  Loader2,
  Save,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

interface Activity {
  id: string;
  name: string;
  description: string | null;
  is_duty_activity: boolean;
  is_monthly_conference: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface UserActivity {
  user_id: string;
  activity_id: string;
}

const AdminActivities: React.FC = () => {
  const { isAdminOrSupervisor } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });
  const [assignModal, setAssignModal] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; activity: Activity | null }>({ open: false, activity: null });
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_duty_activity: false,
    is_monthly_conference: false,
  });
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdminOrSupervisor) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [isAdminOrSupervisor, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [activitiesResult, usersResult, assignmentsResult] = await Promise.all([
        supabase.from('activities').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, email').eq('approval_status', 'approved'),
        supabase.from('user_activities').select('user_id, activity_id'),
      ]);

      setActivities(activitiesResult.data || []);
      setUsers(usersResult.data || []);
      setUserActivities(assignmentsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createActivity = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('activities').insert([{
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_duty_activity: formData.is_duty_activity,
        is_monthly_conference: formData.is_monthly_conference,
      }]);

      if (error) throw error;

      toast({ title: 'Atividade criada', description: 'A atividade foi cadastrada com sucesso.' });
      setCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating activity:', error);
      toast({ title: 'Erro', description: 'Não foi possível criar a atividade.', variant: 'destructive' });
    }
  };

  const updateActivity = async () => {
    if (!editModal.activity || !formData.name.trim()) return;

    try {
      const { error } = await supabase
        .from('activities')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          is_duty_activity: formData.is_duty_activity,
          is_monthly_conference: formData.is_monthly_conference,
        })
        .eq('id', editModal.activity.id);

      if (error) throw error;

      toast({ title: 'Atividade atualizada', description: 'As alterações foram salvas.' });
      setEditModal({ open: false, activity: null });
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error updating activity:', error);
      toast({ title: 'Erro', description: 'Não foi possível atualizar a atividade.', variant: 'destructive' });
    }
  };

  const deleteActivity = async () => {
    if (!deleteDialog.activity) return;

    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', deleteDialog.activity.id);

      if (error) throw error;

      toast({ title: 'Atividade excluída', description: 'A atividade foi removida.' });
      setDeleteDialog({ open: false, activity: null });
      fetchData();
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast({ title: 'Erro', description: 'Não foi possível excluir a atividade.', variant: 'destructive' });
    }
  };

  const saveAssignments = async () => {
    if (!assignModal.activity) return;

    try {
      // Remove existing assignments for this activity
      await supabase
        .from('user_activities')
        .delete()
        .eq('activity_id', assignModal.activity.id);

      // Add new assignments
      if (selectedUsers.length > 0) {
        const assignments = selectedUsers.map(userId => ({
          user_id: userId,
          activity_id: assignModal.activity!.id,
        }));

        const { error } = await supabase.from('user_activities').insert(assignments);
        if (error) throw error;
      }

      toast({ title: 'Atribuições salvas', description: 'As atribuições foram atualizadas.' });
      setAssignModal({ open: false, activity: null });
      fetchData();
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar as atribuições.', variant: 'destructive' });
    }
  };

  const openEditModal = (activity: Activity) => {
    setFormData({
      name: activity.name,
      description: activity.description || '',
      is_duty_activity: activity.is_duty_activity,
      is_monthly_conference: activity.is_monthly_conference,
    });
    setEditModal({ open: true, activity });
  };

  const openAssignModal = (activity: Activity) => {
    const assigned = userActivities
      .filter(ua => ua.activity_id === activity.id)
      .map(ua => ua.user_id);
    setSelectedUsers(assigned);
    setAssignModal({ open: true, activity });
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', is_duty_activity: false, is_monthly_conference: false });
  };

  const getAssignedCount = (activityId: string) => {
    return userActivities.filter(ua => ua.activity_id === activityId).length;
  };

  const filteredActivities = activities.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <ClipboardList className="h-6 w-6" />
            Gerenciar Atividades
          </h1>
          <p className="text-muted-foreground">{activities.length} atividades cadastradas</p>
        </div>
        
        <Button onClick={() => { resetForm(); setCreateModal(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Atividade
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atividade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activities Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredActivities.map((activity) => (
          <Card key={activity.id} className="card-hover">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-sm font-medium leading-tight">
                  {activity.name}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openAssignModal(activity)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(activity)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setDeleteDialog({ open: true, activity })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-2">
                {activity.is_duty_activity && (
                  <Badge variant="outline" className="text-xs">Plantão</Badge>
                )}
                {activity.is_monthly_conference && (
                  <Badge variant="outline" className="text-xs">Conferência Mensal</Badge>
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
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredActivities.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma atividade encontrada</h3>
            <p className="text-muted-foreground">Crie uma nova atividade para começar.</p>
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da atividade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da atividade"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="duty"
                checked={formData.is_duty_activity}
                onCheckedChange={(checked) => setFormData({ ...formData, is_duty_activity: checked as boolean })}
              />
              <Label htmlFor="duty">Atividade de Plantão</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="conference"
                checked={formData.is_monthly_conference}
                onCheckedChange={(checked) => setFormData({ ...formData, is_monthly_conference: checked as boolean })}
              />
              <Label htmlFor="conference">Conferência Mensal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancelar</Button>
            <Button onClick={createActivity}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModal.open} onOpenChange={(open) => setEditModal({ ...editModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-duty"
                checked={formData.is_duty_activity}
                onCheckedChange={(checked) => setFormData({ ...formData, is_duty_activity: checked as boolean })}
              />
              <Label htmlFor="edit-duty">Atividade de Plantão</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-conference"
                checked={formData.is_monthly_conference}
                onCheckedChange={(checked) => setFormData({ ...formData, is_monthly_conference: checked as boolean })}
              />
              <Label htmlFor="edit-conference">Conferência Mensal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal({ open: false, activity: null })}>Cancelar</Button>
            <Button onClick={updateActivity}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={assignModal.open} onOpenChange={(open) => setAssignModal({ ...assignModal, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atribuir Operadores</DialogTitle>
            <p className="text-sm text-muted-foreground">{assignModal.activity?.name}</p>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {users.map((user) => (
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
                  <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                    <span className="font-medium">{user.full_name || user.email}</span>
                    {user.full_name && (
                      <span className="text-xs text-muted-foreground ml-2">{user.email}</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal({ open: false, activity: null })}>
              Cancelar
            </Button>
            <Button onClick={saveAssignments}>
              <Save className="mr-2 h-4 w-4" />
              Salvar ({selectedUsers.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Atividade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteDialog.activity?.name}"? Esta ação não pode ser desfeita.
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
    </div>
  );
};

export default AdminActivities;
