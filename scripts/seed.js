'use strict';

/**
 * Manual seed entrypoint — loads Strapi and runs bootstrap seed logic
 * (roles, permissions, demo users, sample courses, lessons, quizzes, blog posts).
 *
 * Usage: npm run seed
 */
async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';
  console.log('LMS seed completed via bootstrap.');

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
