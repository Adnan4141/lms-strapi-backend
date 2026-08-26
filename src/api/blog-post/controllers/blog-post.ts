import { factories } from '@strapi/strapi';
import { getUserRole, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::blog-post.blog-post', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized blog creation attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('Only Admin and Content Manager can create blog posts.');
    }

    if (ctx.state.user && ctx.request.body?.data) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        author: ctx.request.body.data.author || ctx.state.user.id,
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized blog update attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('Only Admin and Content Manager can update blog posts.');
    }
    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized blog deletion attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('Only Admin and Content Manager can delete blog posts.');
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

    const post = await strapi.documents('api::blog-post.blog-post').findOne({
      documentId: id,
      populate: ['author', 'coverImage'],
    });

    if (!post || !post.publishedAt) {
      return ctx.notFound('Blog post not found or not published.');
    }

    const sanitized = await this.sanitizeOutput(post, ctx);
    return this.transformResponse(sanitized);
  },
}));
