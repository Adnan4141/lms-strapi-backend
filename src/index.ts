import type { Core } from '@strapi/strapi';

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      console.log('Seeding 4 User Roles and Permissions according to Permission Matrix...');

      const rolesConfig = [
        { name: 'Admin', description: 'Full control of the platform. Manages users and roles.', type: 'admin' },
        { name: 'Content Manager', description: 'Creates and manages courses, lessons, quizzes, and blog posts.', type: 'content_manager' },
        { name: 'Instructor', description: 'Manages lessons and quizzes of their own courses.', type: 'instructor' },
        { name: 'Student', description: 'Enrolls in courses, views lessons, takes quizzes, and tracks progress.', type: 'student' },
      ];

      const rolesMap: Record<string, any> = {};

      for (const r of rolesConfig) {
        let role = await strapi.query('plugin::users-permissions.role').findOne({
          where: { type: r.type },
        });

        if (!role) {
          role = await strapi.query('plugin::users-permissions.role').create({
            data: r,
          });
        }
        rolesMap[r.type] = role;
      }

      const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });

      const roleIds = Object.values(rolesMap).map((r) => r.id);
      if (publicRole) {
        roleIds.push(publicRole.id);
      }

      await strapi.db.query('plugin::users-permissions.permission').deleteMany({
        where: {
          role: {
            id: { $in: roleIds },
          },
        },
      });

      const adminPermissions = [
        'plugin::users-permissions.user.find',
        'plugin::users-permissions.user.findOne',
        'plugin::users-permissions.user.create',
        'plugin::users-permissions.user.update',
        'plugin::users-permissions.user.destroy',
        'plugin::users-permissions.role.find',
        'plugin::users-permissions.role.findOne',
        'plugin::users-permissions.role.create',
        'plugin::users-permissions.role.update',
        'plugin::users-permissions.role.destroy',
        'api::course.course.create',
        'api::course.course.find',
        'api::course.course.findOne',
        'api::course.course.update',
        'api::course.course.delete',
        'api::course.course.getStats',
        'api::lesson.lesson.create',
        'api::lesson.lesson.find',
        'api::lesson.lesson.findOne',
        'api::lesson.lesson.update',
        'api::lesson.lesson.delete',
        'api::quiz.quiz.create',
        'api::quiz.quiz.find',
        'api::quiz.quiz.findOne',
        'api::quiz.quiz.update',
        'api::quiz.quiz.delete',
        'api::question.question.create',
        'api::question.question.find',
        'api::question.question.findOne',
        'api::question.question.update',
        'api::question.question.delete',
        'api::lesson-progress.lesson-progress.find',
        'api::lesson-progress.lesson-progress.findOne',
        'api::lesson-progress.lesson-progress.getCourseProgress',
        'api::quiz-attempt.quiz-attempt.find',
        'api::quiz-attempt.quiz-attempt.findOne',
        'api::blog-post.blog-post.create',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
        'api::blog-post.blog-post.update',
        'api::blog-post.blog-post.delete',
        'api::enrollment.enrollment.find',
        'api::enrollment.enrollment.findOne',
      ];

      const contentManagerPermissions = [
        'api::course.course.create',
        'api::course.course.find',
        'api::course.course.findOne',
        'api::course.course.update',
        'api::course.course.delete',
        'api::lesson.lesson.create',
        'api::lesson.lesson.find',
        'api::lesson.lesson.findOne',
        'api::lesson.lesson.update',
        'api::lesson.lesson.delete',
        'api::quiz.quiz.create',
        'api::quiz.quiz.find',
        'api::quiz.quiz.findOne',
        'api::quiz.quiz.update',
        'api::quiz.quiz.delete',
        'api::question.question.create',
        'api::question.question.find',
        'api::question.question.findOne',
        'api::question.question.update',
        'api::question.question.delete',
        'api::lesson-progress.lesson-progress.find',
        'api::lesson-progress.lesson-progress.findOne',
        'api::quiz-attempt.quiz-attempt.find',
        'api::quiz-attempt.quiz-attempt.findOne',
        'api::blog-post.blog-post.create',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
        'api::blog-post.blog-post.update',
        'api::blog-post.blog-post.delete',
        'api::enrollment.enrollment.find',
        'api::enrollment.enrollment.findOne',
      ];

      const instructorPermissions = [
        'api::course.course.create',
        'api::course.course.find',
        'api::course.course.findOne',
        'api::course.course.update',
        'api::course.course.delete',
        'api::lesson.lesson.create',
        'api::lesson.lesson.find',
        'api::lesson.lesson.findOne',
        'api::lesson.lesson.update',
        'api::lesson.lesson.delete',
        'api::quiz.quiz.create',
        'api::quiz.quiz.find',
        'api::quiz.quiz.findOne',
        'api::quiz.quiz.update',
        'api::quiz.quiz.delete',
        'api::question.question.create',
        'api::question.question.find',
        'api::question.question.findOne',
        'api::question.question.update',
        'api::question.question.delete',
        'api::lesson-progress.lesson-progress.find',
        'api::lesson-progress.lesson-progress.findOne',
        'api::quiz-attempt.quiz-attempt.find',
        'api::quiz-attempt.quiz-attempt.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
      ];

      const studentPermissions = [
        'api::course.course.find',
        'api::course.course.findOne',
        'api::lesson.lesson.find',
        'api::lesson.lesson.findOne',
        'api::enrollment.enrollment.create',
        'api::enrollment.enrollment.find',
        'api::enrollment.enrollment.findOne',
        'api::lesson-progress.lesson-progress.create',
        'api::lesson-progress.lesson-progress.find',
        'api::lesson-progress.lesson-progress.findOne',
        'api::lesson-progress.lesson-progress.update',
        'api::lesson-progress.lesson-progress.getCourseProgress',
        'api::quiz.quiz.find',
        'api::quiz.quiz.findOne',
        'api::question.question.find',
        'api::question.question.findOne',
        'api::quiz-attempt.quiz-attempt.create',
        'api::quiz-attempt.quiz-attempt.find',
        'api::quiz-attempt.quiz-attempt.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
      ];

      const publicPermissions = [
        'api::course.course.find',
        'api::course.course.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
      ];

      const createPerms = (perms: string[], roleId: number) =>
        perms.map((action) =>
          strapi.query('plugin::users-permissions.permission').create({
            data: { action, role: roleId },
          })
        );

      const allPermPromises = [
        ...createPerms(adminPermissions, rolesMap['admin'].id),
        ...createPerms(contentManagerPermissions, rolesMap['content_manager'].id),
        ...createPerms(instructorPermissions, rolesMap['instructor'].id),
        ...createPerms(studentPermissions, rolesMap['student'].id),
      ];

      if (publicRole) {
        allPermPromises.push(...createPerms(publicPermissions, publicRole.id));
      }

      await Promise.all(allPermPromises);

      console.log('All Roles and Public permissions seeded successfully!');
    } catch (err) {
      console.error('Error seeding roles/permissions in bootstrap:', err);
    }
  },
};
