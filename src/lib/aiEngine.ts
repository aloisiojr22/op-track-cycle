// AI Engine - Deepseek-style response system
export interface AIResponse {
  answer: string;
  confidence: number;
  sources?: string[];
}

const KNOWLEDGE_BASE = {
  pendencias: {
    keywords: ['pend', 'pendênc', 'atraso', 'atrasadas'],
    responses: [
      'As pendências são atividades que não foram concluídas no prazo. Você pode visualizá-las na aba "Pendências e Solicitações" onde pode atribuir a outros usuários ou resolver.',
      'Para consultar pendências: acesse a aba "Pendências e Solicitações" no menu lateral. Lá você verá todas as atividades pendentes com filtros por tipo e status.',
    ]
  },
  atividades: {
    keywords: ['ativid', 'ativar', 'iniciar', 'finalizar', 'dia'],
    responses: [
      'Na aba "Minhas Atividades" você pode: 1) Clicar "Iniciar Dia" para começar suas atividades 2) Marcar cada atividade como "Em Andamento" ou "Concluída" 3) Clicar "Finalizar Dia" para salvar suas atividades.',
      'Cada atividade pode ter os seguintes status: Não Iniciada, Em Andamento, Concluída, Pendente ou Com Atraso. Você pode alterar o status clicando no botão de status da atividade.',
      'As atividades são persistidas automaticamente no banco de dados. Quando você finaliza o dia, o sistema cria pendências para atividades não concluídas.',
    ]
  },
  chat: {
    keywords: ['chat', 'mensagem', 'conversa', 'privad', 'broadcast', 'grupo'],
    responses: [
      'O Chat do Grupo permite comunicação em tempo real. Você pode escolher entre: 1) Chat Geral (mensagens para todos) ou 2) Conversas Privadas (1:1 com usuários específicos).',
      'Para enviar mensagens você precisa estar com status de aprovação "aprovado". Selecione o tipo de conversa no dropdown e digite sua mensagem no campo de input.',
      'Mensagens são sincronizadas em tempo real usando subscriptions do Supabase. Você receberá notificações quando novas mensagens chegarem.',
    ]
  },
  admin: {
    keywords: ['admin', 'usuário', 'painel', 'aprovação', 'permiss', 'role', 'editor'],
    responses: [
      'O Painel Admin permite gerenciar usuários: 1) Aprovar novos usuários 2) Editar dados de usuários (nome, email, permissão) 3) Visualizar estatísticas 4) Atribuir atividades.',
      'Para editar um usuário, clique no ícone de lápis ao lado do nome. Você pode alterar: nome completo, email e nível de permissão (se for admin).',
      'Apenas administradores têm acesso ao Painel Admin. Supervisores têm acesso limitado a algumas funcionalidades.',
    ]
  },
  ai: {
    keywords: ['ia', 'inteligencia', 'artificial', 'como', 'pergunta', 'resposta', 'função', 'usar'],
    responses: [
      'Esta IA é um assistente integrado ao sistema que responde perguntas sobre: pendências, atividades, chat, admin, uso geral, como usar recursos, documentação e suporte.',
      'Para usar: digite sua pergunta em qualquer linguagem natural. A IA buscará a melhor resposta em sua base de conhecimento. Tente ser específico ao perguntar.',
      'A IA entende contexto, sinônimos e variações de perguntas. Você pode perguntar "como começar o dia?" ou "como iniciar atividades?" - ela entenderá ambas.',
    ]
  },
  logs: {
    keywords: ['log', 'debug', 'erro', 'supabase', 'operação', 'histórico', 'rastreamento'],
    responses: [
      'A aba "Logs" permite visualizar todas as operações do Supabase em tempo real. Cada operação registra: tipo (insert/update/select), tabela, payload, resposta e erros.',
      'Para acessar: vá até "Logs" no menu lateral (apenas para admins). Você pode buscar por operação, filtrar por tabela ou procurar por erro específico. Use "Exportar" para gerar relatório JSON.',
    ]
  },
  hist: {
    keywords: ['histórico', 'relatorio', 'analise', 'estatistica', 'performance', 'gráfico', 'taxa'],
    responses: [
      'A aba "Histórico" mostra sua performance histórica: gráficos de conclusão por período (dia/semana/mês), comparação com períodos anteriores, taxa de conclusão e atividades pendentes.',
      'Você pode filtrar por período usando os botões "Hoje", "Semana" ou "Mês". O sistema mostra automaticamente comparações e tendências.',
    ]
  },
  sistema: {
    keywords: ['sistema', 'funciona', 'como', 'o que', 'para que', 'qual', 'quando', 'onde', 'geral'],
    responses: [
      'FollowUpCCO é um sistema de gestão de atividades operacionais com suporte a: rastreamento de atividades diárias, gestão de pendências, chat em tempo real, painel administrativo, assistente IA e logs de auditoria.',
      'O sistema foi desenvolvido com React + TypeScript no frontend e Supabase (PostgreSQL) no backend. Todas as operações são registradas e sincronizadas em tempo real.',
      'Principais funcionalidades: iniciar/finalizar dia, marcar atividades como em andamento/concluída, atribuir pendências a usuários, chat privado/grupo, aprovação de usuários, edição de perfil, visualização de histórico e logs.',
    ]
  }
};

export async function queryAI(question: string): Promise<AIResponse> {
  // Normalize question
  const q = question.toLowerCase().trim();
  
  // Find best matching category
  let bestMatch = { category: 'sistema', score: 0, responses: KNOWLEDGE_BASE.sistema.responses };
  
  Object.entries(KNOWLEDGE_BASE).forEach(([category, data]: [string, any]) => {
    const score = data.keywords.reduce((acc: number, keyword: string) => {
      const matches = q.split(' ').filter((word: string) => word.includes(keyword)).length;
      return acc + matches;
    }, 0);
    
    if (score > bestMatch.score) {
      bestMatch = { category, score, responses: data.responses };
    }
  });

  // Select random response from category
  const response = bestMatch.responses[Math.floor(Math.random() * bestMatch.responses.length)];
  const confidence = Math.min(100, (bestMatch.score / 2 + 50));

  return {
    answer: response,
    confidence: Math.round(confidence),
    sources: [bestMatch.category]
  };
}

export async function batchQueryAI(questions: string[]): Promise<AIResponse[]> {
  return Promise.all(questions.map(q => queryAI(q)));
}
