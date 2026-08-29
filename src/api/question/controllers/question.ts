import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::question.question', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized question creation attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to create questions.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const { quiz: quizId } = ctx.request.body.data || {};
      if (!quizId) {
        return ctx.badRequest('Quiz ID is required to create a question.');
      }

      const quiz = await strapi.documents('api::quiz.quiz').findOne({
        documentId: quizId,
        populate: ['course'],
      });

      if (!quiz || !quiz.course) {
        return ctx.notFound('Quiz or associated course not found.');
      }

      const isOwner = await isCourseOwner(quiz.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to add question to unowned course quiz ${quizId}.`);
        return ctx.forbidden('Instructors can only add questions to quizzes in their own courses.');
      }
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized question update attempt on ${id} by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to update questions.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const question = await strapi.documents('api::question.question').findOne({
        documentId: id,
        populate: ['quiz', 'quiz.course'],
      });

      if (!question || !question.quiz || !question.quiz.course) {
        return ctx.notFound('Question or associated course not found.');
      }

      const isOwner = await isCourseOwner(question.quiz.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to edit question ${id} in unowned course.`);
        return ctx.forbidden('Instructors can only edit questions in their own courses.');
      }
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized question deletion attempt on ${id} by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to delete questions.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const question = await strapi.documents('api::question.question').findOne({
        documentId: id,
        populate: ['quiz', 'quiz.course'],
      });

      if (!question || !question.quiz || !question.quiz.course) {
        return ctx.notFound('Question or associated course not found.');
      }

      const isOwner = await isCourseOwner(question.quiz.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to delete question ${id} from unowned course.`);
        return ctx.forbidden('Instructors can only delete questions from their own courses.');
      }
    }

    return super.delete(ctx);
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (['admin', 'content_manager'].includes(role)) {
      return super.find(ctx);
    }

    ctx.query = ctx.query || {};
    const existingFilters = ctx.query.filters ? [ctx.query.filters] : [];

    if (role === 'instructor' && ctx.state.user) {
      ctx.query.filters = {
        $and: [
          ...existingFilters,
          {
            $or: [
              { quiz: { course: { publishedAt: { $notNull: true } } } },
              { quiz: { course: { owner: { id: ctx.state.user.id } } } },
            ],
          },
        ],
      };
      return super.find(ctx);
    }

    if (role === 'student') {
      strapi.log.warn(
        `[Security] Student ${ctx.state.user?.id || 'guest'} attempted direct question list access.`
      );
      return ctx.forbidden(
        'Students must use GET /api/student/courses/:courseId/quizzes/:quizId to access quiz questions.'
      );
    }

    return ctx.forbidden();
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (role === 'student') {
      strapi.log.warn(
        `[Security] Student ${ctx.state.user?.id || 'guest'} attempted direct question access for ${id}.`
      );
      return ctx.forbidden(
        'Students must use GET /api/student/courses/:courseId/quizzes/:quizId to access quiz questions.'
      );
    }

    if (['admin', 'content_manager'].includes(role)) {
      return super.findOne(ctx);
    }

    const question = await strapi.documents('api::question.question').findOne({
      documentId: id,
      populate: ['quiz', 'quiz.course', 'quiz.course.owner'],
    });

    if (!question || !question.quiz || !question.quiz.course) {
      return ctx.notFound('Question not found.');
    }

    const isCoursePublished = Boolean(question.quiz.course.publishedAt);

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = (question.quiz.course.owner as any)?.id === ctx.state.user.id;
      if (!isCoursePublished && !isOwner) {
        return ctx.notFound('Question not found or not published.');
      }
      const sanitized = await this.sanitizeOutput(question, ctx);
      return this.transformResponse(sanitized);
    }

    return ctx.forbidden();
  },
}));
