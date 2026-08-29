import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, isEnrolled, StrapiContext } from '../../../utils/auth';
import { stripQuizListForStudent, stripQuizNestedQuestions } from '../../../utils/question-sanitize';

function stripQuestionPopulateFromQuery(query: Record<string, unknown>) {
  const populate = query.populate;
  if (!populate) {
    return;
  }

  if (typeof populate === 'string') {
    const parts = populate
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && part !== 'questions');
    if (parts.length > 0) {
      query.populate = parts.join(',');
    } else {
      delete query.populate;
    }
    return;
  }

  if (typeof populate === 'object' && populate !== null) {
    const next = { ...(populate as Record<string, unknown>) };
    delete next.questions;
    if (Object.keys(next).length === 0) {
      delete query.populate;
    } else {
      query.populate = next;
    }
  }
}

export default factories.createCoreController('api::quiz.quiz', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized quiz creation attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to create quizzes.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const { course: courseId } = ctx.request.body.data || {};
      if (!courseId) {
        return ctx.badRequest('Course ID is required to create a quiz.');
      }
      const isOwner = await isCourseOwner(courseId, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to add quiz to unowned course ${courseId}.`);
        return ctx.forbidden('Instructors can only create quizzes for their own courses.');
      }
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized quiz update attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to update quizzes.');
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
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to update quiz ${id} in unowned course.`);
        return ctx.forbidden('Instructors can only update quizzes for their own courses.');
      }
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized quiz deletion attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to delete quizzes.');
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
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to delete quiz ${id} in unowned course.`);
        return ctx.forbidden('Instructors can only delete quizzes for their own courses.');
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
      stripQuestionPopulateFromQuery(ctx.query as Record<string, unknown>);
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
      await super.find(ctx);
      const body = ctx.body as { data?: Record<string, unknown>[] | Record<string, unknown> } | undefined;
      if (body?.data) {
        const rows = Array.isArray(body.data) ? body.data : [body.data];
        body.data = stripQuizListForStudent(rows);
      }
      return ctx.body;
    }

    return ctx.forbidden();
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return super.findOne(ctx);
    }

    if (role === 'instructor' && ctx.state.user) {
      const quiz = await strapi.documents('api::quiz.quiz').findOne({
        documentId: id,
        populate: ['course', 'course.owner', 'questions'],
      });

      if (!quiz || !quiz.course) {
        return ctx.notFound('Quiz not found.');
      }

      const isCoursePublished = Boolean(quiz.course.publishedAt);
      const isCourseOwnerUser = (quiz.course.owner as any)?.id === ctx.state.user.id;
      if (!isCoursePublished && !isCourseOwnerUser) {
        return ctx.notFound('Quiz not found or not published.');
      }

      const sanitized = await this.sanitizeOutput(quiz, ctx);
      return this.transformResponse(sanitized);
    }

    if (role === 'student' && ctx.state.user) {
      const quiz = await strapi.documents('api::quiz.quiz').findOne({
        documentId: id,
        populate: ['course', 'course.owner'],
      });

      if (!quiz || !quiz.course) {
        return ctx.notFound('Quiz not found.');
      }

      if (!quiz.course.publishedAt) {
        return ctx.notFound('Quiz not found or not published.');
      }

      const enrolled = await isEnrolled(quiz.course.documentId, ctx.state.user.id);
      if (!enrolled) {
        strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to view quiz ${id} without course enrollment.`);
        return ctx.forbidden('You must be enrolled in this course to view its quiz.');
      }

      const sanitized = await this.sanitizeOutput(stripQuizNestedQuestions(quiz as Record<string, unknown>), ctx);
      return this.transformResponse(sanitized);
    }

    return ctx.forbidden();
  },
}));
