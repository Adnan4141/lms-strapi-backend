import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/lesson-progresses/course/:courseId',
      handler: 'lesson-progress.getCourseProgress',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default customRoutes;
