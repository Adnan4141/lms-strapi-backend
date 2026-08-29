import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/student/enrollments/:courseId',
      handler: 'api::enrollment.enrollment.getEnrollmentStatus',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/student/enrollments/:courseId',
      handler: 'api::enrollment.enrollment.enrollInCourse',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
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
