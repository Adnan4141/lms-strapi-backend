import { Core } from '@strapi/strapi';
import { StrapiContext } from '../types';

export * from '../types';

export async function getUserRole(ctx: StrapiContext | any): Promise<string> {
  if (!ctx?.state?.user) {
    return 'public';
  }

  // Populate the role to get its type
  const user = await strapi.documents('plugin::users-permissions.user').findOne({
    documentId: ctx.state.user.documentId,
    populate: ['role'],
  });

  return user?.role?.type || 'public';
}

export async function isCourseOwner(courseId: string | number, userId: string | number): Promise<boolean> {
  const course = await strapi.documents('api::course.course').findOne({
    documentId: String(courseId),
    populate: ['owner'],
  });

  const owner = course?.owner as { id?: string | number; documentId?: string } | undefined;

  if (!owner) {
    return false;
  }

  const ownerIdentifiers = [owner.id, owner.documentId].filter(Boolean).map(String);

  return ownerIdentifiers.includes(String(userId));
}

export async function isEnrolled(courseId: string | number, userId: string | number): Promise<boolean> {
  const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
    filters: {
      course: {
        documentId: String(courseId),
      },
      student: {
        id: userId,
      },
    },
  });

  return enrollments.length > 0;
}
