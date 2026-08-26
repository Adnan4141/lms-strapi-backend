export interface UserRole {
  id: number;
  name: string;
  description?: string;
  type: 'admin' | 'content_manager' | 'instructor' | 'student' | string;
}

export interface AuthUser {
  id: number;
  documentId: string;
  username: string;
  email: string;
  provider?: string;
  confirmed?: boolean;
  blocked?: boolean;
  role?: UserRole;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface BlogPost {
  id: number;
  documentId: string;
  title: string;
  slug?: string;
  body: string;
  coverImage?: any;
  author: AuthUser;
  publishedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Course {
  id: number;
  documentId: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  coverImage?: any;
  courseStatus?: 'DRAFT' | 'PUBLISHED';
  owner: AuthUser;
  lessons?: Lesson[];
  quizzes?: Quiz[];
  enrollments?: Enrollment[];
  publishedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Lesson {
  id: number;
  documentId: string;
  title: string;
  content: string;
  videoUrl?: string;
  order: number;
  course: Course;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface LessonProgress {
  id: number;
  documentId: string;
  student: AuthUser;
  lesson: Lesson;
  course?: Course;
  isCompleted: boolean;
  completedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Enrollment {
  id: number;
  documentId: string;
  student: AuthUser;
  course: Course;
  enrolledAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Quiz {
  id: number;
  documentId: string;
  title: string;
  course: Course;
  questions?: Question[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Question {
  id: number;
  documentId: string;
  text: string;
  options: string[] | any;
  correctAnswer?: number;
  order: number;
  quiz: Quiz;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface QuizAttemptAnswer {
  questionId: string | number;
  selectedOption: number;
}

export interface QuizAttempt {
  id: number;
  documentId: string;
  student: AuthUser;
  quiz: Quiz;
  course?: Course;
  score: number;
  totalQuestions: number;
  answers: QuizAttemptAnswer[] | any;
  submittedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface StrapiContext {
  state: {
    user?: AuthUser;
    [key: string]: any;
  };
  params: Record<string, any>;
  query: Record<string, any>;
  request: {
    body?: any;
    query?: any;
    header?: any;
    [key: string]: any;
  };
  forbidden(reason?: string): any;
  notFound(reason?: string): any;
  badRequest(reason?: string): any;
  unauthorized?(reason?: string): any;
  send?(data?: any, status?: number): any;
  [key: string]: any;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface RouteConfig {
  auth?: boolean | { scope?: string[] } | Record<string, any>;
  policies?: (string | Record<string, any>)[];
  middlewares?: (string | Record<string, any>)[];
  prefix?: string;
  [key: string]: any;
}

export interface Route {
  method: HttpMethod;
  path: string;
  handler: string;
  config?: RouteConfig;
}

export interface CustomRoutes {
  routes: Route[];
}

