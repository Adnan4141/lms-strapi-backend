import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'DELETE',
      path: '/student/enrollments/:courseId',
      handler: 'api::enrollment.enrollment.unenrollFromCourse',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default customRoutes;
