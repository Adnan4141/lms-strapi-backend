type QuestionRow = {
  documentId: string;
  publishedAt?: string | Date | null;
  order?: number;
  quiz?: { documentId?: string } | null;
};

export function dedupeQuestionsByDocumentId<T extends QuestionRow>(rows: T[]): T[] {
  const byDocumentId = new Map<string, T>();

  for (const row of rows) {
    const existing = byDocumentId.get(row.documentId);
    if (!existing) {
      byDocumentId.set(row.documentId, row);
      continue;
    }

    const existingPublished = Boolean(existing.publishedAt);
    const rowPublished = Boolean(row.publishedAt);
    if (!existingPublished && rowPublished) {
      byDocumentId.set(row.documentId, row);
    }
  }

  return Array.from(byDocumentId.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function countQuestionsByQuiz(rows: QuestionRow[]): Map<string, number> {
  const grouped = new Map<string, QuestionRow[]>();

  for (const row of rows) {
    const quizDocId = row.quiz?.documentId;
    if (!quizDocId) {
      continue;
    }

    const bucket = grouped.get(quizDocId) ?? [];
    bucket.push(row);
    grouped.set(quizDocId, bucket);
  }

  const counts = new Map<string, number>();
  for (const [quizDocId, quizRows] of grouped.entries()) {
    counts.set(quizDocId, dedupeQuestionsByDocumentId(quizRows).length);
  }

  return counts;
}

export async function findQuizQuestions(
  strapi: any,
  quizId: string,
  select?: string[]
): Promise<any[]> {
  const fields = select
    ? Array.from(new Set([...select, 'documentId', 'order', 'publishedAt']))
    : ['documentId', 'text', 'options', 'order', 'correctAnswer', 'publishedAt'];

  const rows = await strapi.db.query('api::question.question').findMany({
    where: { quiz: { documentId: String(quizId) } },
    orderBy: { order: 'asc' },
    select: fields,
  });

  return dedupeQuestionsByDocumentId(rows);
}

export function calculateQuizScorePercent(score: number, totalQuestions: number) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return Math.round((score / totalQuestions) * 100);
}

export async function getQuestionCountByQuizIds(
  strapi: any,
  quizIds: string[]
): Promise<Map<string, number>> {
  if (quizIds.length === 0) {
    return new Map();
  }

  const rows = await strapi.db.query('api::question.question').findMany({
    where: { quiz: { documentId: { $in: quizIds.map(String) } } },
    select: ['documentId', 'publishedAt', 'order'],
    populate: {
      quiz: {
        select: ['documentId'],
      },
    },
  });

  return countQuestionsByQuiz(rows);
}

export function enrichQuizAttemptScores<T extends Record<string, any>>(
  attempt: T,
  questionCountByQuiz: Map<string, number>
): T & { totalQuestions: number; scorePercent: number } {
  const quizDocId = attempt.quiz?.documentId;
  const questionCount = quizDocId ? questionCountByQuiz.get(String(quizDocId)) ?? 0 : 0;
  const totalQuestions = questionCount > 0 ? questionCount : attempt.totalQuestions ?? 0;
  const score = attempt.score ?? 0;

  return {
    ...attempt,
    totalQuestions,
    scorePercent: calculateQuizScorePercent(score, totalQuestions),
  };
}

export async function enrichQuizAttempts(
  strapi: any,
  attempts: Record<string, any>[]
): Promise<Array<Record<string, any> & { totalQuestions: number; scorePercent: number }>> {
  if (attempts.length === 0) {
    return [];
  }

  const missingQuizAttempts = attempts.filter((attempt) => !attempt.quiz?.documentId);
  const quizByAttemptId = new Map<string, { documentId: string }>();

  if (missingQuizAttempts.length > 0) {
    const rows = await strapi.db.query('api::quiz-attempt.quiz-attempt').findMany({
      where: {
        documentId: {
          $in: missingQuizAttempts.map((attempt) => String(attempt.documentId)),
        },
      },
      populate: {
        quiz: {
          select: ['documentId'],
        },
      },
    });

    for (const row of rows) {
      if ((row as any).quiz?.documentId) {
        quizByAttemptId.set((row as any).documentId, (row as any).quiz);
      }
    }
  }

  const attemptsWithQuiz = attempts.map((attempt) => ({
    ...attempt,
    quiz: attempt.quiz?.documentId ? attempt.quiz : quizByAttemptId.get(attempt.documentId) ?? attempt.quiz,
  }));

  const quizIds = [
    ...new Set(
      attemptsWithQuiz
        .map((attempt) => attempt.quiz?.documentId)
        .filter((quizId): quizId is string => Boolean(quizId))
    ),
  ];

  const questionCountByQuiz = await getQuestionCountByQuizIds(strapi, quizIds);
  return attemptsWithQuiz.map((attempt) => enrichQuizAttemptScores(attempt, questionCountByQuiz));
}
