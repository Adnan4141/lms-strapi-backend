import { factories } from '@strapi/strapi';
import { getUserRole, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::enrollment.enrollment', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      return ctx.forbidden('Only enrolled students can perform this action.');
    }

    if (ctx.state.user) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        student: ctx.state.user.id,
        enrolledAt: new Date(),
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    return ctx.forbidden('Enrollment records cannot be modified directly.');
  },

  async delete(ctx: StrapiContext) {
    return ctx.forbidden('Enrollment records cannot be deleted directly.');
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return super.find(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      ctx.query = ctx.query || {};
      ctx.query.filters = {
        ...(ctx.query.filters || {}),
        student: {
          id: ctx.state.user.id,
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

    if (role === 'student' && ctx.state.user) {
      const enrollment = await strapi.documents('api::enrollment.enrollment').findOne({
        documentId: id,
        populate: ['student'],
      });

      if (!enrollment) {
        return ctx.notFound('Enrollment record not found.');
      }

      if (enrollment.student?.id !== ctx.state.user.id) {
        return ctx.forbidden('You can only view your own course enrollments.');
      }

      return super.findOne(ctx);
    }

    return ctx.forbidden();
  },
}));
