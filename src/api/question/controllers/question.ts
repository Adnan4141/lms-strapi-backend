import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, StrapiContext } from '../../../utils/auth';

function stripCorrectAnswer(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripCorrectAnswer);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const cleaned: Record<string, any> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === 'correctAnswer') {
      continue;
    }

    cleaned[key] = stripCorrectAnswer(nestedValue);
  }

  return cleaned;
}

export default factories.createCoreController('api::question.question', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
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
        return ctx.forbidden('Instructors can only add questions to quizzes in their own courses.');
      }
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
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
        return ctx.forbidden('Instructors can only edit questions in their own courses.');
      }
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
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
        return ctx.forbidden('Instructors can only delete questions from their own courses.');
      }
    }

    return super.delete(ctx);
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    const response = await super.find(ctx);

    if (role === 'student' && response?.data) {
      response.data = stripCorrectAnswer(response.data);
    }

    return response;
  },

  async findOne(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    const response = await super.findOne(ctx);

    if (role === 'student' && response?.data) {
      response.data = stripCorrectAnswer(response.data);
    }

    return response;
  },
}));
