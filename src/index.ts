import type { Core } from '@strapi/strapi';
import { resolveUserFromBearer } from './utils/auth';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    /**
     * Strapi's users-permissions authenticate step returns 401 when a Bearer
     * token is present but its internal verify path fails, instead of falling
     * back to public permissions. We resolve the user manually, attach it to
     * ctx.state, then remove the header so content-api auth can proceed.
     * Because Strapi evaluates the Public role at that layer, bootstrap
     * mirrors all API permissions onto Public; controllers enforce real roles.
     */
    strapi.server.use(async (ctx, next) => {
      if (!ctx.path.startsWith('/api/')) {
        return next();
      }

      const authorization = ctx.request.header.authorization;
      if (!authorization?.startsWith('Bearer ')) {
        return next();
      }

      const user = await resolveUserFromBearer(ctx);
      if (user) {
        ctx.state.user = user;
      }

      delete ctx.request.header.authorization;
      await next();
    });
  },

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
        'plugin::users-permissions.user.me',
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
        'api::lesson.lesson.reorderCourseLessons',
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
        'api::blog-post.blog-post.listManageBlogPosts',
        'api::enrollment.enrollment.find',
        'api::enrollment.enrollment.findOne',
      ];

      const contentManagerPermissions = [
        'plugin::users-permissions.user.me',
        'plugin::users-permissions.role.find',
        'plugin::users-permissions.role.findOne',
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
        'api::lesson.lesson.reorderCourseLessons',
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
        'api::blog-post.blog-post.listManageBlogPosts',
        'api::enrollment.enrollment.find',
        'api::enrollment.enrollment.findOne',
        'api::lesson-progress.lesson-progress.getCourseProgress',
      ];

      const instructorPermissions = [
        'plugin::users-permissions.user.me',
        'plugin::users-permissions.role.find',
        'plugin::users-permissions.role.findOne',
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
        'api::lesson.lesson.reorderCourseLessons',
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
        'api::enrollment.enrollment.find',
        'api::enrollment.enrollment.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
      ];

      const studentPermissions = [
        'plugin::users-permissions.role.find',
        'plugin::users-permissions.role.findOne',
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
        'api::quiz-attempt.quiz-attempt.create',
        'api::quiz-attempt.quiz-attempt.find',
        'api::quiz-attempt.quiz-attempt.findOne',
        'api::blog-post.blog-post.find',
        'api::blog-post.blog-post.findOne',
        'plugin::users-permissions.user.me',
      ];

      const publicAuthPermissions = [
        'plugin::users-permissions.auth.callback',
        'plugin::users-permissions.auth.register',
        'plugin::users-permissions.auth.connect',
        'plugin::users-permissions.auth.forgotPassword',
        'plugin::users-permissions.auth.resetPassword',
        'plugin::users-permissions.auth.emailConfirmation',
        'plugin::users-permissions.auth.sendEmailConfirmation',
        'plugin::users-permissions.auth.refresh',
        'plugin::users-permissions.auth.logout',
      ];

      const publicPermissions = [
        ...new Set([
          ...publicAuthPermissions,
          ...adminPermissions,
          ...contentManagerPermissions,
          ...instructorPermissions,
          ...studentPermissions,
        ]),
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

      const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
      const storedAdvanced = await pluginStore.get({ key: 'advanced' });
      const normalizedAdvanced =
        storedAdvanced && typeof storedAdvanced === 'object' ? storedAdvanced : {};

      await pluginStore.set({
        key: 'advanced',
        value: {
          ...normalizedAdvanced,
          unique_email: true,
          allow_register: true,
          email_confirmation: false,
          email_reset_password: null,
          email_confirmation_redirection: null,
          default_role: 'student',
        },
      });

      const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });
      if (authenticatedRole && rolesMap['student']) {
        const legacyUsers = await strapi.query('plugin::users-permissions.user').findMany({
          where: { role: authenticatedRole.id },
        });
        for (const legacyUser of legacyUsers) {
          await strapi.query('plugin::users-permissions.user').update({
            where: { id: legacyUser.id },
            data: { role: rolesMap['student'].id },
          });
        }
        if (legacyUsers.length > 0) {
          console.log(`Migrated ${legacyUsers.length} authenticated user(s) to student role.`);
        }
      }

      const demoPassword = 'Password123!';

      const ensureDemoUser = async (config: {
        username: string;
        email: string;
        roleType: keyof typeof rolesMap;
      }) => {
        let user = await strapi.query('plugin::users-permissions.user').findOne({
          where: { email: config.email },
        });

        if (!user) {
          user = await strapi.plugins['users-permissions'].services.user.add({
            username: config.username,
            email: config.email,
            password: demoPassword,
            role: rolesMap[config.roleType].id,
            confirmed: true,
          });
          console.log(`Seeded ${config.roleType} user: ${config.email}`);
        }

        return user;
      };

      const adminUser = await ensureDemoUser({
        username: 'md_mokaddess_hossain_adnan',
        email: 'admin@lms.com',
        roleType: 'admin',
      });
      await ensureDemoUser({
        username: 'emily_parker',
        email: 'manager@lms.com',
        roleType: 'content_manager',
      });
      const instructorUser = await ensureDemoUser({
        username: 'john_doe',
        email: 'instructor@lms.com',
        roleType: 'instructor',
      });
      const instructorRobert = await ensureDemoUser({
        username: 'robert_watson',
        email: 'cameron@lms.com',
        roleType: 'instructor',
      });
      const instructorSarah = await ensureDemoUser({
        username: 'sarah_mitchell',
        email: 'eleanor@lms.com',
        roleType: 'instructor',
      });
      const instructorJames = await ensureDemoUser({
        username: 'james_cooper',
        email: 'marcus@lms.com',
        roleType: 'instructor',
      });
      await ensureDemoUser({
        username: 'alex_turner',
        email: 'student@lms.com',
        roleType: 'student',
      });

      // Publish any existing draft courses in database
      const draftCourses = await strapi.documents('api::course.course').findMany({
        status: 'draft',
      });
      for (const draftCourse of draftCourses) {
        await strapi.documents('api::course.course').publish({
          documentId: draftCourse.documentId,
        });
      }

      // Seed Initial Sample Data if less than 4 courses exist
      const existingCoursesCount = await strapi.documents('api::course.course').count({});
      if (existingCoursesCount < 4) {
        console.log('Seeding multiple LMS sample courses, lessons, quizzes, and blog posts...');

        // --- Course 1: Next.js 16 & Strapi v5 ---
        const course1 = await strapi.documents('api::course.course').create({
          data: {
            title: 'Full-Stack Web Development with Next.js 16 & Strapi v5',
            description: 'Master modern full-stack web application development using Next.js App Router, Server Actions, React 19, and Strapi CMS.',
            coverImageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
            owner: instructorRobert.id,
          },
          status: 'published',
        });

        await strapi.documents('api::lesson.lesson').create({
          data: {
            title: 'Introduction to Next.js App Router & React 19',
            content: 'In this lesson, we cover the core concepts of App Router directory structures, Server Components, and Server Actions.',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            order: 1,
            course: course1.documentId,
          },
          status: 'published',
        });

        await strapi.documents('api::lesson.lesson').create({
          data: {
            title: 'Building Secure Role-Based Access Control in Strapi v5',
            content: 'Explore Strapi v5 document service, custom controller overrides, and role-based permissions matrix.',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            order: 2,
            course: course1.documentId,
          },
          status: 'published',
        });

        const quiz1 = await strapi.documents('api::quiz.quiz').create({
          data: {
            title: 'Next.js & Strapi Core Fundamentals Checkpoint',
            course: course1.documentId,
          },
          status: 'published',
        });

        await strapi.documents('api::question.question').create({
          data: {
            text: 'What rendering model does Next.js App Router use by default?',
            options: ['Server Components', 'Client Components', 'Static HTML Only', 'Pure SPA'],
            correctAnswer: 0,
            order: 1,
            quiz: quiz1.documentId,
          },
          status: 'published',
        });

        await strapi.documents('api::question.question').create({
          data: {
            text: 'Which setting in Strapi schema.json hides sensitive fields from API outputs?',
            options: ['"hidden": true', '"private": true', '"secret": true', '"protected": true'],
            correctAnswer: 1,
            order: 2,
            quiz: quiz1.documentId,
          },
          status: 'published',
        });

        // --- Course 2: Node.js Microservices ---
        const course2 = await strapi.documents('api::course.course').create({
          data: {
            title: 'Node.js & Microservices Architecture Masterclass',
            description: 'Learn to design, build, and deploy resilient asynchronous microservices using Node.js, Express, Docker, and Redis.',
            coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
            owner: instructorJames.id,
          },
          status: 'published',
        });

        await strapi.documents('api::lesson.lesson').create({
          data: {
            title: 'Event-Driven Architecture & Message Queues',
            content: 'Learn how to handle high-throughput inter-service communication with RabbitMQ and Redis Pub/Sub.',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            order: 1,
            course: course2.documentId,
          },
          status: 'published',
        });

        await strapi.documents('api::lesson.lesson').create({
          data: {
            title: 'Containerizing Node.js Services with Docker',
            content: 'Write multi-stage Dockerfiles and compose files for multi-container development environments.',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            order: 2,
            course: course2.documentId,
          },
          status: 'published',
        });

        const quiz2 = await strapi.documents('api::quiz.quiz').create({
          data: {
            title: 'Microservices & Async Messaging Assessment',
            course: course2.documentId,
          },
          status: 'published',
        });

        await strapi.documents('api::question.question').create({
          data: {
            text: 'Which pattern helps handle partial system failures in distributed microservices?',
            options: ['Circuit Breaker', 'Singleton', 'Factory Pattern', 'Decorator'],
            correctAnswer: 0,
            order: 1,
            quiz: quiz2.documentId,
          },
          status: 'published',
        });

        // --- Course 3: Tailwind CSS v4 & Modern UI/UX ---
        const course3 = await strapi.documents('api::course.course').create({
          data: {
            title: 'UI/UX Design Systems & Tailwind CSS v4',
            description: 'Build scalable, accessible component libraries and modern responsive user interfaces with Tailwind CSS v4 and Figma.',
            coverImageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8',
            owner: instructorSarah.id,
          },
          status: 'published',
        });

        await strapi.documents('api::lesson.lesson').create({
          data: {
            title: 'Designing Accessible Component Tokens',
            content: 'Master design tokens, color contrast guidelines, and typography scales for enterprise design systems.',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            order: 1,
            course: course3.documentId,
          },
          status: 'published',
        });

        // --- Course 4: Docker & Kubernetes ---
        await strapi.documents('api::course.course').create({
          data: {
            title: 'Docker & Kubernetes',
            description:
              'Learn how to build, deploy, and manage modern containerized applications using Docker and Kubernetes. This course covers container fundamentals, Docker images and containers, networking, storage, Docker Compose, Kubernetes architecture, Pods, Deployments, Services, ConfigMaps, Secrets, and application scaling. By the end, students will be able to confidently containerize applications and deploy, manage, and scale them in Kubernetes environments.',
            coverImageUrl:
              'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNZLadao95KY1QrFuqSKyEb41Ydcs-JiF1-EyVtxNgYbx0JniYJj6QPe3X&s=10',
            owner: instructorUser.id,
          },
          status: 'published',
        });

        // --- Seed blog posts (6 published + 1 admin draft) ---
        const existingBlogPosts = await strapi.documents('api::blog-post.blog-post').count({});
        if (existingBlogPosts < 7) {
          const sampleArticles = [
            {
              title: 'The Future of Web Development: Mastering Next.js 16 and React 19',
              slug: 'the-future-of-web-development-nextjs-16',
              body: 'Web development in 2026 is defined by unprecedented performance, server components, and streaming architectures. In this deep dive, we explore how Next.js 16 leverage React 19 primitives, Server Actions, and Turbopack to deliver instant page transitions and exceptional SEO.\n\n### Key Highlights:\n- Server Actions vs Traditional API Routes\n- React Server Components Streaming Patterns\n- Zero-Bundle-Size Server Primitives\n- Optimizing Database Queries with Edge Caching',
              author: adminUser.id,
            },
            {
              title: 'Why Practical-Based Learning is Replacing Traditional Computer Science Lectures',
              slug: 'why-practical-learning-is-replacing-traditional-lectures',
              body: 'Traditional education often struggles with knowledge retention because theoretical models lack real-world feedback loops. Interactive coding checkpoints, automated milestone scoring, and sequential curriculum design enable students to learn 3x faster with tangible portfolio projects.\n\n### Core Benefits:\n- Instant Error Feedback & Debugging Muscle Memory\n- Industry-Aligned Project Milestones\n- High-Retention Active Problem Solving\n- Verifiable Skill Badges for Employers',
              author: instructorUser.id,
            },
            {
              title: 'Mastering Tailwind CSS v4: The Engine, Tokens, and Design Systems',
              slug: 'mastering-tailwind-css-v4-design-systems',
              body: 'Tailwind CSS v4 introduces a revolutionary Rust-powered engine that transforms utility-first CSS authoring. Discover how to create enterprise-grade design systems with fluid typography scales, semantic color variables, and zero configuration setup.\n\n### What You Will Learn:\n- CSS-First Configuration with @theme\n- Dynamic Color Spaces: OKLCH & P3 Gamut\n- Micro-Animations with Motion Primitives\n- Building Accessible Component Libraries',
              author: instructorUser.id,
            },
            {
              title: 'Building Resilient Microservices with Node.js, Redis, and Docker',
              slug: 'building-resilient-microservices-nodejs-redis',
              body: 'Scaling backend architectures requires decoupling monolithic dependencies into resilient, independently deployable services. Here is an architectural blueprint for implementing message queues, distributed caching, and graceful error handling.\n\n### Architecture Topics:\n- Asynchronous Pub/Sub with Redis\n- Multi-Stage Docker Builds for Node.js\n- Circuit Breakers & Exponential Backoff\n- Distributed Tracing and OpenTelemetry',
              author: adminUser.id,
            },
            {
              title: '10 Proven Tips to Ace Your Technical Coding Interviews in 2026',
              slug: '10-proven-tips-technical-coding-interviews',
              body: 'Navigating today’s engineering hiring landscape requires a blend of algorithmic intuition, scalable system design thinking, and effective technical communication. Here are the 10 proven strategies top candidates use to land dream offers.\n\n### The 10 Principles:\n1. Master Pattern Recognition Over Rote Memorization\n2. Communicate Trade-offs Early in System Design\n3. Write Production-Quality Clean Code in Live Sessions\n4. Practice Timed Mock Interviews Regularly',
              author: instructorUser.id,
            },
            {
              title: 'The Rise of Headless CMS: Why Modern Teams Choose Strapi v5',
              slug: 'the-rise-of-headless-cms-strapi-v5',
              body: 'Monolithic content management systems create rigid silos and slow development velocity. Headless CMS solutions like Strapi v5 empower frontend teams with complete presentation freedom while providing editors with an intuitive, role-governed authoring workspace.\n\n### Strapi v5 Advantages:\n- Unified Document Service API\n- Granular Role-Based Access Control (RBAC)\n- Multi-Publish Workflow & Draft Previews\n- Native TypeScript & Modern Plugin Ecosystem',
              author: adminUser.id,
            },
            {
              title: 'Launching Next-Generation LMS with Strapi & Next.js',
              slug: 'launching-next-generation-lms-strapi-nextjs',
              body: 'Building a production-ready Learning Management System requires strict backend permission enforcement and clean frontend integration...',
              author: adminUser.id,
              status: 'draft' as const,
            },
          ];

          for (const article of sampleArticles) {
            const exists = await strapi.documents('api::blog-post.blog-post').findFirst({
              filters: { slug: article.slug },
            });
            if (!exists) {
              const { status = 'published', ...articleData } = article;
              await strapi.documents('api::blog-post.blog-post').create({
                data: articleData,
                status,
              });
            }
          }
        }

        console.log('Multiple sample LMS courses, lessons, quizzes, questions, and blog posts seeded successfully!');
      }

      // Bootstrap-seeded permissions are not always returned by role.load('permissions'),
      // which breaks JWT auth for every content API route (401 while /session/me still works).
      const permissionService = strapi.plugin('users-permissions').service('permission');
      permissionService.findRolePermissions = async (roleID: number) =>
        strapi.db.query('plugin::users-permissions.permission').findMany({
          where: { role: { id: roleID } },
        });
    } catch (err) {
      console.error('Error seeding roles/permissions/data in bootstrap:', err);
    }
  },
};
