import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::course.course', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You do not have permission to create courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        owner: ctx.state.user.id,
        publishedAt: null,
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You do not have permission to update courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
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
      return ctx.forbidden('You do not have permission to delete courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only delete their own courses.');
      }
    }

    return super.delete(ctx);
  },

  async getStats(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'admin') {
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
