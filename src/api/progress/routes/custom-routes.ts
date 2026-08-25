export default {
  routes: [
    {
      method: 'GET',
      path: '/progresses/course/:courseId',
      handler: 'progress.getCourseProgress',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
