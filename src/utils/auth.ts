import { StrapiContext } from '../types';

export * from '../types';

export async function getUserRole(ctx: StrapiContext | any): Promise<string> {
  if (!ctx?.state?.user) {
    return 'public';
  }

  if (ctx.state.user.role?.type) {
    return ctx.state.user.role.type;
  }

  const user = await strapi.documents('plugin::users-permissions.user').findOne({
    documentId: ctx.state.user.documentId,
    populate: ['role'],
  });

  return user?.role?.type || 'public';
}

export async function isCourseOwner(courseId: string | number, userId: string | number): Promise<boolean> {
  if (!courseId || !userId) {
    return false;
  }

  const numCourseId = Number(courseId);

  const courses = await strapi.documents('api::course.course').findMany({
    filters: {
      $or: [
        { documentId: String(courseId) },
        ...(numCourseId ? [{ id: numCourseId }] : []),
      ],
    },
    populate: ['owner'],
  });

  const course = courses[0];
  const owner = course?.owner as { id?: string | number; documentId?: string } | undefined;

  if (!owner) {
    return false;
  }

  const ownerIdentifiers = [owner.id, owner.documentId].filter(Boolean).map(String);
  return ownerIdentifiers.includes(String(userId));
}

export async function resolveUserFromBearer(ctx: StrapiContext | any) {
  const authorization = ctx.request?.header?.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7);

  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const payload = await jwtService.verify(token);
    const userId = payload.id ?? payload.userId;
    if (!userId) {
      return null;
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      populate: ['role'],
    });
    return user;
  } catch {
    return null;
  }
}

export async function isEnrolled(courseId: string | number, userId: string | number): Promise<boolean> {
  if (!courseId || !userId) {
    return false;
  }

  const numCourseId = Number(courseId);
  const numUserId = Number(userId);

  const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
    filters: {
      course: {
        $or: [
          { documentId: String(courseId) },
          ...(numCourseId ? [{ id: numCourseId }] : []),
        ],
      },
      student: {
        $or: [
          { id: userId },
          { documentId: String(userId) },
          ...(numUserId ? [{ id: numUserId }] : []),
        ],
      },
    },
  });

  return enrollments.length > 0;
}
