/** Fields safe to expose to students before quiz submission. */
export const PUBLIC_QUESTION_FIELDS = ['documentId', 'text', 'options', 'order'] as const;

export type PublicQuestion = {
  documentId: string;
  text: string;
  options: string[];
  order: number;
};

function pickPublicQuestionFields(q: Record<string, unknown>): PublicQuestion {
  return {
    documentId: String(q.documentId ?? ''),
    text: String(q.text ?? ''),
    options: Array.isArray(q.options) ? q.options.map(String) : [],
    order: typeof q.order === 'number' ? q.order : Number(q.order) || 0,
  };
}

export function toPublicQuestion(q: Record<string, unknown>): PublicQuestion {
  return pickPublicQuestionFields(q);
}

export function toPublicQuestions(list: Record<string, unknown>[]): PublicQuestion[] {
  return list.map(toPublicQuestion);
}

/** Remove or sanitize nested questions on quiz payloads for student-facing responses. */
export function stripQuizNestedQuestions<T extends Record<string, unknown>>(quiz: T): T {
  if (!quiz.questions) {
    return quiz;
  }

  const questions = quiz.questions;
  if (Array.isArray(questions)) {
    return {
      ...quiz,
      questions: toPublicQuestions(questions as Record<string, unknown>[]),
    };
  }

  const { questions: _removed, ...rest } = quiz;
  return rest as T;
}

export function stripQuizzesNestedQuestions<T extends Record<string, unknown>>(
  quizzes: T[]
): T[] {
  return quizzes.map((quiz) => stripQuizNestedQuestions(quiz));
}

/** Strapi REST entity or flat quiz payload — strip answers for student list responses. */
export function stripQuizRecordForStudent(quiz: Record<string, unknown>): Record<string, unknown> {
  if (quiz.attributes && typeof quiz.attributes === 'object') {
    return {
      ...quiz,
      attributes: stripQuizNestedQuestions(quiz.attributes as Record<string, unknown>),
    };
  }
  return stripQuizNestedQuestions(quiz);
}

export function stripQuizListForStudent(quizzes: Record<string, unknown>[]): Record<string, unknown>[] {
  return quizzes.map(stripQuizRecordForStudent);
}
