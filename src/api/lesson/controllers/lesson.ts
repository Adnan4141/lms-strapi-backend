import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, isEnrolled, StrapiContext } from '../../../utils/auth';
import { dedupeQuestionsByDocumentId } from '../../../utils/quiz-questions';

function dedupeLessonsByDocumentId<T extends { documentId: string; order?: number; publishedAt?: string | Date | null }>(
  rows: T[]
): T[] {
  return dedupeQuestionsByDocumentId(rows);
}

export default factories.createCoreController('api::lesson.lesson', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized lesson creation attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to create lessons.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const { course: courseId } = ctx.request.body.data || {};
      if (!courseId) {
        return ctx.badRequest('Course ID is required to create a lesson.');
      }
      const isOwner = await isCourseOwner(courseId, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to add lesson to unowned course ${courseId}.`);
        return ctx.forbidden('Instructors can only add lessons to their own courses.');
      }
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized lesson update attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
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
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to update lesson ${id} in unowned course.`);
        return ctx.forbidden('Instructors can only edit lessons in their own courses.');
      }
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized lesson deletion attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
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
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to delete lesson ${id} in unowned course.`);
        return ctx.forbidden('Instructors can only delete lessons from their own courses.');
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
              { course: { publishedAt: { $notNull: true } } },
              { course: { owner: { id: ctx.state.user.id } } },
            ],
          },
        ],
      };
      return super.find(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      ctx.query.filters = {
        $and: [
          ...existingFilters,
          {
            course: {
              publishedAt: { $notNull: true },
              enrollments: {
                student: { id: ctx.state.user.id },
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

    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: { documentId: String(id) },
      populate: {
        course: {
          populate: ['owner'],
        },
      },
    });

    if (!lesson || !lesson.course) {
      return ctx.notFound('Lesson not found.');
    }

    const isCoursePublished = Boolean(lesson.course.publishedAt);

    if (role === 'instructor' && ctx.state.user) {
      const isCourseOwnerUser = (lesson.course.owner as any)?.id === ctx.state.user.id;
      if (!isCoursePublished && !isCourseOwnerUser) {
        return ctx.notFound('Lesson not found or not published.');
      }
      const sanitized = await this.sanitizeOutput(lesson, ctx);
      return this.transformResponse(sanitized);
    }

    if (role === 'student' && ctx.state.user) {
      if (!isCoursePublished) {
        return ctx.notFound('Lesson not found or not published.');
      }

      const enrolled = await isEnrolled(lesson.course.documentId, ctx.state.user.id);
      if (!enrolled) {
        strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to view lesson ${id} without course enrollment.`);
        return ctx.forbidden('You must be enrolled in this course to view its lessons.');
      }

      const sanitized = await this.sanitizeOutput(lesson, ctx);
      return this.transformResponse(sanitized);
    }

    return ctx.forbidden();
  },

  async reorderCourseLessons(ctx: StrapiContext) {
    const { courseId } = ctx.params;
    const lessonIds = ctx.request.body?.lessonIds;

    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      return ctx.badRequest('lessonIds must be a non-empty array.');
    }

    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You do not have permission to reorder lessons.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(String(courseId), ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only reorder lessons in their own courses.');
      }
    }

    const rows = await strapi.db.query('api::lesson.lesson').findMany({
      where: { course: { documentId: String(courseId) } },
      select: ['documentId', 'order', 'publishedAt'],
    });

    const lessons = dedupeLessonsByDocumentId(rows);
    const existingIds = new Set(lessons.map((lesson: any) => String(lesson.documentId)));
    const requestedIds = lessonIds.map(String);

    if (requestedIds.length !== existingIds.size) {
      return ctx.badRequest('lessonIds must include every lesson in this course exactly once.');
    }

    const uniqueRequested = new Set(requestedIds);
    if (uniqueRequested.size !== requestedIds.length) {
      return ctx.badRequest('lessonIds cannot contain duplicates.');
    }

    for (const lessonId of requestedIds) {
      if (!existingIds.has(lessonId)) {
        return ctx.badRequest(`Lesson ${lessonId} does not belong to this course.`);
      }
    }

    await Promise.all(
      requestedIds.map((documentId, index) =>
        strapi.documents('api::lesson.lesson').update({
          documentId,
          data: { order: index + 1 },
        })
      )
    );

    ctx.body = {
      ok: true,
      lessons: requestedIds.map((documentId, index) => ({
        documentId,
        order: index + 1,
      })),
    };
  },
}));
