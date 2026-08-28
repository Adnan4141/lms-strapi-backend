import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/catalog/blog-posts',
      handler: 'api::blog-post.blog-post.listPublicBlogPosts',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/catalog/blog-posts/slug/:slug',
      handler: 'api::blog-post.blog-post.getPublicBlogPostBySlug',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/manage/blog-posts',
      handler: 'api::blog-post.blog-post.listManageBlogPosts',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default customRoutes;
