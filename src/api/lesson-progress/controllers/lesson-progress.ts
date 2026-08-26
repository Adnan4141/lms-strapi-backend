import { factories } from '@strapi/strapi';
import { getUserRole, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::lesson-progress.lesson-progress', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      return ctx.forbidden('Only students can track lesson progress.');
    }

    if (ctx.state.user) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        student: ctx.state.user.id,
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      return ctx.forbidden('Only students can update lesson progress.');
    }

    const progress = await strapi.documents('api::lesson-progress.lesson-progress').findOne({
      documentId: id,
      populate: ['student'],
    });

    if (!progress) {
      return ctx.notFound('Progress record not found.');
    }

    if (ctx.state.user && progress.student?.id !== ctx.state.user.id) {
      return ctx.forbidden('You can only update your own progress records.');
    }

    if (ctx.state.user && ctx.request.body.data) {
      ctx.request.body.data.student = ctx.state.user.id;
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    return ctx.forbidden('Progress records cannot be deleted.');
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
        lesson: {
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

    const progress = await strapi.documents('api::lesson-progress.lesson-progress').findOne({
      documentId: id,
      populate: ['student', 'lesson', 'lesson.course'],
    });

    if (!progress) {
      return ctx.notFound('Progress record not found.');
    }

    if (role === 'student' && ctx.state.user) {
      if (progress.student?.id !== ctx.state.user.id) {
        return ctx.forbidden('You can only view your own progress records.');
      }
      return super.findOne(ctx);
    }

    if (role === 'instructor' && ctx.state.user) {
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
      return super.findOne(ctx);
    }

    return ctx.forbidden();
  },

  async getCourseProgress(ctx: StrapiContext) {
    const { courseId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' && !['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('Access denied to course progress details.');
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

    const lessonIds = lessons.map((lesson: any) => lesson.documentId);

    const completedProgress = ctx.state.user
      ? await strapi.documents('api::lesson-progress.lesson-progress').findMany({
          filters: {
            student: { id: ctx.state.user.id },
            isCompleted: true,
            lesson: { documentId: { $in: lessonIds } },
          },
        })
      : [];

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
