import { optionsCanShuffle } from "./question-blocks.ts";

type UnknownRecord = Record<string, unknown>;

export function prepareQuestionChoices(question: UnknownRecord, shuffle: <T>(values: T[]) => T[]) {
  const options = Array.isArray(question.options) ? question.options.map(option => typeof option === "string" ? option.trim() : "") : [];
  const correctIndex = question.correctIndex;
  if (options.length !== 4 || options.some(option => !option) || typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
  const indexed = options.map((label, originalIndex) => ({ label, originalIndex }));
  const prepared = optionsCanShuffle(options, question.shuffleOptions, `${String(question.prompt || "")}\n${String(question.caseContext || "")}`) ? shuffle(indexed) : indexed;
  return { options: prepared.map(option => option.label), correctIndex: prepared.findIndex(option => option.originalIndex === correctIndex) };
}

export function selectedSimulatorTopics(data: UnknownRecord) {
  return Array.isArray(data.topics) ? [...new Set(data.topics.flatMap(topic => typeof topic === "string" && topic.trim() ? [topic.trim()] : []))] : [];
}

export function matchesSimulatorTopics(question: UnknownRecord, simulator: UnknownRecord) {
  const topics = selectedSimulatorTopics(simulator);
  return !topics.length || topics.includes(String(question.topic || ""));
}

/** SQL values remain bound even when a teacher selects several topics. */
export function simulatorTopicQuery(simulator: UnknownRecord) {
  const topics = selectedSimulatorTopics(simulator);
  return { sql: topics.length ? ` AND json_extract(data_json,'$.topic') IN (${topics.map(() => "?").join(",")})` : "", values: topics };
}
type SimulatorDraft = { answers: Record<string, number>; index: number };
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type DraftStorageProvider = () => DraftStorage;
const browserDraftStorage: DraftStorageProvider = () => window.sessionStorage;

function boundedText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function records(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => item && typeof item === "object" ? [item as UnknownRecord] : []) : [];
}

export function publicAttemptQuestions(data: UnknownRecord) {
  return records(data.questions).flatMap((question) => {
    const questionId = boundedText(question.questionId, 100);
    const options = Array.isArray(question.options) ? question.options.map((option) => boundedText(option, 500)).filter(Boolean) : [];
    if (!questionId || options.length !== 4) return [];
    return [{
      questionId,
      subject: boundedText(question.subject, 180),
      topic: boundedText(question.topic, 180),
      format: boundedText(question.format, 60),
      prompt: boundedText(question.prompt, 2000),
      caseContext: boundedText(question.caseContext, 4000) || null,
      sourceMaterialTitle: boundedText(question.sourceMaterialTitle, 180) || null,
      sourceMaterialType: boundedText(question.sourceMaterialType, 60) || null,
      options,
    }];
  });
}

export function recoverableSimulatorAttempt(data: UnknownRecord, simulatorId: string, now = Date.now()) {
  const storedSimulatorId = boundedText(data.simulatorId, 100);
  const startedAt = boundedText(data.startedAt, 40);
  const expiresAt = Date.parse(boundedText(data.expiresAt, 40));
  const rawQuestions = records(data.questions);
  const questions = publicAttemptQuestions(data);
  if (
    !simulatorId ||
    storedSimulatorId !== simulatorId ||
    !startedAt ||
    !Number.isFinite(Date.parse(startedAt)) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    !rawQuestions.length ||
    questions.length !== rawQuestions.length
  ) return null;
  return { startedAt, questions };
}

export function simulatorDraftStorageKey(attemptId: string) {
  return `tutosebas:simulator:${boundedText(attemptId, 100)}`;
}

export function parseSimulatorDraft(value: string | null, questionIds: string[]) {
  const empty = { answers: {} as Record<string, number>, index: 0 };
  if (!value || value.length > 64_000) return empty;
  try {
    const parsed = JSON.parse(value) as UnknownRecord;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;
    const allowed = new Set(questionIds.map((item) => boundedText(item, 100)).filter(Boolean));
    const storedAnswers = parsed.answers && typeof parsed.answers === "object" && !Array.isArray(parsed.answers) ? parsed.answers as UnknownRecord : {};
    const answers = Object.fromEntries(Object.entries(storedAnswers).flatMap(([questionId, selected]) => {
      return allowed.has(questionId) && typeof selected === "number" && Number.isInteger(selected) && selected >= 0 && selected <= 3 ? [[questionId, selected]] : [];
    }));
    const storedIndex = parsed.index;
    const index = typeof storedIndex === "number" && Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < questionIds.length ? storedIndex : 0;
    return { answers, index };
  } catch {
    return empty;
  }
}

