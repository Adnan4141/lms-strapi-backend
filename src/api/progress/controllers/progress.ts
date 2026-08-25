import { factories } from '@strapi/strapi';
import { getUserRole } from '../../../utils/auth';

export default factories.createCoreController('api::progress.progress', ({ strapi }) => ({
  async create(ctx) {
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      return ctx.forbidden('Only students can create progress records.');
    }

    ctx.request.body.data = {
      ...ctx.request.body.data,
      student: ctx.state.user.id,
    };

    return await super.create(ctx);
  },

  async update(ctx) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      return ctx.forbidden('Only students can update progress records.');
    }

    const progress = await strapi.documents('api::progress.progress').findOne({
      documentId: id,
      populate: ['student'],
    });

    if (!progress) {
      return ctx.notFound('Progress record not found.');
    }

    if (progress.student?.id !== ctx.state.user.id) {
      return ctx.forbidden('You can only update your own progress records.');
    }

    if (ctx.request.body.data) {
      ctx.request.body.data.student = ctx.state.user.id;
    }

    return await super.update(ctx);
  },

  async delete(ctx) {
    return ctx.forbidden('Deleting progress records is not allowed.');
  },

  async find(ctx) {
    const role = await getUserRole(ctx);

    ctx.query = ctx.query || {};
    if (['admin', 'content_manager'].includes(role)) {
      return await super.find(ctx);
    }

    if (role === 'student') {
      ctx.query.filters = {
        ...((ctx.query.filters as any) || {}),
        student: {
          id: ctx.state.user.id,
        },
      };
      return await super.find(ctx);
    }

    if (role === 'instructor') {
      const courses = await strapi.documents('api::course.course').findMany({
        filters: { owner: { id: ctx.state.user.id } },
      });
      const courseIds = courses.map((c: any) => c.documentId).filter(Boolean);

      ctx.query.filters = {
        ...((ctx.query.filters as any) || {}),
        lesson: {
          course: {
            documentId: {
              $in: courseIds,
            },
          },
        },
      };
      return await super.find(ctx);
    }

    return ctx.forbidden();
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return await super.findOne(ctx);
    }

    const progress = await strapi.documents('api::progress.progress').findOne({
      documentId: id,
      populate: ['student', 'lesson', 'lesson.course'],
    });

    if (!progress) {
      return ctx.notFound();
    }

    if (role === 'student') {
      if (progress.student?.id !== ctx.state.user.id) {
        return ctx.forbidden('You can only view your own progress records.');
      }
      return await super.findOne(ctx);
    }

    if (role === 'instructor') {
      if (!progress.lesson || !progress.lesson.course) {
        return ctx.forbidden();
      }
      const course = await strapi.documents('api::course.course').findOne({
        documentId: progress.lesson.course.documentId,
        populate: ['owner'],
      });
      if (course?.owner?.id !== ctx.state.user.id) {
        return ctx.forbidden('You do not own the course this progress record belongs to.');
      }
      return await super.findOne(ctx);
    }

    return ctx.forbidden();
  },

  async getCourseProgress(ctx) {
    const { courseId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' && !['admin', 'content_manager'].includes(role)) {
      return ctx.forbidden('Unauthorized access to course progress.');
    }

    const lessons = await strapi.documents('api::lesson.lesson').findMany({
      filters: { course: { documentId: String(courseId) } },
    });

    const totalLessons = lessons.length;
    if (totalLessons === 0) {
      return {
        courseId,
        totalLessons: 0,
        completedLessons: 0,
        percentage: 0,
      };
    }

    const lessonIds = lessons.map((l: any) => l.documentId);

    const completedProgress = await strapi.documents('api::progress.progress').findMany({
      filters: {
        student: { id: ctx.state.user.id },
        isCompleted: true,
        lesson: { documentId: { $in: lessonIds } },
      },
    });

    const completedLessons = completedProgress.length;
    const percentage = Math.round((completedLessons / totalLessons) * 100);

    return {
      courseId,
      totalLessons,
      completedLessons,
      percentage,
    };
  },
}));
