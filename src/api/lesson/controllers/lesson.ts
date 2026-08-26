import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, isEnrolled, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::lesson.lesson', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to create lessons.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const { course: courseId } = ctx.request.body.data || {};
      if (!courseId) {
        return ctx.badRequest('Course ID is required to create a lesson.');
      }
      const isOwner = await isCourseOwner(courseId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only add lessons to their own courses.');
      }
    }

    return await super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to update lessons.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const lesson = await strapi.documents('api::lesson.lesson').findOne({
        documentId: id,
        populate: ['course'],
      });
      if (!lesson || !lesson.course) {
        return ctx.notFound('Lesson or associated course not found.');
      }
      const isOwner = await isCourseOwner(lesson.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only update lessons of their own courses.');
      }
    }

    return await super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to delete lessons.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const lesson = await strapi.documents('api::lesson.lesson').findOne({
        documentId: id,
        populate: ['course'],
      });
      if (!lesson || !lesson.course) {
        return ctx.notFound('Lesson or associated course not found.');
      }
      const isOwner = await isCourseOwner(lesson.course.documentId, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only delete lessons of their own courses.');
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
      const lesson = await strapi.documents('api::lesson.lesson').findOne({
        documentId: id,
        populate: ['course'],
      });

      if (!lesson || !lesson.course) {
        return ctx.notFound();
      }

      const enrolled = await isEnrolled(lesson.course.documentId, ctx.state.user.id);
      if (!enrolled) {
        return ctx.forbidden('You are not enrolled in the course this lesson belongs to.');
      }

      return await super.findOne(ctx);
    }

    return ctx.forbidden();
  },
}));
