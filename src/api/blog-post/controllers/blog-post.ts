import { factories } from '@strapi/strapi';
import { getUserRole, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::blog-post.blog-post', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager'].includes(role)) {
      return ctx.forbidden('Only Admin and Content Manager can create blog posts.');
    }
    return await super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager'].includes(role)) {
      return ctx.forbidden('Only Admin and Content Manager can update blog posts.');
    }
    return await super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager'].includes(role)) {
      return ctx.forbidden('Only Admin and Content Manager can delete blog posts.');
    }
    return await super.delete(ctx);
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (['admin', 'content_manager'].includes(role)) {
      return await super.find(ctx);
    }

    // Anyone (students, instructors, public) can read published blog posts
    ctx.query = ctx.query || {};
    ctx.query.filters = {
      ...((ctx.query.filters as any) || {}),
      publishedAt: { $notNull: true },
    };
    return await super.find(ctx);
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return await super.findOne(ctx);
    }

    // Anyone can read a single published blog post
    const post = await strapi.documents('api::blog-post.blog-post').findOne({
      documentId: id,
    });

    if (!post || !post.publishedAt) {
      return ctx.notFound('Blog post not found or not published.');
    }

    return await super.findOne(ctx);
  },
}));
