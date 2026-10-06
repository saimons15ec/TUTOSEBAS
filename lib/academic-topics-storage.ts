import { AcademicTopicError, academicScope, buildAcademicTopics, inAcademicScope, legacyTopicParts, managedAcademicTopic, nextTopicNumber, normalizedTopicDefinition, topicAliases, topicKey, topicScopeKey, topicTitle, type AcademicScope, type AcademicTopic, type TopicRecord } from "./academic-topics.ts";

type StoredRow = { id: string; kind: string; title: string; status: string; data_json: string };
function unpack(row: StoredRow): TopicRecord { let data: Record<string, unknown> = {}; try { data = JSON.parse(row.data_json); } catch {} return { ...row, data }; }
async function topicId(scope: AcademicScope, key: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([topicScopeKey(scope), key])));
  return "topic_" + [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 48);
}
async function scopedRows(database: D1Database, scope: AcademicScope, kinds = "'topic'") {
  const rows = await database.prepare(`SELECT id,kind,title,status,data_json FROM records WHERE kind IN (${kinds}) AND json_extract(data_json,'$.area')=? AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.period')=?`).bind(scope.area, scope.subject, scope.period).all<StoredRow>();
  return rows.results;
}
const conflict = () => { const error = new AcademicTopicError("El catálogo cambió o ese número/nombre ya existe. Actualiza los temas y vuelve a guardar."); error.status = 409; return error; };
function topicData(topic: AcademicTopic) { return { area: topic.area, subject: topic.subject, period: topic.period, number: topic.number, name: topic.name, aliases: topic.aliases, aliasKeys: [...topicAliases(topic)], needsReview: topic.needsReview }; }
const scopeSql = "kind='topic' AND status='published' AND json_extract(data_json,'$.area')=? AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.period')=?";

/** One guarded SQLite statement prevents concurrent creation of the same number/name. */
async function insertTopic(database: D1Database, topic: AcademicTopic, actorId: string) {
  const result = await database.prepare(`INSERT INTO records (id,kind,title,status,data_json,created_by) SELECT ?,'topic',?,'published',?,? WHERE NOT EXISTS (SELECT 1 FROM records WHERE ${scopeSql} AND (json_extract(data_json,'$.number')=? OR EXISTS (SELECT 1 FROM json_each(records.data_json,'$.aliasKeys') WHERE value=?)))`).bind(topic.id, topic.title, JSON.stringify(topicData(topic)), actorId, topic.area, topic.subject, topic.period, topic.number, topicKey(topic.title)).run();
  return result.meta.changes === 1;
}

export async function resolveAcademicTopic(database: D1Database, scopeInput: AcademicScope, input: { topicId?: unknown; topic?: unknown }, actorId: string, reservedNumbers: number[] = []): Promise<AcademicTopic> {
  const scope = academicScope(scopeInput), rows = (await scopedRows(database, scope)).map(unpack), topics = rows.flatMap(row => { const topic = managedAcademicTopic(row, scope); return topic ? [topic] : []; });
  const id = typeof input.topicId === "string" ? input.topicId.trim() : "";
  if (id) {
    const topic = topics.find(item => item.id === id);
    if (!topic) throw new AcademicTopicError("El tema seleccionado debe pertenecer a la misma materia y periodo y estar activo.");
    return topic;
  }
  const raw = typeof input.topic === "string" ? input.topic.trim() : "";
  if (!raw || raw.length > 180 || /[\u0000-\u001f]/.test(raw)) throw new AcademicTopicError("Selecciona un tema o escribe un nombre válido de hasta 180 caracteres.");
  const found = topics.find(item => topicAliases(item).has(topicKey(raw)));
  if (found) return found;
  const parts = legacyTopicParts(raw), occupied = topics.some(item => item.number === parts.number), number = parts.number && !occupied ? parts.number : nextTopicNumber([...topics, ...reservedNumbers.map(number => ({ number }))]);
  const name = parts.name.slice(0, 150), title = topicTitle(number, name), aliases = [...new Set([raw, title])];
  const topic: AcademicTopic = { ...scope, id: await topicId(scope, topicKey(raw)), number, name, title, aliases, legacy: false, needsReview: Boolean(parts.number && occupied) || parts.name.length > 150 };
  try { if (await insertTopic(database, topic, actorId)) return topic; } catch (error) {
    const retry = await database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE id=? AND kind='topic'").bind(topic.id).first<StoredRow>();
    const recovered = retry && managedAcademicTopic(unpack(retry), scope);
    if (recovered) return recovered;
    throw error;
  }
  const retry = (await scopedRows(database, scope)).map(unpack).flatMap(row => { const topic = managedAcademicTopic(row, scope); return topic ? [topic] : []; }).find(item => topicAliases(item).has(topicKey(raw)));
  if (retry) return retry;
  throw conflict();
}

