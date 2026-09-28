type UnknownRecord = Record<string, unknown>;

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

export function gradeSimulatorAttempt(questionValue: unknown, answerValue: unknown, requestedPassScore: unknown) {
  const questions = records(questionValue);
  if (!questions.length) return { ok: false as const, error: "El intento no contiene preguntas válidas.", status: 409 };

  const questionIds = new Set(questions.map((question) => boundedText(question.questionId, 100)).filter(Boolean));
  if (questionIds.size !== questions.length) return { ok: false as const, error: "El intento contiene preguntas repetidas o inválidas.", status: 409 };

  const answerMap = new Map<string, number>();
  for (const answer of records(answerValue).slice(0, 400)) {
    const questionId = boundedText(answer.questionId, 100);
    const selectedIndex = Number(answer.selectedIndex);
    if (questionIds.has(questionId) && Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex <= 3) answerMap.set(questionId, selectedIndex);
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
