import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::course.course', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to create courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        owner: ctx.state.user.id,
        publishedAt: null,
      };
    }

    return await super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to update courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only update their own courses.');
      }
      if (ctx.request.body.data) {
        delete ctx.request.body.data.publishedAt;
      }
    }

    return await super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      return ctx.forbidden('You are not allowed to delete courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
        return ctx.forbidden('Instructors can only delete their own courses.');
      }
    }

    return await super.delete(ctx);
  },

  async getStats(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'admin') {
      return ctx.forbidden('Only Admin users can access platform statistics.');
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

    for (const u of users) {
      const rType = (u as any).role?.type || 'other';
      if (userStats[rType] !== undefined) {
        userStats[rType] += 1;
      } else {
        userStats.other += 1;
      }
    }

    const totalCourses = await strapi.documents('api::course.course').count({});
    const totalEnrollments = await strapi.documents('api::enrollment.enrollment').count({});
    const totalLessons = await strapi.documents('api::lesson.lesson').count({});
    const totalQuizzes = await strapi.documents('api::quiz.quiz').count({});
    const totalBlogPosts = await strapi.documents('api::blog-post.blog-post').count({});

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
