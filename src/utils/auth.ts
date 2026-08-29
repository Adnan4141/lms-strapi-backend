import { StrapiContext } from '../types';
import { findStudentCourseEnrollments } from './enrollment';

export * from '../types';

const VALID_ROLES = ['admin', 'content_manager', 'instructor', 'student'] as const;

export async function getUserRole(ctx: StrapiContext | any): Promise<string> {
  if (!ctx?.state?.user) {
    return 'public';
  }

  let roleType = ctx.state.user.role?.type;

  if (!roleType) {
    const user = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: ctx.state.user.documentId,
      populate: ['role'],
    });
    roleType = user?.role?.type;
  }

  if (roleType && VALID_ROLES.includes(roleType as (typeof VALID_ROLES)[number])) {
    return roleType;
  }

  return 'invalid';
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
  const enrollments = await findStudentCourseEnrollments(courseId, userId);
  return enrollments.length > 0;
}
