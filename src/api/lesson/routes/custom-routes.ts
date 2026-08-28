import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'PUT',
      path: '/manage/courses/:courseId/lessons/reorder',
      handler: 'api::lesson.lesson.reorderCourseLessons',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default customRoutes;