export function loadSimulatorDraft(attemptId: string, questionIds: string[], getStorage = browserDraftStorage) {
  try {
    const draft = parseSimulatorDraft(getStorage().getItem(simulatorDraftStorageKey(attemptId)), questionIds);
    return { ...draft, available: true };
  } catch {
    return { ...parseSimulatorDraft(null, questionIds), available: false };
  }
}

export function saveSimulatorDraft(attemptId: string, draft: SimulatorDraft, getStorage = browserDraftStorage) {
  try {
    getStorage().setItem(simulatorDraftStorageKey(attemptId), JSON.stringify({ answers: draft.answers, index: draft.index }));
    return true;
  } catch {
    return false;
  }
}

export function clearSimulatorDraft(attemptId: string, getStorage = browserDraftStorage) {
  try {
    getStorage().removeItem(simulatorDraftStorageKey(attemptId));
    return true;
  } catch {
    return false;
  }
}

export function gradeSimulatorAttempt(questionValue: unknown, answerValue: unknown, requestedPassScore: unknown) {
  const questions = records(questionValue);
  if (!questions.length) return { ok: false as const, error: "El intento no contiene preguntas válidas.", status: 409 };

  const questionIds = new Set(questions.map((question) => boundedText(question.questionId, 100)).filter(Boolean));
  if (questionIds.size !== questions.length) return { ok: false as const, error: "El intento contiene preguntas repetidas o inválidas.", status: 409 };

  const answerMap = new Map<string, number>();
  for (const answer of records(answerValue).slice(0, 400)) {
    const questionId = boundedText(answer.questionId, 100);
    const selectedIndex = answer.selectedIndex;
    if (questionIds.has(questionId) && typeof selectedIndex === "number" && Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex <= 3) answerMap.set(questionId, selectedIndex);
  }
  if (answerMap.size !== questions.length) return { ok: false as const, error: `Debes responder las ${questions.length} preguntas antes de finalizar.`, status: 400 };

  const review = [];
  for (const question of questions) {
    const questionId = boundedText(question.questionId, 100);
    const selectedIndex = answerMap.get(questionId);
    const correctIndex = Number(question.correctIndex);
    const options = Array.isArray(question.options) ? question.options.map((option) => boundedText(option, 500)).filter(Boolean) : [];
    if (selectedIndex === undefined || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      return { ok: false as const, error: "El intento contiene una respuesta no válida.", status: 409 };
    }
    review.push({
      questionId,
      subject: boundedText(question.subject, 180),
      topic: boundedText(question.topic, 180),
      format: boundedText(question.format, 60),
      prompt: boundedText(question.prompt, 2000),
      caseContext: boundedText(question.caseContext, 4000) || null,
      sourceMaterialTitle: boundedText(question.sourceMaterialTitle, 180) || null,
      sourceMaterialType: boundedText(question.sourceMaterialType, 60) || null,
      options,
      selectedIndex,
      correctIndex,
      correct: selectedIndex === correctIndex,
      explanation: boundedText(question.explanation, 2000),
      source: boundedText(question.source, 500),
    });
  }

  const correct = review.filter((answer) => answer.correct).length;
  const total = review.length;
  const score = Math.round((correct / total) * 2000) / 100;
  const numericPassScore = Number(requestedPassScore);
  const passScore = Number.isFinite(numericPassScore) && numericPassScore >= 0 && numericPassScore <= 20 ? numericPassScore : 14;
  return {
    ok: true as const,
    review,
    correct,
    total,
    score,
    passScore,
    passed: score >= passScore,
    answers: review.map(({ questionId, selectedIndex, correctIndex, correct: isCorrect, topic, subject }) => ({ questionId, selectedIndex, correctIndex, correct: isCorrect, topic, subject })),
  };
}
