import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, isEnrolled, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::quiz.quiz', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to create quizzes.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const { course: courseId } = ctx.request.body.data || {};
      if (!courseId) {
        return ctx.badRequest('Course ID is required to create a quiz.');
      }
      const isOwner = await isCourseOwner(courseId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only create quizzes for their own courses.');
      }
    }

    return await super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to update quizzes.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const quiz = await strapi.documents('api::quiz.quiz').findOne({
        documentId: id,
        populate: ['course'],
      });
      if (!quiz || !quiz.course) {
        return ctx.notFound('Quiz or associated course not found.');
      }
      const isOwner = await isCourseOwner(quiz.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only update quizzes for their own courses.');
      }
    }

    return await super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to delete quizzes.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const quiz = await strapi.documents('api::quiz.quiz').findOne({
        documentId: id,
        populate: ['course'],
      });
      if (!quiz || !quiz.course) {
        return ctx.notFound('Quiz or associated course not found.');
      }
      const isOwner = await isCourseOwner(quiz.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only delete quizzes for their own courses.');
      }
    }

    return await super.delete(ctx);
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (['admin', 'content_manager', 'instructor'].includes(role)) {
      return await super.find(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
        filters: { student: { id: ctx.state.user.id } },
        populate: ['course'],
      });

      const enrolledCourseIds = enrollments.map((e: any) => e.course?.documentId).filter(Boolean);

      ctx.query = ctx.query || {};
      ctx.query.filters = {
        ...((ctx.query.filters as any) || {}),
        course: {
          documentId: {
            $in: enrolledCourseIds,
          },
        },
      };

      return await super.find(ctx);
    }

    return ctx.forbidden();
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager', 'instructor'].includes(role)) {
      return await super.findOne(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      const quiz = await strapi.documents('api::quiz.quiz').findOne({
        documentId: id,
        populate: ['course'],
      });

      if (!quiz || !quiz.course) {
        return ctx.notFound();
      }

      const enrolled = await isEnrolled(quiz.course.documentId, ctx.state.user.id);
      if (!enrolled) {
        return ctx.forbidden('You are not enrolled in the course this quiz belongs to.');
      }

      return await super.findOne(ctx);
    }

    return ctx.forbidden();
  },



async test(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);


    return { message: `Test endpoint accessed by user with role: ${role} for quiz ID: ${id}` };
}






}));
