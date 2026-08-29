import { factories } from '@strapi/strapi';
import { getUserRole, isCourseOwner, isEnrolled, resolveUserFromBearer, StrapiContext } from '../../../utils/auth';
import {
  calculateQuizScorePercent,
  countQuestionsByQuiz,
  findQuizQuestions,
} from '../../../utils/quiz-questions';
import { toPublicQuestions } from '../../../utils/question-sanitize';

const ASSIGNABLE_ROLES = ['admin', 'content_manager', 'instructor', 'student'] as const;

export default factories.createCoreController('api::course.course', ({ strapi }): any => {
  async function countUsersByRoleType(roleType: string): Promise<number> {
    return strapi.db.query('plugin::users-permissions.user').count({
      where: { role: { type: roleType } },
    });
  }

  return {
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized course creation attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to create courses.');
    }

    if (ctx.state.user) {
      const isInstructor = role === 'instructor';
      ctx.request.body.data = {
        ...ctx.request.body.data,
        owner: ctx.request.body.data?.owner || ctx.state.user.id,
        publishedAt: isInstructor ? null : ctx.request.body.data?.publishedAt,
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized course update attempt on ${id} by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to update courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to edit course ${id} owned by another user.`);
        return ctx.forbidden('Instructors can only edit their own courses.');
      }
      if (ctx.request.body.data) {
        delete ctx.request.body.data.publishedAt;
        delete ctx.request.body.data.owner;
      }
    }

    if (['admin', 'content_manager'].includes(role) && ctx.request.body.data?.owner !== undefined) {
      const ownerId = Number(ctx.request.body.data.owner);
      if (!ownerId) {
        return ctx.badRequest('A valid instructor must be assigned to this course.');
      }

      const ownerUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: ownerId },
        populate: ['role'],
      });

      if (!ownerUser || (ownerUser as any).role?.type !== 'instructor') {
        return ctx.badRequest('Owner must be a valid instructor account.');
      }
    }

    return super.update(ctx);
  },

  async delete(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);
    if (!['admin', 'content_manager', 'instructor'].includes(role)) {
      strapi.log.warn(`[Security] Unauthorized course deletion attempt on ${id} by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
      return ctx.forbidden('You do not have permission to delete courses.');
    }

    if (role === 'instructor' && ctx.state.user) {
      const isOwner = await isCourseOwner(id, ctx.state.user.id);
      if (!isOwner) {
        strapi.log.warn(`[Security] Instructor ${ctx.state.user.id} attempted to delete course ${id} owned by another user.`);
        return ctx.forbidden('Instructors can only delete their own courses.');
      }
    }

    return super.delete(ctx);
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return super.find(ctx);
    }

    ctx.query = ctx.query || {};
    const existingFilters = ctx.query.filters ? [ctx.query.filters] : [];

    if (role === 'instructor' && ctx.state.user) {
      ctx.query.filters = {
        $and: [
          ...existingFilters,
          { owner: { id: ctx.state.user.id } },
        ],
      };
      return super.find(ctx);
    }

    ctx.query.filters = {
      $and: [
        ...existingFilters,
        { publishedAt: { $notNull: true } },
      ],
    };
    return super.find(ctx);
  },

  async findOne(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    if (role === 'instructor' && ctx.state.user) {
      const { id } = ctx.params;
      const course = await strapi.documents('api::course.course').findOne({
        documentId: id,
        populate: ['owner'],
      });

      if (!course) {
        return ctx.notFound('Course not found.');
      }

      const isPublished = Boolean(course.publishedAt);
      const isOwner = course.owner?.id === ctx.state.user.id || course.owner?.documentId === ctx.state.user.documentId;
      if (!isPublished && !isOwner) {
        return ctx.notFound('Course not found or not published.');
      }
    }

    return super.findOne(ctx);
  },

  async getSessionMe(ctx: StrapiContext) {
    const user = ctx.state.user ?? (await resolveUserFromBearer(ctx));
    if (!user) {
      ctx.status = 401;
      ctx.body = {
        data: null,
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Missing or invalid credentials',
        },
      };
      return;
    }

    ctx.body = {
      id: user.id,
      documentId: user.documentId,
      username: user.username,
      email: user.email,
      role: user.role
        ? { id: user.role.id, name: user.role.name, type: user.role.type }
        : null,
    };
  },

  async listPublicInstructors(ctx: StrapiContext) {
    const instructors = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: { role: { type: 'instructor' }, blocked: false },
      orderBy: { username: 'asc' },
      select: ['username'],
    });

    ctx.body = instructors.map(({ username }) => ({
      username,
      courses: [],
    }));
  },

  async listPublicCourses(ctx: StrapiContext) {
    const courses = await strapi.db.query('api::course.course').findMany({
      where: { publishedAt: { $notNull: true } },
      orderBy: { createdAt: 'desc' },
      limit: 100,
      populate: {
        owner: {
          select: ['id', 'documentId', 'username'],
        },
      },
    });

    ctx.body = courses.map((course: any) => ({
      id: course.id,
      documentId: course.documentId,
      title: course.title,
      description: course.description,
      coverImageUrl: course.coverImageUrl ?? null,
      publishedAt: course.publishedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      owner: course.owner
        ? {
            id: course.owner.id,
            documentId: course.owner.documentId,
            username: course.owner.username,
          }
        : null,
    }));
  },

  async getPublicCourse(ctx: StrapiContext) {
    const { id } = ctx.params;

    const course = await strapi.db.query('api::course.course').findOne({
      where: {
        documentId: id,
        publishedAt: { $notNull: true },
      },
      populate: {
        owner: {
          select: ['id', 'documentId', 'username'],
        },
      },
    });

    if (!course) {
      return ctx.notFound('Course not found.');
    }

    ctx.body = {
      id: course.id,
      documentId: course.documentId,
      title: course.title,
      description: course.description,
      coverImageUrl: (course as any).coverImageUrl ?? null,
      publishedAt: course.publishedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      owner: (course as any).owner
        ? {
            id: (course as any).owner.id,
            documentId: (course as any).owner.documentId,
            username: (course as any).owner.username,
          }
        : null,
    };
  },

  async getStudentLearningWorkspace(ctx: StrapiContext) {
    const { id: courseId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' || !ctx.state.user) {
      return ctx.forbidden('Only enrolled students can access the learning workspace.');
    }

    const enrolled = await isEnrolled(courseId, ctx.state.user.id);
    if (!enrolled) {
      return ctx.forbidden('You must enroll in this course before accessing lessons.');
    }

    const course = await strapi.db.query('api::course.course').findOne({
      where: {
        documentId: String(courseId),
        publishedAt: { $notNull: true },
      },
      populate: {
        owner: {
          select: ['id', 'documentId', 'username'],
        },
      },
    });

    if (!course) {
      return ctx.notFound('Course not found.');
    }

    const lessons = await strapi.db.query('api::lesson.lesson').findMany({
      where: { course: { documentId: String(courseId) } },
      orderBy: { order: 'asc' },
      select: ['documentId', 'title', 'order', 'videoUrl'],
    });

    const completedProgress = await strapi.db.query('api::lesson-progress.lesson-progress').findMany({
      where: {
        student: { id: ctx.state.user.id },
        course: { documentId: String(courseId) },
        isCompleted: true,
      },
      populate: {
        lesson: {
          select: ['documentId'],
        },
      },
    });

    const completedLessonIds = new Set(
      completedProgress
        .map((record: any) => record.lesson?.documentId)
        .filter(Boolean)
    );

    const lessonRows = lessons.map((lesson: any) => ({
      documentId: lesson.documentId,
      title: lesson.title,
      order: lesson.order,
      hasVideo: Boolean(lesson.videoUrl),
      completed: completedLessonIds.has(lesson.documentId),
    }));

    const totalLessons = lessonRows.length;
    const completedLessons = lessonRows.filter((lesson) => lesson.completed).length;
    const percentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const nextLesson =
      lessonRows.find((lesson) => !lesson.completed) ?? lessonRows[0] ?? null;

    const quizzes = await strapi.db.query('api::quiz.quiz').findMany({
      where: { course: { documentId: String(courseId) } },
      orderBy: { createdAt: 'asc' },
      select: ['documentId', 'title'],
    });

    const quizQuestions = await strapi.db.query('api::question.question').findMany({
      where: { quiz: { course: { documentId: String(courseId) } } },
      select: ['documentId', 'publishedAt', 'order'],
      populate: {
        quiz: {
          select: ['documentId'],
        },
      },
    });

    const questionCountByQuiz = countQuestionsByQuiz(quizQuestions);

    const quizAttempts = await strapi.db.query('api::quiz-attempt.quiz-attempt').findMany({
      where: {
        student: { id: ctx.state.user.id },
        course: { documentId: String(courseId) },
      },
      populate: {
        quiz: {
          select: ['documentId'],
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const attemptByQuiz = new Map<string, any>();
    for (const attempt of quizAttempts) {
      const quizDocId = (attempt as any).quiz?.documentId;
      if (quizDocId && !attemptByQuiz.has(quizDocId)) {
        attemptByQuiz.set(quizDocId, attempt);
      }
    }

    const quizRows = quizzes.map((quiz: any) => {
      const attempt = attemptByQuiz.get(quiz.documentId);
      const questionCount = questionCountByQuiz.get(quiz.documentId) ?? 0;
      const score = attempt?.score ?? 0;
      const totalForScore = questionCount > 0 ? questionCount : attempt?.totalQuestions ?? 0;
      return {
        documentId: quiz.documentId,
        title: quiz.title,
        questionCount,
        attempted: Boolean(attempt),
        scorePercent:
          attempt && totalForScore > 0 ? calculateQuizScorePercent(score, totalForScore) : null,
        submittedAt: attempt?.submittedAt ?? null,
      };
    });

    ctx.body = {
      course: {
        documentId: course.documentId,
        title: course.title,
        description: course.description,
        coverImageUrl: (course as any).coverImageUrl ?? null,
        owner: (course as any).owner
          ? {
              documentId: (course as any).owner.documentId,
              username: (course as any).owner.username,
            }
          : null,
      },
      progress: {
        totalLessons,
        completedLessons,
        percentage,
      },
      nextLessonId: nextLesson?.documentId ?? null,
      lessons: lessonRows,
      quizzes: quizRows,
      certificateEligible: totalLessons > 0 && completedLessons === totalLessons,
    };
  },

  async getStudentLesson(ctx: StrapiContext) {
    const { id: courseId, lessonId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' || !ctx.state.user) {
      return ctx.forbidden('Only enrolled students can access lessons.');
    }

    const enrolled = await isEnrolled(courseId, ctx.state.user.id);
    if (!enrolled) {
      return ctx.forbidden('You must enroll in this course before accessing lessons.');
    }

    const course = await strapi.db.query('api::course.course').findOne({
      where: {
        documentId: String(courseId),
        publishedAt: { $notNull: true },
      },
      select: ['documentId', 'title'],
    });

    if (!course) {
      return ctx.notFound('Course not found.');
    }

    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: {
        documentId: String(lessonId),
        course: { documentId: String(courseId) },
      },
      select: ['documentId', 'title', 'content', 'videoUrl', 'order'],
    });

    if (!lesson) {
      return ctx.notFound('Lesson not found.');
    }

    ctx.body = {
      documentId: lesson.documentId,
      title: lesson.title,
      content: lesson.content,
      videoUrl: lesson.videoUrl ?? null,
      order: lesson.order,
      course: {
        documentId: course.documentId,
        title: course.title,
      },
    };
  },

  async getStudentQuiz(ctx: StrapiContext) {
    const { id: courseId, quizId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' || !ctx.state.user) {
      return ctx.forbidden('Only enrolled students can access quizzes.');
    }

    const enrolled = await isEnrolled(courseId, ctx.state.user.id);
    if (!enrolled) {
      return ctx.forbidden('You must enroll in this course before accessing quizzes.');
    }

    const course = await strapi.db.query('api::course.course').findOne({
      where: {
        documentId: String(courseId),
        publishedAt: { $notNull: true },
      },
      select: ['documentId', 'title'],
    });

    if (!course) {
      return ctx.notFound('Course not found.');
    }

    const quiz = await strapi.db.query('api::quiz.quiz').findOne({
      where: {
        documentId: String(quizId),
        course: { documentId: String(courseId) },
      },
      select: ['documentId', 'title'],
    });

    if (!quiz) {
      return ctx.notFound('Quiz not found.');
    }

    const questions = await findQuizQuestions(strapi, String(quizId), [
      'documentId',
      'text',
      'options',
      'order',
    ]);

    const attempt = await strapi.db.query('api::quiz-attempt.quiz-attempt').findOne({
      where: {
        student: { id: ctx.state.user.id },
        quiz: { documentId: String(quizId) },
      },
      select: ['score', 'totalQuestions', 'submittedAt'],
    });

    const totalQuestions = questions.length;
    const score = attempt?.score ?? 0;

    ctx.body = {
      documentId: quiz.documentId,
      title: quiz.title,
      course: {
        documentId: course.documentId,
        title: course.title,
      },
      questions: toPublicQuestions(questions as Record<string, unknown>[]),
      attempt: attempt
        ? {
            score,
            totalQuestions,
            scorePercent: calculateQuizScorePercent(score, totalQuestions),
            submittedAt: attempt.submittedAt,
          }
        : null,
    };
  },

  async changeStudentPassword(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    if (role !== 'student' || !ctx.state.user) {
      return ctx.forbidden('Only students can change their password here.');
    }

    const { currentPassword, password, passwordConfirmation } = ctx.request.body ?? {};

    if (!currentPassword || !password) {
      return ctx.badRequest('Current password and new password are required.');
    }

    if (password !== passwordConfirmation) {
      return ctx.badRequest('New password and confirmation do not match.');
    }

    try {
      await strapi
        .plugin('users-permissions')
        .service('user')
        .changePassword(ctx.state.user.id, {
          currentPassword,
          password,
          passwordConfirmation,
        });

      ctx.body = { ok: true };
    } catch (error: any) {
      return ctx.badRequest(error?.message || 'Could not change password.');
    }
  },

  async listInstructors(ctx: StrapiContext) {
    const user = ctx.state.user ?? (await resolveUserFromBearer(ctx));
    if (!user) {
      ctx.status = 401;
      ctx.body = {
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Missing or invalid credentials',
        },
      };
      return;
    }

    const role = (user as any).role?.type;
    if (!['admin', 'content_manager'].includes(role)) {
      return ctx.forbidden('Only administrators and content managers can list instructors.');
    }

    const instructors = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: { role: { type: 'instructor' } },
      orderBy: { username: 'asc' },
    });

    ctx.body = instructors.map((instructor) => ({
      id: instructor.id,
      documentId: instructor.documentId,
      username: instructor.username,
      email: instructor.email,
    }));
  },

  async getStats(ctx: StrapiContext) {
    if ((await getUserRole(ctx)) !== 'admin') {
      strapi.log.warn(`[Security] Non-admin user ${ctx.state.user?.id || 'guest'} attempted to access getStats.`);
      return ctx.forbidden('Only administrators can view platform statistics.');
    }

    const [
      adminCount,
      contentManagerCount,
      instructorCount,
      studentCount,
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalLessons,
      totalQuizzes,
      totalBlogPosts,
    ] = await Promise.all([
      countUsersByRoleType('admin'),
      countUsersByRoleType('content_manager'),
      countUsersByRoleType('instructor'),
      countUsersByRoleType('student'),
      strapi.db.query('plugin::users-permissions.user').count({}),
      strapi.documents('api::course.course').count({}),
      strapi.documents('api::enrollment.enrollment').count({}),
      strapi.documents('api::lesson.lesson').count({}),
      strapi.documents('api::quiz.quiz').count({}),
      strapi.documents('api::blog-post.blog-post').count({}),
    ]);

    return {
      stats: {
        users: {
          admin: adminCount,
          content_manager: contentManagerCount,
          instructor: instructorCount,
          student: studentCount,
          other: Math.max(0, totalUsers - adminCount - contentManagerCount - instructorCount - studentCount),
          total: totalUsers,
        },
        totalCourses,
        totalEnrollments,
        totalLessons,
        totalQuizzes,
        totalBlogPosts,
      },
    };
  },

  async listAdminUsers(ctx: StrapiContext) {
    if ((await getUserRole(ctx)) !== 'admin') {
      return ctx.forbidden('Only administrators can list users.');
    }

    const users = await strapi.documents('plugin::users-permissions.user').findMany({
      populate: ['role'],
    });

    ctx.body = users.map((user) => ({
      id: user.id,
      documentId: user.documentId,
      username: user.username,
      email: user.email,
      role: user.role
        ? { id: (user.role as any).id, name: (user.role as any).name, type: (user.role as any).type }
        : null,
    }));
  },

  async listAdminRoles(ctx: StrapiContext) {
    if ((await getUserRole(ctx)) !== 'admin') {
      return ctx.forbidden('Only administrators can list roles.');
    }

    const roles = await strapi.db.query('plugin::users-permissions.role').findMany();
    ctx.body = {
      roles: roles
        .filter((role) => !['public', 'authenticated'].includes(role.type))
        .map((role) => ({ id: role.id, name: role.name, type: role.type })),
    };
  },

  async updateAdminUser(ctx: StrapiContext) {
    if ((await getUserRole(ctx)) !== 'admin') {
      return ctx.forbidden('Only administrators can update users.');
    }

    const { id } = ctx.params;
    const { username, email, role, password } = ctx.request.body ?? {};

    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { $or: [{ id: Number(id) || -1 }, { documentId: String(id) }] },
      populate: ['role'],
    });

    if (!existing) {
      return ctx.notFound('User not found.');
    }

    if (role !== undefined) {
      const newRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { id: Number(role) },
      });

      if (!newRole || !ASSIGNABLE_ROLES.includes(newRole.type as (typeof ASSIGNABLE_ROLES)[number])) {
        strapi.log.warn(
          `[Security] Admin ${ctx.state.user?.id} attempted to assign invalid role ${role} to user ${existing.id}.`
        );
        return ctx.badRequest('Role must be a valid application role (admin, content_manager, instructor, or student).');
      }

      const currentRoleType = (existing as any).role?.type;
      if (currentRoleType === 'admin' && newRole.type !== 'admin') {
        const adminCount = await countUsersByRoleType('admin');
        if (adminCount <= 1) {
          strapi.log.warn(
            `[Security] Admin ${ctx.state.user?.id} attempted to demote the last administrator (user ${existing.id}).`
          );
          return ctx.forbidden('Cannot change role of the last administrator.');
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (username !== undefined) data.username = username;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (password) data.password = password;

    const updated = await strapi.documents('plugin::users-permissions.user').update({
      documentId: existing.documentId,
      data,
      populate: ['role'],
    });

    ctx.body = {
      id: updated?.id,
      documentId: updated?.documentId,
      username: updated?.username,
      email: updated?.email,
      role: updated?.role
        ? { id: (updated.role as any).id, name: (updated.role as any).name, type: (updated.role as any).type }
        : null,
    };
  },

  async deleteAdminUser(ctx: StrapiContext) {
    if ((await getUserRole(ctx)) !== 'admin') {
      return ctx.forbidden('Only administrators can delete users.');
    }

    const { id } = ctx.params;
    const actorId = ctx.state.user?.id;
    const target = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { $or: [{ id: Number(id) || -1 }, { documentId: String(id) }] },
      populate: ['role'],
    });

    if (!target) {
      return ctx.notFound('User not found.');
    }

    if (actorId && target.id === actorId) {
      return ctx.forbidden('You cannot delete your own account.');
    }

    const targetRoleType = (target as any).role?.type;
    if (targetRoleType === 'admin') {
      const adminCount = await countUsersByRoleType('admin');
      if (adminCount <= 1) {
        strapi.log.warn(
          `[Security] Admin ${ctx.state.user?.id} attempted to delete the last administrator (user ${target.id}).`
        );
        return ctx.forbidden('Cannot delete the last administrator.');
      }
    }

    await strapi.documents('plugin::users-permissions.user').delete({
      documentId: target.documentId,
    });

    ctx.body = { ok: true };
  },
  };
});
