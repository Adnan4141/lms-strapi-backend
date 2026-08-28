import { CustomRoutes } from '../../../types';

const customRoutes: CustomRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/session/me',
      handler: 'api::course.course.getSessionMe',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/catalog/instructors',
      handler: 'api::course.course.listPublicInstructors',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/catalog/courses',
      handler: 'api::course.course.listPublicCourses',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/catalog/courses/:id',
      handler: 'api::course.course.getPublicCourse',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/student/courses/:id/learning',
      handler: 'api::course.course.getStudentLearningWorkspace',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/student/courses/:id/lessons/:lessonId',
      handler: 'api::course.course.getStudentLesson',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/student/courses/:id/quizzes/:quizId',
      handler: 'api::course.course.getStudentQuiz',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/student/profile/change-password',
      handler: 'api::course.course.changeStudentPassword',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/manage/instructors',
      handler: 'api::course.course.listInstructors',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-dashboard/stats',
      handler: 'api::course.course.getStats',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-dashboard/users',
      handler: 'api::course.course.listAdminUsers',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admin-dashboard/roles',
      handler: 'api::course.course.listAdminRoles',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/admin-dashboard/users/:id',
      handler: 'api::course.course.updateAdminUser',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admin-dashboard/users/:id',
      handler: 'api::course.course.deleteAdminUser',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default customRoutes;
