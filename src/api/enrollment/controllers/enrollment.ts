import { factories } from '@strapi/strapi';
import { getUserRole, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::enrollment.enrollment', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      return ctx.forbidden('Only students are allowed to enroll in courses.');
    }

    if (ctx.state.user) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        student: ctx.state.user.id,
        enrolledAt: new Date(),
      };
    }

    return await super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    return ctx.forbidden('Modifying enrollments is not allowed.');
  },

  async delete(ctx: StrapiContext) {
    return ctx.forbidden('Deleting enrollments is not allowed.');
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return await super.find(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      ctx.query = ctx.query || {};
      ctx.query.filters = {
        ...((ctx.query.filters as any) || {}),
        student: {
          id: ctx.state.user.id,
        },
      };
      return await super.find(ctx);
    }

    return ctx.forbidden();
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return await super.findOne(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      const enrollment = await strapi.documents('api::enrollment.enrollment').findOne({
        documentId: id,
        populate: ['student'],
      });

      if (!enrollment) {
        return ctx.notFound();
      }

      if (enrollment.student?.id !== ctx.state.user.id) {
        return ctx.forbidden('You can only view your own enrollments.');
      }
      
      return await super.findOne(ctx);
    }

    return ctx.forbidden();
  },
}));