/** Backfill only active content and simulator configuration; attempt snapshots are untouched. */
function contentUpdates(database: D1Database, scope: AcademicScope, topic: AcademicTopic, rows: StoredRow[]): D1PreparedStatement[] {
  const keys = topicAliases(topic), statements: D1PreparedStatement[] = [];
  for (const row of rows) {
    const data = unpack(row).data;
    if (row.status === "archived" || !inAcademicScope(data, scope)) continue;
    if (["resource", "question", "question_block"].includes(row.kind) && (data.topicId === topic.id || (!data.topicId && keys.has(topicKey(data.topic))))) {
      if (data.topicId === topic.id && data.topic === topic.title) continue;
      statements.push(database.prepare("UPDATE records SET data_json=json_set(data_json,'$.topicId',?,'$.topic',?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND (json_extract(data_json,'$.topicId')=? OR (COALESCE(json_extract(data_json,'$.topicId'),'')='' AND json_extract(data_json,'$.topic')=?)) AND EXISTS (SELECT 1 FROM records WHERE id=? AND kind='topic' AND status='published' AND title=?)").bind(topic.id, topic.title, row.id, topic.id, String(data.topic || ""), topic.id, topic.title));
    }
    if (row.kind === "simulator" && Array.isArray(data.topics)) {
      const selected = [...new Set(data.topics.map(item => keys.has(topicKey(item)) ? topic.title : String(item)))];
      if (JSON.stringify(selected) === JSON.stringify(data.topics)) continue;
      statements.push(database.prepare("UPDATE records SET data_json=json_set(data_json,'$.topics',json(?)),updated_at=CURRENT_TIMESTAMP WHERE id=? AND json_extract(data_json,'$.topics')=json(?) AND EXISTS (SELECT 1 FROM records WHERE id=? AND kind='topic' AND status='published' AND title=?)").bind(JSON.stringify(selected), row.id, JSON.stringify(data.topics), topic.id, topic.title));
    }
  }
  return statements;
}
async function runUpdates(database: D1Database, statements: D1PreparedStatement[]) {
  let updated = 0;
  for (let offset = 0; offset < statements.length; offset += 80) { const result = await database.batch(statements.slice(offset, offset + 80)); updated += result.reduce((sum, item) => sum + Number(item.meta.changes || 0), 0); }
  return updated;
}

export async function saveAcademicTopic(database: D1Database, scopeInput: AcademicScope, input: { id?: unknown; number?: unknown; name?: unknown }, actorId: string) {
  const scope = academicScope(scopeInput), definition = normalizedTopicDefinition(input.number, input.name), stored = await scopedRows(database, scope), topics = stored.map(unpack).flatMap(row => { const topic = managedAcademicTopic(row, scope); return topic ? [topic] : []; });
  const id = typeof input.id === "string" ? input.id.trim() : "", previous = id ? topics.find(item => item.id === id) : null;
  if (id && !previous) throw new AcademicTopicError("El tema ya no está disponible en esta materia y periodo.");
  if (topics.some(item => item.id !== id && (item.number === definition.number || topicAliases(item).has(topicKey(definition.title)) || topicKey(item.name) === topicKey(definition.name)))) throw conflict();
  const topic: AcademicTopic = { ...scope, ...definition, id: previous?.id || await topicId(scope, topicKey(definition.title)), aliases: [...new Set([...(previous?.aliases || []), previous?.title || definition.title, definition.title])], legacy: false, needsReview: false };
  if (topic.aliases.length > 100) throw new AcademicTopicError("Este tema alcanzó el límite de cambios de nombre; conserva su nombre actual.");
  if (!previous) { if (!(await insertTopic(database, topic, actorId))) throw conflict(); return { topic, updated: 0 }; }
  const source = stored.find(row => row.id === previous.id)!;
  const rows = await scopedRows(database, scope, "'resource','question','question_block','simulator'");
  const updates = contentUpdates(database, scope, topic, rows);
  const guarded = database.prepare(`UPDATE records SET title=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='topic' AND status='published' AND data_json=? AND NOT EXISTS (SELECT 1 FROM records WHERE ${scopeSql} AND id!=? AND (json_extract(data_json,'$.number')=? OR EXISTS (SELECT 1 FROM json_each(records.data_json,'$.aliasKeys') WHERE value=?)))`).bind(topic.title, JSON.stringify(topicData(topic)), topic.id, source.data_json, scope.area, scope.subject, scope.period, topic.id, topic.number, topicKey(topic.title));
  // Renaming is bounded so its catalog/content update remains a single transaction.
  if (updates.length > 500) throw new AcademicTopicError("Este tema tiene más de 500 registros que requieren cambio. Divide la revisión antes de renombrarlo.");
  const results = await database.batch([guarded, ...updates]);
  if (results[0].meta.changes !== 1) throw conflict();
  return { topic, updated: results.slice(1).reduce((sum, result) => sum + Number(result.meta.changes || 0), 0) };
}

