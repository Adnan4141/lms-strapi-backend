import { factories } from '@strapi/strapi';
import { getUserRole, isEnrolled, StrapiContext } from '../../../utils/auth';

export default factories.createCoreController('api::enrollment.enrollment', ({ strapi }): any => ({
  async create(ctx: StrapiContext) {
    const role = await getUserRole(ctx);
    if (role !== 'student') {
      strapi.log.warn(`[Security] Non-student user ${ctx.state.user?.id || 'guest'} (role: ${role}) attempted to create an enrollment.`);
      return ctx.forbidden('Only students can enroll in courses.');
    }

    const { course: courseId } = ctx.request.body.data || {};
    if (!courseId) {
      return ctx.badRequest('Course ID is required to enroll.');
    }

    const numCourseId = Number(courseId);
    const course = await strapi.db.query('api::course.course').findOne({
      where: {
        $and: [
          {
            $or: [
              { documentId: String(courseId) },
              ...(numCourseId ? [{ id: numCourseId }] : []),
            ],
          },
          { publishedAt: { $notNull: true } },
        ],
      },
    });
    if (!course) {
      return ctx.badRequest('This course is not published yet.');
    }

    if (ctx.state.user) {
      const alreadyEnrolled = await isEnrolled(courseId, ctx.state.user.id);
      if (alreadyEnrolled) {
        return ctx.badRequest('You are already enrolled in this course.');
      }

      ctx.request.body.data = {
        ...ctx.request.body.data,
        student: ctx.state.user.id,
        enrolledAt: new Date(),
      };
    }

    return super.create(ctx);
  },

  async update(ctx: StrapiContext) {
    strapi.log.warn(`[Security] Attempt to modify enrollment ${ctx.params?.id} by user ${ctx.state.user?.id || 'guest'}`);
    return ctx.forbidden('Enrollment records cannot be modified directly.');
  },

  async delete(ctx: StrapiContext) {
    strapi.log.warn(`[Security] Attempt to delete enrollment ${ctx.params?.id} by user ${ctx.state.user?.id || 'guest'}`);
    return ctx.forbidden('Enrollment records cannot be deleted directly.');
  },

  async find(ctx: StrapiContext) {
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return super.find(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      ctx.query = ctx.query || {};
      const existingFilters = ctx.query.filters ? [ctx.query.filters] : [];

      ctx.query.filters = {
        $and: [
          ...existingFilters,
          {
            student: {
              id: ctx.state.user.id,
            },
          },
        ],
      };
      return super.find(ctx);
    }

    if (role === 'instructor' && ctx.state.user) {
      ctx.query = ctx.query || {};
      const existingFilters = ctx.query.filters ? [ctx.query.filters] : [];

      ctx.query.filters = {
        $and: [
          ...existingFilters,
          {
            course: {
              owner: {
                id: ctx.state.user.id,
              },
            },
          },
        ],
      };
      return super.find(ctx);
    }

    strapi.log.warn(`[Security] Unauthorized find enrollments attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
    return ctx.forbidden();
  },

  async findOne(ctx: StrapiContext) {
    const { id } = ctx.params;
    const role = await getUserRole(ctx);

    if (['admin', 'content_manager'].includes(role)) {
      return super.findOne(ctx);
    }

    if (role === 'student' && ctx.state.user) {
      const enrollment = await strapi.documents('api::enrollment.enrollment').findOne({
        documentId: id,
        populate: ['student', 'course'],
      });

      if (!enrollment) {
        return ctx.notFound('Enrollment record not found.');
      }

      if (enrollment.student?.id !== ctx.state.user.id) {
        strapi.log.warn(`[Security] Student ${ctx.state.user.id} attempted to view enrollment ${id} of another user.`);
        return ctx.forbidden('You can only view your own course enrollments.');
      }

      const sanitized = await this.sanitizeOutput(enrollment, ctx);
      return this.transformResponse(sanitized);
    }

    strapi.log.warn(`[Security] Unauthorized findOne enrollment ${id} attempt by user ${ctx.state.user?.id || 'guest'} (role: ${role})`);
    return ctx.forbidden();
  },

  async unenrollFromCourse(ctx: StrapiContext) {
    const { courseId } = ctx.params;
    const role = await getUserRole(ctx);

    if (role !== 'student' || !ctx.state.user) {
      return ctx.forbidden('Only students can unenroll from courses.');
    }

    const enrollment = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: {
        student: { id: ctx.state.user.id },
        course: { documentId: String(courseId) },
      },
    });

    if (!enrollment) {
      return ctx.notFound('You are not enrolled in this course.');
    }

    await strapi.documents('api::enrollment.enrollment').delete({
      documentId: enrollment.documentId,
    });

    ctx.body = { ok: true };
  },
}));
