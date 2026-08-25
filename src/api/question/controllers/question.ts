import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner } from '../../../utils/auth';

export default factories.createCoreController('api::question.question', ({ strapi }) => ({
  async create(ctx) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to create questions.');
    }

    if (role === 'instructor') {
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

    return await super.create(ctx);
  },

  async update(ctx) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to update questions.');
    }

    if (role === 'instructor') {
      const question = await strapi.documents('api::question.question').findOne({
        documentId: id,
        populate: ['quiz', 'quiz.course'],
      });
      if (!question || !question.quiz || !question.quiz.course) {
        return ctx.notFound('Question or associated course not found.');
      }
      const isOwner = await isCourseOwner(question.quiz.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only update questions in their own courses.');
      }
    }

    return await super.update(ctx);
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to delete questions.');
    }

    if (role === 'instructor') {
      const question = await strapi.documents('api::question.question').findOne({
        documentId: id,
        populate: ['quiz', 'quiz.course'],
      });
      if (!question || !question.quiz || !question.quiz.course) {
        return ctx.notFound('Question or associated course not found.');
      }
      const isOwner = await isCourseOwner(question.quiz.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only delete questions in their own courses.');
      }
    }

    return await super.delete(ctx);
  },

  async find(ctx) {
    const role = await getUserRole(ctx);
    const response = await super.find(ctx);

    if (role === 'student') {
      if (response && response.data) {
        if (Array.isArray(response.data)) {
          response.data = response.data.map((item: any) => {
            if (item.correctAnswer !== undefined) delete item.correctAnswer;
            if (item.attributes && item.attributes.correctAnswer !== undefined) {
              delete item.attributes.correctAnswer;
            }
            return item;
          });
        }
      }
    }

    return response;
  },

  async findOne(ctx) {
    const role = await getUserRole(ctx);
    const response = await super.findOne(ctx);

    if (role === 'student') {
      if (response && response.data) {
        const item = response.data;
        if (item.correctAnswer !== undefined) delete item.correctAnswer;
        if (item.attributes && item.attributes.correctAnswer !== undefined) {
          delete item.attributes.correctAnswer;
        }
      }
    }

    return response;
  },
}));
