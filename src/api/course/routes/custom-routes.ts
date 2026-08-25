export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-dashboard/stats',
      handler: 'course.getStats',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
