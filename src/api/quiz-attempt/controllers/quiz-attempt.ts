import { factories } from '@strapi/strapi';
import { getUserRole, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::quiz-attempt.quiz-attempt', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      return ctx.forbidden('Only students can take quizzes.');
    }

    const { quiz: quizId, answers } = ctx.request.body.data || {};
    if (!quizId) {
      return ctx.badRequest('Quiz ID is required to submit a quiz attempt.');
    }

    let calculatedScore = 0;
    let totalQuestions = 0;

    if (Array.isArray(answers)) {
      const questions = await strapi.documents('api::question.question').findMany({
        filters: { quiz: { documentId: quizId } },
      });

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
        score: calculatedScore,
        totalQuestions,
        submittedAt: new Date(),
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    return ctx.forbidden('Quiz attempt submissions cannot be modified.');
  },

  async delete(ctx: StrapiContext) {
    return ctx.forbidden('Quiz attempt records cannot be deleted.');
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    ctx.query = ctx.query || {};
    if (['admin', 'content_manager'].includes(role)) {
      return super.find(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      ctx.query.filters = {
        ...(ctx.query.filters || {}),
        student: {
          id: ctx.state.user.id,
        },
      };
      return super.find(ctx);
    }

    if (role === 'instructor' && ctx.state.user) {
      const courses = await strapi.documents('api::course.course').findMany({
        filters: { owner: { id: ctx.state.user.id } },
      });
      const courseIds = courses.map((course: any) => course.documentId).filter(Boolean);

      ctx.query.filters = {
        ...(ctx.query.filters || {}),
        quiz: {
          course: {
            documentId: {
              $in: courseIds,
            },
          },
        },
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
      populate: ['student', 'quiz', 'quiz.course'],
    });

    if (!attempt) {
      return ctx.notFound('Quiz attempt not found.');
    }

    if (role === 'student' && ctx.state.user) {
      if (attempt.student?.id !== ctx.state.user.id) {
        return ctx.forbidden('You can only view your own quiz attempts.');
      }
      return super.findOne(ctx);
    }

    if (role === 'instructor' && ctx.state.user) {
      if (!attempt.quiz || !attempt.quiz.course) {
        return ctx.forbidden();
      }
      const course = await strapi.documents('api::course.course').findOne({
        documentId: attempt.quiz.course.documentId,
        populate: ['owner'],
      });
      if (course?.owner?.id !== ctx.state.user.id) {
        return ctx.forbidden('You do not own the course this quiz attempt belongs to.');
      }
      return super.findOne(ctx);
    }

    return ctx.forbidden();
  },
}));
