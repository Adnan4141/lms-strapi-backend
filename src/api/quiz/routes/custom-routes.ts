import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/quiz/:id/test',
      handler: 'quiz.test',
      config: {
        auth: false,
      },
    },
  ],
};

export default customRoutes;

