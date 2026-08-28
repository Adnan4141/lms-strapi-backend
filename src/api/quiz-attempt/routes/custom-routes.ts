import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/student/quizzes/:quizId/review',
      handler: 'api::quiz-attempt.quiz-attempt.getStudentQuizReview',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default customRoutes;
