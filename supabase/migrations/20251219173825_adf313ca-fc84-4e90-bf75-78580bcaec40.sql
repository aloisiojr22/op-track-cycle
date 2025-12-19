-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'supervisor', 'operador', 'operador_12_36_diurno', 'operador_12_36_noturno');

-- Create enum for activity status
CREATE TYPE public.activity_status AS ENUM ('nao_iniciada', 'em_andamento', 'concluida', 'pendente', 'concluida_com_atraso', 'plantao', 'conferencia_mensal');

-- Create enum for special request types
CREATE TYPE public.special_request_type AS ENUM ('solicitacao_email', 'requisicao_imagem', 'rdo_pendente', 'sonolencia_fadiga');

-- Create enum for approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'operador',
  approval_status approval_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_duty_activity BOOLEAN DEFAULT FALSE,
  is_monthly_conference BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_activities (assignment) table
CREATE TABLE public.user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_id)
);

-- Create daily_records table
CREATE TABLE public.daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status activity_status DEFAULT 'nao_iniciada',
  justification TEXT,
  action_taken TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_id, date)
);

-- Create pending_items table
CREATE TABLE public.pending_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  description TEXT,
  justification TEXT,
  action_taken TEXT,
  request_type special_request_type,
  is_special_request BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  original_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table for additional role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role
  );
$$;

-- Create function to check if user is admin or supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role IN ('admin', 'supervisor')
  );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all approved profiles" ON public.profiles
  FOR SELECT USING (approval_status = 'approved' OR auth.uid() = id OR public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Allow insert for new users" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin_or_supervisor(auth.uid()));

-- RLS Policies for activities
CREATE POLICY "Anyone authenticated can view activities" ON public.activities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage activities" ON public.activities
  FOR ALL USING (public.is_admin_or_supervisor(auth.uid()));

-- RLS Policies for user_activities
CREATE POLICY "Users can view own assignments" ON public.user_activities
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins can manage assignments" ON public.user_activities
  FOR ALL USING (public.is_admin_or_supervisor(auth.uid()));

-- RLS Policies for daily_records
CREATE POLICY "Users can view own records" ON public.daily_records
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Users can insert own records" ON public.daily_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own records" ON public.daily_records
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_or_supervisor(auth.uid()));

-- RLS Policies for pending_items
CREATE POLICY "Users can view all pending items" ON public.pending_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert pending items" ON public.pending_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update pending items" ON public.pending_items
  FOR UPDATE TO authenticated USING (true);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_broadcast = true);

CREATE POLICY "Users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin_or_supervisor(auth.uid()));

-- Create trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'pending'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_records_updated_at BEFORE UPDATE ON public.daily_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_items_updated_at BEFORE UPDATE ON public.pending_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_records;