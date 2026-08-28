import { factories } from '@strapi/strapi';
import { getUserRole, isEnrolled, StrapiContext } from '../../../utils/auth';
import { findQuizQuestions, enrichQuizAttemptScores, enrichQuizAttempts, getQuestionCountByQuizIds } from '../../../utils/quiz-questions';

export default factories.createCoreController('api::quiz-attempt.quiz-attempt', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    
    if (role !== 'student') {
      strapi.log.warn(`[Security] Unauthorized quiz attempt creation by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('Only students can take quizzes.');
    }

    const { quiz: quizId, answers } = ctx.request.body.data || {};
    if (!quizId) {
      return ctx.badRequest('Quiz ID is required to submit a quiz attempt.');
    }

    const quiz = await strapi.db.query('api::quiz.quiz').findOne({
      where: { documentId: String(quizId) },
      populate: {
        course: {
          select: ['documentId'],
        },
      },
    });

    if (!quiz || !(quiz as any).course) {
      return ctx.notFound('Quiz or associated course not found.');
    }

    const courseId = (quiz as any).course.documentId;

    if (ctx.state.user) {
      const enrolled = await isEnrolled(courseId, ctx.state.user.id);
      if (!enrolled) {
        strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to submit quiz attempt for un-enrolled course ${courseId}.`);
        return ctx.forbidden('You must be enrolled in the course to take its quiz.');
      }

  
      const existingAttempts = await strapi.db.query('api::quiz-attempt.quiz-attempt').findMany({
        where: {
          student: { id: ctx.state.user.id },
          quiz: { documentId: String(quizId) },
        },
      });

      if (existingAttempts.length > 0) {
        return ctx.badRequest('You have already submitted an attempt for this quiz.');
      }
    }

    let calculatedScore = 0;
    let totalQuestions = 0;

    if (Array.isArray(answers)) {
      const questions = await findQuizQuestions(strapi, String(quizId), [
        'documentId',
        'id',
        'correctAnswer',
      ]);

      totalQuestions = questions.length;

      for (const answer of answers) {
        const question = questions.find(
          (q: any) => q.documentId === answer.questionId || q.id === answer.questionId
        );

        if (question && Number(question.correctAnswer) === Number(answer.selectedOption)) {
          calculatedScore += 1;
        }
      }
    }

    if (ctx.state.user) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        student: ctx.state.user.id,
        course: courseId,
        score: calculatedScore,
        totalQuestions,
        submittedAt: new Date(),
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    strapi.log.warn(`[Security] Attempt to modify quiz attempt ${ctx.params?.id} by user ${ctx.state.user?.id || 'guest'}`);
    return ctx.forbidden('Quiz attempt submissions cannot be modified.');
  },

  async delete(ctx: StrapiContext) {
    strapi.log.warn(`[Security] Attempt to delete quiz attempt ${ctx.params?.id} by user ${ctx.state.user?.id || 'guest'}`);
    return ctx.forbidden('Quiz attempt records cannot be deleted.');
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    ctx.query = ctx.query || {};
    if (['admin', 'content_manager'].includes(role)) {
      return super.find(ctx);
    }

    const existingFilters = ctx.query.filters ? [ctx.query.filters] : [];

    if (role === 'student' && ctx.state.user) {
      ctx.query.filters = {
        $and: [
          ...existingFilters,
          {
            student: {
              id: ctx.state.user.id,
            },
          },
        ],
      };

      await super.find(ctx);

      const attempts = Array.isArray(ctx.body?.data) ? ctx.body.data : [];
      if (attempts.length === 0) {
        return ctx.body;
      }

      ctx.body = {
        ...ctx.body,
        data: await enrichQuizAttempts(strapi, attempts),
      };

      return ctx.body;
    }

    if (role === 'instructor' && ctx.state.user) {
      ctx.query.filters = {
        $and: [
          ...existingFilters,
          {
            quiz: {
              course: {
                owner: {
                  id: ctx.state.user.id,
                },
              },
            },
          },
        ],
      };
      return super.find(ctx);
    }

    return ctx.forbidden();
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return super.findOne(ctx);
    }

   
    const attempt = await strapi.documents('api::quiz-attempt.quiz-attempt').findOne({
      documentId: id,
      populate: ['student', 'quiz', 'quiz.course', 'quiz.course.owner'],
    });

    if (!attempt) {
      return ctx.notFound('Quiz attempt not found.');
    }

    if (role === 'student' && ctx.state.user) {
      if (attempt.student?.id !== ctx.state.user.id) {
        strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to view attempt ${id} of another user.`);
        return ctx.forbidden('You can only view your own quiz attempts.');
      }

      const quizDocId = (attempt as any).quiz?.documentId;
      const questionCountByQuiz = quizDocId
        ? await getQuestionCountByQuizIds(strapi, [String(quizDocId)])
        : new Map<string, number>();
      const enriched = enrichQuizAttemptScores(attempt, questionCountByQuiz);
      const sanitized = await this.sanitizeOutput(enriched, ctx);
      return this.transformResponse(sanitized);
    }

    if (role === 'instructor' && ctx.state.user) {
      if (!attempt.quiz || !attempt.quiz.course) {
        return ctx.forbidden();
      }
      const courseOwnerId = (attempt.quiz.course as any)?.owner?.id;
      if (courseOwnerId !== ctx.state.user.id) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to view attempt ${id} for unowned course.`);
        return ctx.forbidden('You do not own the course this quiz attempt belongs to.');
      }
      const sanitized = await this.sanitizeOutput(attempt, ctx);
      return this.transformResponse(sanitized);
    }

    return ctx.forbidden();
  },

  async getStudentQuizReview(ctx: StrapiContext) {
    const { quizId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' || !ctx.state.user) {
      return ctx.forbidden('Only students can review their quiz attempts.');
    }

    const attempt = await strapi.db.query('api::quiz-attempt.quiz-attempt').findOne({
      where: {
        student: { id: ctx.state.user.id },
        quiz: { documentId: String(quizId) },
      },
      populate: {
        quiz: {
          select: ['documentId', 'title'],
        },
        course: {
          select: ['documentId', 'title'],
        },
      },
    });

    if (!attempt) {
      return ctx.notFound('No submitted attempt found for this quiz.');
    }

    const questions = await findQuizQuestions(strapi, String(quizId), [
      'documentId',
      'text',
      'options',
      'correctAnswer',
      'order',
      'id',
    ]);

    const answers = Array.isArray((attempt as any).answers) ? (attempt as any).answers : [];
    const totalQuestions = questions.length;
    const score = (attempt as any).score ?? 0;

    const questionReview = questions.map((question: any) => {
      const selected = answers.find(
        (answer: any) =>
          String(answer.questionId) === String(question.documentId) ||
          String(answer.questionId) === String(question.id)
      );

      const selectedOption =
        selected?.selectedOption !== undefined ? Number(selected.selectedOption) : null;
      const correctOption = Number(question.correctAnswer);

      return {
        documentId: question.documentId,
        text: question.text,
        options: question.options,
        selectedOption,
        correctOption,
        isCorrect: selectedOption !== null && selectedOption === correctOption,
      };
    });

    ctx.body = {
      quiz: {
        documentId: (attempt as any).quiz?.documentId ?? quizId,
        title: (attempt as any).quiz?.title ?? 'Quiz',
      },
      course: (attempt as any).course
        ? {
            documentId: (attempt as any).course.documentId,
            title: (attempt as any).course.title,
          }
        : null,
      score,
      totalQuestions,
      submittedAt: (attempt as any).submittedAt,
      questions: questionReview,
    };
  },
}));
