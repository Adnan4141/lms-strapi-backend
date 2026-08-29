import { factories } from '@strapi/strapi';
import { getUserRole, StrapiContext } from '../../../utils/auth';

function mapPublicBlogPost(post: {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  body: string;
  coverImageUrl?: string | null;
  publishedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  author?: { username?: string } | null;
}) {
  return {
    id: post.id,
    documentId: post.documentId,
    title: post.title,
    slug: post.slug,
    body: post.body,
    coverImageUrl: post.coverImageUrl ?? null,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author?.username ? { username: post.author.username } : null,
  };
}

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
        publishedAt: null,
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

  async listPublicBlogPosts(ctx: StrapiContext) {
    const posts = await strapi.db.query('api::blog-post.blog-post').findMany({
      where: { publishedAt: { $notNull: true } },
      orderBy: { createdAt: 'desc' },
      limit: 100,
      populate: {
        author: {
          select: ['username'],
        },
      },
    });

    ctx.body = posts.map((post: any) => mapPublicBlogPost(post));
  },

  async getPublicBlogPostBySlug(ctx: StrapiContext) {
    const { slug } = ctx.params;

    const post = await strapi.db.query('api::blog-post.blog-post').findOne({
      where: {
        slug,
        publishedAt: { $notNull: true },
      },
      populate: {
        author: {
          select: ['username'],
        },
      },
    });

    if (!post) {
      return ctx.notFound('Blog post not found.');
    }

    ctx.body = mapPublicBlogPost(post as any);
  },

  async listManageBlogPosts(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    if (!['admin', 'content_manager'].includes(role)) {
      return ctx.forbidden('Only administrators and content managers can access the manage blog list.');
    }

    const rows = await strapi.db.query('api::blog-post.blog-post').findMany({
      orderBy: { createdAt: 'desc' },
      populate: {
        author: {
          select: ['username', 'documentId'],
        },
      },
    });

    const byDocumentId = new Map<string, any>();

    for (const row of rows) {
      const existing = byDocumentId.get(row.documentId);
      if (!existing) {
        byDocumentId.set(row.documentId, row);
        continue;
      }

      const existingPublished = Boolean(existing.publishedAt);
      const rowPublished = Boolean(row.publishedAt);
      if (!existingPublished && rowPublished) {
        byDocumentId.set(row.documentId, row);
      }
    }

    const posts = Array.from(byDocumentId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    ctx.body = posts.map((post: any) => ({
      id: post.id,
      documentId: post.documentId,
      title: post.title,
      slug: post.slug,
      body: post.body,
      coverImageUrl: post.coverImageUrl ?? null,
      publishedAt: post.publishedAt ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author?.username ? { username: post.author.username } : null,
    }));
  },
}));
