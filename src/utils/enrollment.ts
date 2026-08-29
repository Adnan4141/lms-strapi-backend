type EnrollmentRecord = {
  documentId: string;
  id?: number;
};

export async function resolveCourseIds(courseId: string | number): Promise<number[]> {
  const numCourseId = Number(courseId);
  const courses = await strapi.db.query('api::course.course').findMany({
    where: {
      $or: [
        { documentId: String(courseId) },
        ...(Number.isFinite(numCourseId) && numCourseId > 0 ? [{ id: numCourseId }] : []),
      ],
    },
    select: ['id'],
  });

  return courses.map((course) => Number(course.id)).filter((id) => Number.isFinite(id));
}

export async function findStudentCourseEnrollments(
  courseId: string | number,
  userId: string | number
): Promise<EnrollmentRecord[]> {
  if (!courseId || !userId) {
    return [];
  }

  const courseIds = await resolveCourseIds(courseId);
  if (courseIds.length === 0) {
    return [];
  }

  const numUserId = Number(userId);
  if (!Number.isFinite(numUserId)) {
    return [];
  }

  const rows = await strapi.db.connection('enrollments as e')
    .join('enrollments_student_lnk as es', 'es.enrollment_id', 'e.id')
    .join('enrollments_course_lnk as ec', 'ec.enrollment_id', 'e.id')
    .where('es.user_id', numUserId)
    .whereIn('ec.course_id', courseIds)
    .select('e.id', 'e.document_id')
    .distinct();

  const seen = new Set<string>();
  return rows
    .map((row) => ({
      id: Number(row.id),
      documentId: String(row.document_id),
    }))
    .filter((enrollment) => {
      if (!enrollment.documentId || seen.has(enrollment.documentId)) {
        return false;
      }
      seen.add(enrollment.documentId);
      return true;
    });
}

export async function deleteStudentCourseEnrollments(
  courseId: string | number,
  userId: string | number
): Promise<number> {
  const enrollments = await findStudentCourseEnrollments(courseId, userId);

  await Promise.all(
    enrollments.map((enrollment) =>
      strapi.documents('api::enrollment.enrollment').delete({
        documentId: enrollment.documentId,
      })
    )
  );

  return enrollments.length;
}

export async function findPublishedCourse(courseId: string | number) {
  const courseIds = await resolveCourseIds(courseId);
  if (courseIds.length === 0) {
    return null;
  }

  return strapi.db.query('api::course.course').findOne({
    where: {
      id: { $in: courseIds },
      publishedAt: { $notNull: true },
    },
  });
}

export async function createStudentCourseEnrollment(
  courseId: string | number,
  userId: string | number
): Promise<EnrollmentRecord> {
  const course = await findPublishedCourse(courseId);
  if (!course) {
    throw new Error('This course is not published yet.');
  }

  const created = await strapi.documents('api::enrollment.enrollment').create({
    data: {
      student: Number(userId),
      course: course.id,
      enrolledAt: new Date(),
    },
  });

  return {
    documentId: created.documentId,
    id: typeof created.id === 'number' ? created.id : undefined,
  };
}
