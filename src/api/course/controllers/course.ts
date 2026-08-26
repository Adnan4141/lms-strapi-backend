import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::course.course', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized course creation attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to create courses.');
    }

    if (ctx.state.user) {
      const isInstructor = role === 'instructor';
      ctx.request.body.data = {
        ...ctx.request.body.data,
        owner: ctx.request.body.data?.owner || ctx.state.user.id,
        publishedAt: isInstructor ? null : ctx.request.body.data?.publishedAt,
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized course update attempt on ${id} by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to update courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to edit course ${id} owned by another user.`);
        return ctx.forbidden('Instructors can only edit their own courses.');
      }
      if (ctx.request.body.data) {
        delete ctx.request.body.data.publishedAt;
      }
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized course deletion attempt on ${id} by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to delete courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to delete course ${id} owned by another user.`);
        return ctx.forbidden('Instructors can only delete their own courses.');
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
              { publishedAt: { $notNull: true } },
              { owner: { id: ctx.state.user.id } },
            ],
          },
        ],
      };
      return super.find(ctx);
    }

    ctx.query.filters = {
      $and: [
        ...existingFilters,
        { publishedAt: { $notNull: true } },
      ],
    };
    return super.find(ctx);
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return super.findOne(ctx);
    }

    const course = await strapi.documents('api::course.course').findOne({
      documentId: id,
      populate: ['owner', 'lessons', 'quizzes', 'coverImage'],
    });

    if (!course) {
      return ctx.notFound('Course not found.');
    }

    const isPublished = Boolean(course.publishedAt);

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = (course.owner as any)?.id === ctx.state.user.id;
      if (!isPublished && !isOwner) {
        return ctx.notFound('Course not found or not published.');
      }
      const sanitized = await this.sanitizeOutput(course, ctx);
      return this.transformResponse(sanitized);
    }

    if (!isPublished) {
      return ctx.notFound('Course not found or not published.');
    }

    const sanitized = await this.sanitizeOutput(course, ctx);
    return this.transformResponse(sanitized);
  },

  async getStats(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'admin') {
      strapi.log.warn(`[Security] Non-admin user ${ctx.state.user?.id || 'guest'} (role: ${role}) attempted to access getStats.`);
      return ctx.forbidden('Only administrators can view platform statistics.');
    }

    const users = await strapi.documents('plugin::users-permissions.user').findMany({
      populate: ['role'],
    });

    const userStats: Record<string, number> = {
      admin: 0,
      content_manager: 0,
      instructor: 0,
      student: 0,
      other: 0,
    };

    for (const user of users) {
      const roleType = (user as any).role?.type || 'other';
      if (roleType in userStats) {
        userStats[roleType] += 1;
      } else {
        userStats.other += 1;
      }
    }

    const [totalCourses, totalEnrollments, totalLessons, totalQuizzes, totalBlogPosts] = await Promise.all([
      strapi.documents('api::course.course').count({}),
      strapi.documents('api::enrollment.enrollment').count({}),
      strapi.documents('api::lesson.lesson').count({}),
      strapi.documents('api::quiz.quiz').count({}),
      strapi.documents('api::blog-post.blog-post').count({}),
    ]);

    return {
      stats: {
        users: {
          ...userStats,
          total: users.length,
        },
        totalCourses,
        totalEnrollments,
        totalLessons,
        totalQuizzes,
        totalBlogPosts,
      },
    };
  },
}));
