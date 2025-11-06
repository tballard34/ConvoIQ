import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * SPA Fallback Route
 * 
 * This catch-all route handles the SPA routing problem:
 * When you refresh or directly navigate to /components/comp-llm-001,
 * the browser makes a server request for that path. Since there's no
 * file at that path, we need to serve index.html and let the client-side
 * router take over.
 * 
 * This route:
 * 1. Matches all paths with low priority (so API/static files take precedence)
 * 2. Serves the index.html from the web directory
 * 3. Lets React Router handle the actual routing
 */
export default async (server: any, { logger }: any) => {
  // Read the index.html file once at startup
  const indexPath = join(__dirname, '../../../web/index.html');
  let indexHtml: string;
  
  try {
    indexHtml = readFileSync(indexPath, 'utf-8');
    logger.info('SPA fallback route loaded successfully');
  } catch (error) {
    logger.error(`Failed to read index.html: ${(error as Error).message}`);
    throw error;
  }

  // Catch-all route - this will match any path that hasn't been matched yet
  server.route({
    url: '*',
    method: 'GET',
    handler: async (request, reply) => {
      // Skip if this looks like an API request
      const path = request.url;
      
      // Don't intercept GraphQL or other API endpoints
      if (path.startsWith('/graphql') || 
          path.startsWith('/api/') ||
          path.startsWith('/_')) {
        return reply.code(404).send({ error: 'Not found' });
      }

      // Serve the SPA index.html
      reply
        .type('text/html')
        .code(200)
        .send(indexHtml);
    }
  });
};

