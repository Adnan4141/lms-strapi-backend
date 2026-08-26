import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, isEnrolled, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::lesson.lesson', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You do not have permission to create lessons.');
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

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You do not have permission to update lessons.');
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
        return ctx.forbidden('Instructors can only edit lessons in their own courses.');
      }
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You do not have permission to delete lessons.');
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
        return ctx.forbidden('Instructors can only delete lessons from their own courses.');
      }
    }

    return super.delete(ctx);
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (['admin', 'content_manager', 'instructor'].includes(role)) {
      return super.find(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
        filters: { student: { id: ctx.state.user.id } },
        populate: ['course'],
      });

      const enrolledCourseIds = enrollments.map((item: any) => item.course?.documentId).filter(Boolean);

      ctx.query = ctx.query || {};
      ctx.query.filters = {
        ...(ctx.query.filters || {}),
        course: {
          documentId: {
            $in: enrolledCourseIds,
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

    if (['admin', 'content_manager', 'instructor'].includes(role)) {
      return super.findOne(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      const lesson = await strapi.documents('api::lesson.lesson').findOne({
        documentId: id,
        populate: ['course'],
      });

      if (!lesson || !lesson.course) {
        return ctx.notFound('Lesson not found.');
      }

      const enrolled = await isEnrolled(lesson.course.documentId, ctx.state.user.id);
      if (!enrolled) {
        return ctx.forbidden('You must be enrolled in this course to view its lessons.');
      }

      return super.findOne(ctx);
    }

    return ctx.forbidden();
  },
}));
