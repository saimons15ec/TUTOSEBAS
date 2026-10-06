import { topicKey, type AcademicTopic, type AcademicScope } from "./academic-topics.ts";
export type PracticeTopicProgress = { topic: string; topicId: string; format: string; total: number; answered: number; correct: number };
export type PracticeProgressRow = { id: string; kind: string; status: string; data: Record<string, unknown> };
type Question = { id: string; topic: string; topicId: string; format: string; revision: string };
type Answer = { questionId: string; selectedIndex: number; correct: boolean; answeredAt: string };
export type PracticeState = { area: string; subject: string; period: string; startedAt: string; completedAt: string | null; questions: Question[]; answers: Answer[] };
export function publicPracticeData(data: PracticeState) {
  const topics: PracticeTopicProgress[] = [];
  for (const question of data.questions) {
    let topic = topics.find(item => item.topicId === question.topicId && topicKey(item.topic) === topicKey(question.topic) && item.format === question.format);
    if (!topic) { topic = { topic: question.topic, topicId: question.topicId, format: question.format, total: 0, answered: 0, correct: 0 }; topics.push(topic); }
    topic.total++; const answer = data.answers.find(item => item.questionId === question.id);
    if (answer) { topic.answered++; if (answer.correct === true) topic.correct++; }
  }
  return { area: data.area, subject: data.subject, period: data.period, startedAt: data.startedAt, completedAt: data.completedAt, total: data.questions.length, answered: data.answers.length, correct: data.answers.filter(item => item.correct === true).length, topics };
}
export function practiceMetrics(rows: PracticeProgressRow[], scope: AcademicScope, topic: AcademicTopic | null, format: string) {
  let started = 0, completed = 0, answered = 0, correct = 0;
  const aliases = new Set([topic?.title, ...(topic?.aliases || [])].map(topicKey).filter(Boolean));
  for (const row of rows) {
    if (row.kind !== "practice_session" || row.data.area !== scope.area || row.data.subject !== scope.subject || row.data.period !== scope.period) continue;
    const entries = Array.isArray(row.data.topics) ? row.data.topics as PracticeTopicProgress[] : [];
    const selected = entries.filter(item => (!format || item.format === format) && (!topic || (!topic.legacy && item.topicId ? item.topicId === topic.id : aliases.has(topicKey(item.topic)))));
    if (!selected.length) continue; started++; if (row.status === "completed") completed++;
    answered += selected.reduce((sum, item) => sum + item.answered, 0); correct += selected.reduce((sum, item) => sum + item.correct, 0);
  }
  return { started, completed, answered, correct, accuracy: answered ? Math.round(correct / answered * 100) : null };
}