export async function synchronizeAcademicTopics(database: D1Database, period: string, actorId: string) {
  const rows = (await database.prepare("SELECT id,kind,title,status,data_json FROM records WHERE kind IN ('resource','question','question_block','simulator','topic') AND status!='archived' AND json_extract(data_json,'$.period')=? AND json_extract(data_json,'$.area') IN ('complexive','final_degree')").bind(period).all<StoredRow>()).results;
  const archived = (await database.prepare("SELECT data_json,title FROM records WHERE kind='subject' AND status='archived' AND json_extract(data_json,'$.period')=?").bind(period).all<{ data_json: string; title: string }>()).results;
  const scopes = new Map<string, AcademicScope>();
  for (const row of rows) {
    if (!["resource", "question", "question_block"].includes(row.kind)) continue;
    const data = unpack(row).data;
    if (!topicKey(data.topic) || !data.subject || archived.some(item => { const d = JSON.parse(item.data_json); return d.area === data.area && topicKey(item.title) === topicKey(data.subject); })) continue;
    const scope = academicScope(data); scopes.set(topicScopeKey(scope), scope);
  }
  let created = 0, updated = 0, review = 0;
  for (const scope of scopes.values()) {
    const choices = buildAcademicTopics(rows.filter(row => row.kind === "topic").map(unpack), rows.map(unpack), scope).sort((a, b) => Number(Boolean(legacyTopicParts(b.title).number)) - Number(Boolean(legacyTopicParts(a.title).number)) || a.number - b.number);
    const reserved = choices.map(choice => legacyTopicParts(choice.title).number).filter(Boolean);
    const statements: D1PreparedStatement[] = [], replacements = new Map<string, AcademicTopic>();
    for (const choice of choices) {
      const topic = choice.legacy ? await resolveAcademicTopic(database, scope, { topic: choice.title }, actorId, reserved) : choice;
      if (choice.legacy) created++;
      if (topic.needsReview) review++;
      // Include original spellings for exact guarded updates, including case/space aliases.
      const spellings = rows.filter(row => { const data = unpack(row).data; return inAcademicScope(data, scope) && topicKey(data.topic) === topicKey(choice.title); }).map(row => String(unpack(row).data.topic));
      const resolved = { ...topic, aliases: [...new Set([...topic.aliases, ...spellings])] };
      for (const key of topicAliases(resolved)) replacements.set(key, resolved);
      statements.push(...contentUpdates(database, scope, resolved, rows.filter(row => row.kind !== "simulator")));
    }
    // Convert all selected legacy names in one update, preserving concurrent configuration edits.
    for (const row of rows.filter(row => row.kind === "simulator")) {
      const data = unpack(row).data;
      if (!inAcademicScope(data, scope) || !Array.isArray(data.topics)) continue;
      const selected = [...new Set(data.topics.map(value => replacements.get(topicKey(value))?.title || String(value)))];
      if (JSON.stringify(selected) !== JSON.stringify(data.topics)) statements.push(database.prepare("UPDATE records SET data_json=json_set(data_json,'$.topics',json(?)),updated_at=CURRENT_TIMESTAMP WHERE id=? AND json_extract(data_json,'$.topics')=json(?)").bind(JSON.stringify(selected), row.id, JSON.stringify(data.topics)));
    }
    updated += await runUpdates(database, statements);
  }
  return { created, updated, review };
}
