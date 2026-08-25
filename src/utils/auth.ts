import { Core } from '@strapi/strapi';

export async function getUserRole(ctx: any): Promise<string> {
  if (!ctx.state.user) {
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
  
  return course?.owner?.id === userId;
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
