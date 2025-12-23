// Script de simulação do fluxo: startDay -> marcar atividades -> endDay
// Usa um supabase mock para mostrar inserts/updates que seriam executados.

const today = new Date().toISOString().slice(0, 10);
const user = { id: 'user-1' };

// Atividades atribuídas
const userActivities = [
  { activity_id: 'act-1', activities: { id: 'act-1', name: 'Verificar painel' } },
  { activity_id: 'act-2', activities: { id: 'act-2', name: 'Relatório diário' } },
];

// Simulamos o mapa de dailyRecords como no app
const dailyRecords = new Map();

dailyRecords.set('act-1', {
  id: 'rec-1',
  activity_id: 'act-1',
  status: 'em_andamento',
  justification: 'Motivo X',
  action_taken: 'Ação Y',
  started_at: new Date().toISOString(),
  completed_at: null,
  date: today,
});

dailyRecords.set('act-2', {
  id: 'rec-2',
  activity_id: 'act-2',
  status: 'nao_iniciada',
  justification: null,
  action_taken: null,
  started_at: null,
  completed_at: null,
  date: today,
});

// Mock simples que registra chamadas
const mockDB = {
  pendingItemsInserted: [],
  dailyRecordsUpdated: [],
  async insertPending(item) {
    this.pendingItemsInserted.push(item);
    return { error: null };
  },
  async updateDailyRecord(id, data) {
    this.dailyRecordsUpdated.push({ id, data });
    return { error: null };
  }
};

async function startDay() {
  const records = userActivities.map(ua => ({
    user_id: user.id,
    activity_id: ua.activity_id,
    date: today,
    status: 'nao_iniciada',
  }));
  console.log('startDay -> upsert records:', records);
  // Simula sucesso
}

async function endDay() {
  const inProgressRecords = Array.from(dailyRecords.values()).filter(r => r.status === 'em_andamento');
  console.log('endDay -> inProgressRecords:', inProgressRecords);

  for (const record of inProgressRecords) {
    const insertRes = await mockDB.insertPending({
      original_user_id: user.id,
      activity_id: record.activity_id,
      original_date: today,
      justification: record.justification,
      action_taken: record.action_taken,
    });
    if (insertRes.error) {
      console.error('insert pending error', insertRes.error);
      throw insertRes.error;
    }

    const updateRes = await mockDB.updateDailyRecord(record.id, { status: 'pendente' });
    if (updateRes.error) {
      console.error('update daily record error', updateRes.error);
      throw updateRes.error;
    }
  }

  const notStartedWithoutJustification = Array.from(dailyRecords.values())
    .filter(r => r.status === 'nao_iniciada' && !r.justification);

  console.log('endDay -> notStartedWithoutJustification:', notStartedWithoutJustification);

  for (const record of notStartedWithoutJustification) {
    const insertRes = await mockDB.insertPending({
      original_user_id: user.id,
      activity_id: record.activity_id,
      original_date: today,
    });
    if (insertRes.error) {
      console.error('insert pending error', insertRes.error);
      throw insertRes.error;
    }

    const updateRes = await mockDB.updateDailyRecord(record.id, { status: 'pendente' });
    if (updateRes.error) {
      console.error('update daily record error', updateRes.error);
      throw updateRes.error;
    }
  }

  console.log('\nSimulação concluída. Registros que seriam persistidos:');
  console.log('pending_items inserts:', JSON.stringify(mockDB.pendingItemsInserted, null, 2));
  console.log('daily_records updates:', JSON.stringify(mockDB.dailyRecordsUpdated, null, 2));
}

(async () => {
  console.log('--- Simulação startDay ---');
  await startDay();
  console.log('\n--- Simulação endDay ---');
  await endDay();
})();
