export default {
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
