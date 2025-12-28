import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseLog } from '@/lib/supabaseDebug';
import {
  AlertTriangle,
  User,
  Calendar,
  CheckCircle2,
  Plus,
  Loader2,
  Mail,
  Image,
  FileText,
  AlertCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PendingItem {
  id: string;
  original_user_id: string;
  assigned_user_id: string | null;
  activity_id: string | null;
  description: string | null;
  justification: string | null;
  action_taken: string | null;
  request_type: string | null;
  is_special_request: boolean;
  resolved: boolean;
  original_date: string;
  created_at: string;
  activities: {
    name: string;
  } | null;
  original_user: {
    full_name: string;
    email: string;
  };
  assigned_user: {
    full_name: string;
    email: string;
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

const REQUEST_TYPES = [
  { value: 'solicitacao_email', label: 'Solicitação de E-mail', icon: Mail },
  { value: 'requisicao_imagem', label: 'Requisição de Imagem', icon: Image },
  { value: 'rdo_pendente', label: 'RDO Pendente', icon: FileText },
  { value: 'sonolencia_fadiga', label: 'Sonolência e Fadiga', icon: AlertCircle },
];

const Pending: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    itemId: string | null;
  }>({ open: false, itemId: null });
  const [selectedUser, setSelectedUser] = useState<string>('');
  
  const [resolveModal, setResolveModal] = useState<{
    open: boolean;
    item: PendingItem | null;
  }>({ open: false, item: null });
  const [resolveJustification, setResolveJustification] = useState('');
  const [resolveAction, setResolveAction] = useState('');

  const [newRequestModal, setNewRequestModal] = useState(false);
  const [newRequestType, setNewRequestType] = useState<string>('');
  const [newRequestDescription, setNewRequestDescription] = useState('');
  const [newRequestAction, setNewRequestAction] = useState('');

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('pending-items-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_items' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch pending items
      const { data: items, error } = await supabase
        .from('pending_items')
        .select(`
          *,
          activities (name),
          original_user:profiles!pending_items_original_user_id_fkey (full_name, email),
          assigned_user:profiles!pending_items_assigned_user_id_fkey (full_name, email)
        `)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingItems(items as PendingItem[] || []);

      // Fetch users for assignment
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('approval_status', 'approved');

      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching pending items:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignToUser = async () => {
    if (!assignModal.itemId || !selectedUser) return;

    try {
      const payload = { assigned_user_id: selectedUser };
      const { error, data } = await supabase
        .from('pending_items')
        .update(payload)
        .select('*')
        .eq('id', assignModal.itemId);
      createSupabaseLog('update', 'pending_items', { id: assignModal.itemId, ...payload }, data, error);
      if (error) throw error;

      toast({
        title: 'Atribuído com sucesso',
        description: 'A pendência foi atribuída ao usuário.',
      });
      
      setAssignModal({ open: false, itemId: null });
      setSelectedUser('');
      // If the pending item is related to an activity, create a daily_record for the assigned user
      const updatedItem = (data && (data as any)[0]) || null;
      if (updatedItem && updatedItem.activity_id) {
        const dr = {
          user_id: selectedUser,
          activity_id: updatedItem.activity_id,
          date: updatedItem.original_date || format(new Date(), 'yyyy-MM-dd'),
          status: 'nao_iniciada',
        };
        const { error: drError } = await supabase
          .from('daily_records')
          .upsert(dr, { onConflict: 'user_id,activity_id,date' });
        createSupabaseLog('upsert', 'daily_records', dr, null, drError);
      }

      fetchData();
    } catch (error) {
      console.error('Error assigning item:', error);
      toast({
        title: 'Erro',
        description: (error as any)?.message || 'Não foi possível atribuir a pendência.',
        variant: 'destructive',
      });
    }
  };

  const assignToMe = async (itemId: string) => {
    if (!user) return;

    try {
      const payload = { assigned_user_id: user.id };
      const { error, data } = await supabase
        .from('pending_items')
        .update(payload)
        .select('*')
        .eq('id', itemId);
      createSupabaseLog('update', 'pending_items', { id: itemId, ...payload }, data, error);
      if (error) throw error;

      toast({
        title: 'Atribuído a você',
        description: 'Você assumiu esta pendência.',
      });
      
      // Create daily_record for this user if related to an activity
      const updatedItem = (data && (data as any)[0]) || null;
      if (updatedItem && updatedItem.activity_id) {
        const dr = {
          user_id: user.id,
          activity_id: updatedItem.activity_id,
          date: updatedItem.original_date || format(new Date(), 'yyyy-MM-dd'),
          status: 'nao_iniciada',
        };
        const { error: drError } = await supabase
          .from('daily_records')
          .upsert(dr, { onConflict: 'user_id,activity_id,date' });
        createSupabaseLog('upsert', 'daily_records', dr, null, drError);
      }

      fetchData();
    } catch (error) {
      console.error('Error assigning item:', error);
      toast({
        title: 'Erro',
          description: (error as any)?.message || 'Não foi possível atribuir a pendência.',
        variant: 'destructive',
      });
    }
  };

  const resolveItem = async () => {
    if (!resolveModal.item) return;

    try {
      const payload = {
        resolved: true,
        resolved_at: new Date().toISOString(),
        justification: resolveJustification || resolveModal.item.justification,
        action_taken: resolveAction || resolveModal.item.action_taken,
      };
      const { error, data } = await supabase
        .from('pending_items')
        .update(payload)
        .eq('id', resolveModal.item.id);
      createSupabaseLog('update', 'pending_items', { id: resolveModal.item.id, ...payload }, data, error);
      if (error) throw error;

      // If it's an activity pending item, update the daily record
      if (resolveModal.item.activity_id) {
        await supabase
          .from('daily_records')
          .update({ status: 'concluida_com_atraso' })
          .eq('activity_id', resolveModal.item.activity_id)
          .eq('user_id', resolveModal.item.original_user_id)
          .eq('date', resolveModal.item.original_date);
      }

      toast({
        title: 'Resolvido!',
        description: 'A pendência foi marcada como resolvida.',
      });
      
      setResolveModal({ open: false, item: null });
      setResolveJustification('');
      setResolveAction('');
      fetchData();
    } catch (error) {
      console.error('Error resolving item:', error);
      toast({
        title: 'Erro',
          description: (error as any)?.message || 'Não foi possível resolver a pendência.',
        variant: 'destructive',
      });
    }
  };

  const createSpecialRequest = async () => {
    if (!user || !newRequestType) return;

    try {
      const payload = [{
        original_user_id: user.id,
        request_type: newRequestType as any,
        is_special_request: true,
        description: newRequestDescription,
        action_taken: newRequestAction,
        original_date: format(new Date(), 'yyyy-MM-dd'),
      }];
      const { error, data } = await supabase
        .from('pending_items')
        .insert(payload);
      createSupabaseLog('insert', 'pending_items', payload, data, error);
      if (error) throw error;

      toast({
        title: 'Solicitação criada',
        description: 'A solicitação especial foi criada com sucesso.',
      });
      
      setNewRequestModal(false);
      setNewRequestType('');
      setNewRequestDescription('');
      setNewRequestAction('');
      fetchData();
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: 'Erro',
          description: (error as any)?.message || 'Não foi possível criar a solicitação.',
        variant: 'destructive',
      });
    }
  };

  const getRequestTypeLabel = (type: string | null) => {
    const found = REQUEST_TYPES.find(t => t.value === type);
    return found?.label || 'Pendência';
  };

  const getRequestTypeIcon = (type: string | null) => {
    const found = REQUEST_TYPES.find(t => t.value === type);
    return found?.icon || AlertTriangle;
  };

  const activityPendingItems = pendingItems.filter(item => !item.is_special_request);
  const specialRequests = pendingItems.filter(item => item.is_special_request);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header - Enhanced */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-8 text-white shadow-lg border border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Pendências e Solicitações
            </h1>
            <p className="text-slate-300 text-sm mt-2">
              Gerencie atividades pendentes e solicitações especiais
            </p>
          </div>
          
          <Button
            onClick={() => setNewRequestModal(true)}
            className="bg-white text-slate-800 hover:bg-slate-100 font-semibold shadow-md"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nova Solicitação
          </Button>
        </div>
      </div>

      {/* Stats - Enhanced */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-700 hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-600/20 p-3 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-700">{pendingItems.length}</div>
                <p className="text-xs text-yellow-600 font-medium">Total de Pendências</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-700 hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-3 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">{activityPendingItems.length}</div>
                <p className="text-xs text-blue-600 font-medium">Atividades Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700 hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600/20 p-3 rounded-lg">
                <Mail className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-700">{specialRequests.length}</div>
                <p className="text-xs text-purple-600 font-medium">Solicitações Especiais</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Todas ({pendingItems.length})</TabsTrigger>
          <TabsTrigger value="activities">Atividades ({activityPendingItems.length})</TabsTrigger>
          <TabsTrigger value="requests">Solicitações ({specialRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <PendingList
            items={pendingItems}
            users={users}
            user={user}
            onAssign={(id) => setAssignModal({ open: true, itemId: id })}
            onAssignToMe={assignToMe}
            onResolve={(item) => setResolveModal({ open: true, item })}
            getRequestTypeLabel={getRequestTypeLabel}
            getRequestTypeIcon={getRequestTypeIcon}
          />
        </TabsContent>

        <TabsContent value="activities" className="mt-6">
          <PendingList
            items={activityPendingItems}
            users={users}
            user={user}
            onAssign={(id) => setAssignModal({ open: true, itemId: id })}
            onAssignToMe={assignToMe}
            onResolve={(item) => setResolveModal({ open: true, item })}
            getRequestTypeLabel={getRequestTypeLabel}
            getRequestTypeIcon={getRequestTypeIcon}
          />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <PendingList
            items={specialRequests}
            users={users}
            user={user}
            onAssign={(id) => setAssignModal({ open: true, itemId: id })}
            onAssignToMe={assignToMe}
            onResolve={(item) => setResolveModal({ open: true, item })}
            getRequestTypeLabel={getRequestTypeLabel}
            getRequestTypeIcon={getRequestTypeIcon}
          />
        </TabsContent>
      </Tabs>

      {/* Assign Modal */}
      <Dialog open={assignModal.open} onOpenChange={(open) => setAssignModal({ ...assignModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Pendência</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Selecione o Usuário</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal({ open: false, itemId: null })}>
              Cancelar
            </Button>
            <Button onClick={assignToUser} disabled={!selectedUser}>
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Modal */}
      <Dialog open={resolveModal.open} onOpenChange={(open) => setResolveModal({ ...resolveModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Pendência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Justificativa</Label>
              <Textarea
                className="mt-2"
                placeholder="Descreva a justificativa..."
                value={resolveJustification}
                onChange={(e) => setResolveJustification(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Ação Tomada</Label>
              <Textarea
                className="mt-2"
                placeholder="Descreva a ação tomada..."
                value={resolveAction}
                onChange={(e) => setResolveAction(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveModal({ open: false, item: null })}>
              Cancelar
            </Button>
            <Button onClick={resolveItem} className="btn-corporate-success">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Marcar como Resolvido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Request Modal */}
      <Dialog open={newRequestModal} onOpenChange={setNewRequestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Solicitação Especial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo de Solicitação</Label>
              <Select value={newRequestType} onValueChange={setNewRequestType}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                className="mt-2"
                placeholder="Descreva a solicitação..."
                value={newRequestDescription}
                onChange={(e) => setNewRequestDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Ação Tomada</Label>
              <Textarea
                className="mt-2"
                placeholder="Descreva a ação tomada (se houver)..."
                value={newRequestAction}
                onChange={(e) => setNewRequestAction(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRequestModal(false)}>
              Cancelar
            </Button>
            <Button onClick={createSpecialRequest} disabled={!newRequestType}>
              Criar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Pending List Component
interface PendingListProps {
  items: PendingItem[];
  users: Profile[];
  user: any;
  onAssign: (id: string) => void;
  onAssignToMe: (id: string) => void;
  onResolve: (item: PendingItem) => void;
  getRequestTypeLabel: (type: string | null) => string;
  getRequestTypeIcon: (type: string | null) => any;
}

const PendingList: React.FC<PendingListProps> = ({
  items,
  users,
  user,
  onAssign,
  onAssignToMe,
  onResolve,
  getRequestTypeLabel,
  getRequestTypeIcon,
}) => {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Tudo em dia!</h3>
          <p className="text-muted-foreground text-center">
            Não há pendências no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const Icon = getRequestTypeIcon(item.request_type);
        return (
          <Card key={item.id} className="card-hover">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-warning" />
                    <h3 className="font-medium">
                      {item.is_special_request
                        ? getRequestTypeLabel(item.request_type)
                        : item.activities?.name || 'Atividade'}
                    </h3>
                    {item.is_special_request && (
                      <Badge variant="outline">Solicitação</Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {item.original_user?.full_name || 'Usuário'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(item.original_date + 'T12:00:00'), 'dd/MM/yyyy')}
                    </span>
                    {item.assigned_user && (
                      <Badge className="bg-primary/10 text-primary">
                        Atribuído a: {item.assigned_user.full_name}
                      </Badge>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                      {item.description}
                    </p>
                  )}

                  {item.justification && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Justificativa:</strong> {item.justification}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!item.assigned_user_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAssign(item.id)}
                    >
                      Atribuir
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default Pending;
