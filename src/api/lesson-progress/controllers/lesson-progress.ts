import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, isEnrolled, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::lesson-progress.lesson-progress', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      strapi.log.warn(`[Security] Unauthorized progress creation attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('Only students can track lesson progress.');
    }

    const { lesson: lessonId } = ctx.request.body.data || {};
    if (!lessonId) {
      return ctx.badRequest('Lesson ID is required to record progress.');
    }

    const lesson = await strapi.documents('api::lesson.lesson').findOne({
      documentId: lessonId,
      populate: ['course'],
    });

    if (!lesson || !lesson.course) {
      return ctx.notFound('Lesson or parent course not found.');
    }

    const courseId = lesson.course.documentId;

    if (ctx.state.user) {
      const enrolled = await isEnrolled(courseId, ctx.state.user.id);
      if (!enrolled) {
        strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to record progress in un-enrolled course ${courseId}.`);
        return ctx.forbidden('You must be enrolled in the course to record lesson progress.');
      }

      // Guard against duplicate progress records for same (student, lesson)
      const existingProgress = await strapi.documents('api::lesson-progress.lesson-progress').findMany({
        filters: {
          student: { id: ctx.state.user.id },
          lesson: { documentId: lessonId },
        },
      });

      if (existingProgress.length > 0) {
        // Update existing progress record instead of creating duplicate row
        const updated = await strapi.documents('api::lesson-progress.lesson-progress').update({
          documentId: existingProgress[0].documentId,
          data: {
            isCompleted: ctx.request.body.data?.isCompleted ?? true,
            completedAt: new Date(),
          },
        });
        const sanitized = await this.sanitizeOutput(updated, ctx);
        return this.transformResponse(sanitized);
      }

      ctx.request.body.data = {
        ...ctx.request.body.data,
        student: ctx.state.user.id,
        course: courseId,
        isCompleted: ctx.request.body.data?.isCompleted ?? true,
        completedAt: new Date(),
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      strapi.log.warn(`[Security] Unauthorized progress update attempt on ${id} by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
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
      strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to edit progress ${id} owned by user ${progress.student?.id}.`);
      return ctx.forbidden('You can only update your own progress records.');
    }

    if (ctx.state.user && ctx.request.body.data) {
      ctx.request.body.data.student = ctx.state.user.id;
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    strapi.log.warn(`[Security] Unauthorized progress deletion attempt by user ${ctx.state.user?.id || 'guest'}`);
    return ctx.forbidden('Progress records cannot be deleted.');
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
      return super.find(ctx);
    }

    if (role === 'instructor' && ctx.state.user) {
      ctx.query.filters = {
        $and: [
          ...existingFilters,
          {
            lesson: {
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

    // Single Query Optimization: Deep populate lesson.course.owner to eliminate 2nd DB call
    const progress = await strapi.documents('api::lesson-progress.lesson-progress').findOne({
      documentId: id,
      populate: ['student', 'lesson', 'lesson.course', 'lesson.course.owner'],
    });

    if (!progress) {
      return ctx.notFound('Progress record not found.');
    }

    if (role === 'student' && ctx.state.user) {
      if (progress.student?.id !== ctx.state.user.id) {
        strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to access progress record ${id} of another user.`);
        return ctx.forbidden('You can only view your own progress records.');
      }
      const sanitized = await this.sanitizeOutput(progress, ctx);
      return this.transformResponse(sanitized);
    }

    if (role === 'instructor' && ctx.state.user) {
      if (!progress.lesson || !progress.lesson.course) {
        return ctx.forbidden();
      }
      const courseOwnerId = (progress.lesson.course as any)?.owner?.id;
      if (courseOwnerId !== ctx.state.user.id) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to access progress ${id} in unowned course.`);
        return ctx.forbidden('You do not own the course this progress record belongs to.');
      }
      const sanitized = await this.sanitizeOutput(progress, ctx);
      return this.transformResponse(sanitized);
    }

    return ctx.forbidden();
  },

  async getCourseProgress(ctx: StrapiContext) {
    const { courseId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' && !['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized getCourseProgress attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('Access denied to course progress details.');
    }

    let targetUserId = ctx.state.user?.id;
    const queryStudentId = ctx.query?.studentId ? Number(ctx.query.studentId) : null;

    if (['admin', 'content_manager', 'instructor'].includes(role)) {
      if (role === 'instructor' && ctx.state.user) {
        const isOwner = await isCourseOwner(courseId, ctx.state.user.id);
        if (!isOwner) {
          return ctx.forbidden('Instructors can only view student progress for their own courses.');
        }
      }

      if (queryStudentId) {
        targetUserId = queryStudentId;
      }
    }

    if (!targetUserId) {
      return ctx.badRequest('Student ID is required to calculate progress.');
    }

    const lessons = await strapi.documents('api::lesson.lesson').findMany({
      filters: { course: { documentId: String(courseId) } },
    });

    const totalLessons = lessons.length;
    if (totalLessons === 0) {
      return {
        courseId,
        targetUserId,
        totalLessons: 0,
        completedLessons: 0,
        percentage: 0,
      };
    }

    const lessonIds = lessons.map((lesson: any) => lesson.documentId);

    const completedProgress = await strapi.documents('api::lesson-progress.lesson-progress').findMany({
      filters: {
        student: { id: targetUserId },
        isCompleted: true,
        lesson: { documentId: { $in: lessonIds } },
      },
    });

    const completedLessons = completedProgress.length;
    const percentage = Math.round((completedLessons / totalLessons) * 100);

    return {
      courseId,
      targetUserId,
      totalLessons,
      completedLessons,
      percentage,
    };
  },
}));
