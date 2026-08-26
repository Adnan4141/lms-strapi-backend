import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/admin-dashboard/stats',
      handler: 'api::course.course.getStats',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default customRoutes;
