import { questionIdentity, questionKey, type BlockContext, type BlockQuestion } from "./question-blocks.ts";

async function hash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Deterministic IDs + a D1 transaction keep retries and overlapping imports safe. */
export async function saveQuestionBlock(database: D1Database, context: BlockContext, questions: BlockQuestion[], actorId: string, sourceMetadata: Record<string, string> = {}) {
  const scope = [context.area, questionKey(context.subject), context.period];
  const blockId = `qblock_${await hash(JSON.stringify([scope, context.topicId || context.topic, context.sourceResourceId, context.plan, questions]))}`;
  const previous = await database.prepare("SELECT id FROM records WHERE id=? AND kind='question_block'").bind(blockId).first();
  if (previous) return { blockId, count: questions.length, reused: true, conflict: false };
  const existing = await database.prepare("SELECT data_json FROM records WHERE kind='question' AND json_extract(data_json,'$.area')=? AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.period')=?").bind(context.area, context.subject, context.period).all<{ data_json: string }>();
  const prompts = new Set(existing.results.map(row => { try { return questionIdentity(JSON.parse(row.data_json)); } catch { return ""; } }));
  if (questions.some(question => prompts.has(questionIdentity(question)))) return { blockId, count: 0, reused: false, conflict: true };
  const { format: _format, source: _source, ...scopeData } = context;
  void _format; void _source;
  const statements = [database.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES (?,'question_block',?,'pending',?,?)").bind(blockId, context.title, JSON.stringify({ ...scopeData, questionCount: questions.length, formats: [...new Set(questions.map(question => question.format))] }), actorId)];
  const inserts: Array<{ id: string; data: string }> = [];
  for (const question of questions) {
    const questionId = `qimport_${await hash(JSON.stringify([scope, questionIdentity(question)]))}`;
    inserts.push({ id: questionId, data: JSON.stringify({ ...scopeData, ...question, ...sourceMetadata, importBlockId: blockId, importBlockTitle: context.title }) });
  }
  // D1 permits 100 bound parameters per statement. Keep the whole batch atomic.
  for (let offset = 0; offset < inserts.length; offset += 25) {
    const chunk = inserts.slice(offset, offset + 25);
    statements.push(database.prepare("INSERT INTO records (id,kind,title,status,data_json,created_by) VALUES " + chunk.map(() => "(?,'question',?,'pending',?,?)").join(","))
      .bind(...chunk.flatMap(entry => [entry.id, `${context.subject} · ${context.topic}`, entry.data, actorId])));
  }
  try { await database.batch(statements); }
  catch (error) {
    const retry = await database.prepare("SELECT id FROM records WHERE id=? AND kind='question_block'").bind(blockId).first();
    if (retry) return { blockId, count: questions.length, reused: true, conflict: false };
    const collision = await database.prepare("SELECT data_json FROM records WHERE kind='question' AND json_extract(data_json,'$.area')=? AND lower(json_extract(data_json,'$.subject'))=lower(?) AND json_extract(data_json,'$.period')=?").bind(context.area, context.subject, context.period).all<{ data_json: string }>();
    if (collision.results.some(row => { try { return questions.some(question => questionIdentity(question) === questionIdentity(JSON.parse(row.data_json))); } catch { return false; } })) return { blockId, count: 0, reused: false, conflict: true };
    throw error;
  }
  return { blockId, count: questions.length, reused: false, conflict: false };
}

/** Recheck status and linked materials inside the transaction, including concurrent edits. */
export async function approveQuestionBlockRecords(database: D1Database, blockId: string) {
  const blocker = `SELECT 1 FROM records q WHERE q.kind='question' AND json_extract(q.data_json,'$.importBlockId')=? AND
    (q.status NOT IN ('pending','draft','approved') OR
    (COALESCE(json_extract(q.data_json,'$.sourceResourceId'),'')!='' AND NOT EXISTS
      (SELECT 1 FROM records r WHERE r.id=json_extract(q.data_json,'$.sourceResourceId') AND r.kind='resource' AND r.status='published')))`;
  const result = await database.batch([
    database.prepare("UPDATE records SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE kind='question' AND json_extract(data_json,'$.importBlockId')=? AND status IN ('pending','draft') AND EXISTS (SELECT 1 FROM records b WHERE b.id=? AND b.kind='question_block' AND b.status!='archived') AND NOT EXISTS (" + blocker + ")").bind(blockId, blockId, blockId),
    database.prepare("UPDATE records SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind='question_block' AND status!='archived' AND EXISTS (SELECT 1 FROM records q WHERE q.kind='question' AND json_extract(q.data_json,'$.importBlockId')=?) AND NOT EXISTS (SELECT 1 FROM records q WHERE q.kind='question' AND json_extract(q.data_json,'$.importBlockId')=? AND q.status!='approved')").bind(blockId, blockId, blockId),
  ]);
  return result[1].meta.changes === 1;
}
