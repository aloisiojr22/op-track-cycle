# FollowUp CCO - Sistema de Desempenho Operacional

Um sistema moderno e profissional de rastreamento de atividades, pendências e comunicação em tempo real desenvolvido para o Centro de Controle Operacional (CCO) do Grupo Brasileiro.

## 🎯 Sobre

**FollowUp CCO** é uma plataforma web robusta construída para gerenciar eficientemente:
- **Atividades Diárias**: Registro e acompanhamento de tarefas operacionais
- **Pendências**: Gerenciamento centralizado de itens pendentes
- **Chat em Tempo Real**: Comunicação privada e em broadcast entre operadores
- **Histórico**: Registro completo de todas as operações realizadas
- **Dashboard de IA**: Assistente inteligente para consultas e suporte
- **Painel Administrativo**: Controle total de usuários e permissões
- **Logs Detalhados**: Rastreamento completo de eventos do sistema

## 🚀 Funcionalidades Principais

### 📊 Atividades
- Iniciar e finalizar dias de operação
- Registro automático de atividades em tempo real
- Visualização de gráficos de desempenho
- Status em tempo real com cores indicadoras

### ⏳ Pendências
- Criação e atribuição de pendências
- Sistema de resolução com aprovação
- Notificações automáticas ao atribuir
- Voz sintetizada para alertas de pendências

### 💬 Chat
- Mensagens privadas entre operadores
- Broadcast para toda a equipe
- Aprovação de mensagens críticas
- Sincronização em tempo real

### 🤖 IA Assistant
- Consultas sobre o sistema
- Respostas contextualizadas
- Síntese de voz para respostas
- Histórico de conversas

### 👥 Administração
- Gerenciamento de usuários
- Controle de roles (admin, supervisor, operador)
- Aprovação de novas contas
- Auditoria de ações

## 🛠️ Stack Tecnológico

### Frontend
- **React 18.3.1** - UI declarativa
- **TypeScript** - Type safety
- **Vite 5.4.19** - Build ultrarrápido
- **Tailwind CSS** - Estilização responsiva
- **shadcn/ui** - Componentes profissionais

### Backend
- **Supabase** - PostgreSQL + Authentication
- **Real-time Channels** - Sincronização em tempo real
- **Edge Functions** - Lógica serverless

### Ferramentas
- **ESLint** - Code quality
- **React Router** - Navegação
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de schema

## 📋 Pré-requisitos

- Node.js 18+
- npm ou bun
- Conta Supabase (banco de dados)

## 🚀 Instalação e Execução

### 1. Clonar repositório
```bash
git clone https://github.com/aloisiojr22/op-track-cycle.git
cd op-track-cycle
```

### 2. Instalar dependências
```bash
npm install
# ou
bun install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env.local`:
```
VITE_SUPABASE_URL=https://seu-project.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 4. Executar em desenvolvimento
```bash
npm run dev
```

Acesse http://localhost:8080

### 5. Build para produção
```bash
npm run build
```

## 📦 Deploy no Netlify

1. Conecte seu repositório GitHub ao Netlify
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy automático a cada push para `main`

## 📱 Responsividade

A aplicação é totalmente responsiva e funciona perfeitamente em:
- Desktop (Chrome, Firefox, Safari, Edge)
- Tablet
- Mobile

## 🔐 Segurança

- Autenticação via Supabase Auth
- Autorização baseada em roles
- Validação de formulários com Zod
- HTTPS obrigatório em produção
- Proteção contra CSRF
- Rate limiting no Supabase

## 📊 Estrutura do Projeto

```
src/
├── components/
│   ├── layout/        # Layout principal e sidebar
│   ├── ui/            # Componentes reutilizáveis
│   └── ErrorBoundary  # Tratamento de erros
├── contexts/          # Context API (Auth, Theme)
├── hooks/             # Custom React hooks
├── integrations/
│   └── supabase/      # Cliente Supabase
├── lib/
│   ├── aiEngine.ts    # Motor de IA
│   └── utils.ts       # Funções auxiliares
├── pages/             # Páginas da aplicação
└── styles/            # CSS global
```

## 🎨 Design System

- **Cores Corporativas**: Slate-800/900 para tema profissional
- **Tipografia**: Inter font family
- **Espaçamento**: Sistema de grid baseado em Tailwind
- **Componentes**: Baseados em padrões de design moderno

## 🔊 Recursos Especiais

### Síntese de Voz
- Anúncio automático de pendências ao fazer login
- Leitura de respostas da IA
- Suporte multilíngue português/inglês

### Logging
- Dashboard de logs com busca
- Filtros por tipo de evento
- Export de dados
- Rastreamento em tempo real

### Notificações
- Alertas de chat via toast
- Modal de pendências ao login
- Atualizações em tempo real

## 🐛 Troubleshooting

### Página em branco
1. Verifique variáveis de ambiente
2. Abra DevTools (F12) → Console para erros
3. Limpe cache do navegador

### Erro de conexão Supabase
1. Confirme URL e chave do projeto
2. Verifique conectividade de rede
3. Acesse https://status.supabase.com

### Problemas de real-time
1. Verifique se Realtime está ativado no Supabase
2. Reinicie o servidor local
3. Limpe localStorage

## 📝 Changelog

### v1.0.0 (Dec 2025)
- ✅ Sistema de atividades diárias
- ✅ Gerenciamento de pendências
- ✅ Chat em tempo real (privado/broadcast)
- ✅ Histórico de operações
- ✅ Painel administrativo
- ✅ Assistente IA
- ✅ Dashboard de logs
- ✅ Notificações por voz
- ✅ Design corporativo
- ✅ Deploy automático

## 👨‍💻 Desenvolvedor

**Autor**: Aloisio Caldas Junior  
**Projeto**: Sistema de Desempenho Operacional para CCO  
**Organização**: Grupo Brasileiro  

## 📄 Licença

MIT - Uso livre para fins internos

## 🤝 Suporte

Para dúvidas ou sugestões sobre o sistema, entre em contato com o desenvolvedor.

---

**Desenvolvido com ❤️ para excelência operacional**
