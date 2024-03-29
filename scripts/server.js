const Koa = require('koa');
const Router = require('koa-router');
const session = require('koa-session');
const cors = require('@koa/cors');
const jsonBody = require('koa-json-body');
const { get } = require('lodash');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const authEndpoints = require('./auth/authEndpoints');
const fileHandler = require('./fileHandler');
const {
  migrate,
  getBuilds,
  getBuild,
  addBuild,
  updateBuild,
  removeBuild,
  getPoster,
  addPoster,
  updatePoster,
  removePoster,
} = require('./store');
const {
  generatePoints,
  getConfig,
  setDateConfig,
  setStatusConfig,
  setUpdatedAtConfig,
} = require('./joreStore');
const { downloadPostersFromCloud } = require('./cloudService');

const { REDIS_CONNECTION_STRING } = require('../constants');

const PORT = 4000;

const bullRedisConnection = new Redis(REDIS_CONNECTION_STRING, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const queue = new Queue('generator', { connection: bullRedisConnection });

const cancelSignalRedis = new Redis(REDIS_CONNECTION_STRING); // New connection to make sure that pub/sub will work correctly.

async function generatePoster(buildId, props) {
  const { id } = await addPoster({ buildId, props });

  const options = {
    id,
    props,
  };

  queue.add('generate', { options }, { jobId: id });

  return { id };
}

const errorHandler = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.body = { message: error.message };
    if (ctx.status !== 401) {
      console.error(error); // eslint-disable-line no-console
    }
  }
};

const authMiddleware = async (ctx, next) => {
  const endpointsNotRequiringAuthentication = ['/login', '/logout', '/session'];
  if (endpointsNotRequiringAuthentication.includes(ctx.path)) {
    // Do not check the authentication beforehands for session related paths.
    await next();
  } else {
    const authResponse = await authEndpoints.checkExistingSession(
      ctx.request,
      ctx.response,
      ctx.session,
    );

    if (!authResponse.body.isOk) {
      // Not authenticated, throw 401
      ctx.throw(401);
    } else {
      await next();
    }
  }
};

async function main() {
  await migrate();

  const app = new Koa();
  const router = new Router();
  const unAuthorizedRouter = new Router();

  router.get('/builds', async (ctx) => {
    const builds = await getBuilds();
    ctx.body = builds;
  });

  router.get('/builds/:id', async (ctx) => {
    const { id } = ctx.params;
    const builds = await getBuild({ id });
    ctx.body = builds;
  });

  router.post('/builds', async (ctx) => {
    const { title } = ctx.request.body;
    const build = await addBuild({ title });
    ctx.body = build;
  });

  router.put('/builds/:id', async (ctx) => {
    const { id } = ctx.params;
    const { status } = ctx.request.body;
    const build = await updateBuild({
      id,
      status,
    });
    ctx.body = build;
  });

  router.delete('/builds/:id', async (ctx) => {
    const { id } = ctx.params;
    const build = await removeBuild({ id });
    ctx.body = build;
  });

  router.get('/posters/:id', async (ctx) => {
    const { id } = ctx.params;
    const poster = await getPoster({ id });
    ctx.body = poster;
  });

  router.post('/posters', async (ctx) => {
    const { buildId, props } = ctx.request.body;
    const authResponse = await authEndpoints.checkExistingSession(
      ctx.request,
      ctx.response,
      ctx.session,
    );
    if (!authResponse.body.isOk) {
      ctx.throw(401, 'Not allowed.');
    }
    const posters = [];
    for (let i = 0; i < props.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      const poster = await generatePoster(buildId, props[i]);
      posters.push(poster);
    }
    ctx.body = posters;
  });

  router.post('/cancelPoster', async (ctx) => {
    const { item } = ctx.request.body;
    const jobId = item.id;

    const poster = await updatePoster({ id: jobId, status: 'FAILED' });
    const success = await queue.remove(jobId);
    if (!success) {
      // The job is already being processed. Terminate the worker operation.
      cancelSignalRedis.publish('cancel', jobId);
    }

    ctx.body = poster;
  });

  router.post('/removePosters', async (ctx) => {
    const { item } = ctx.request.body;
    const poster = await removePoster({ id: item.id });

    ctx.body = poster;
  });

  router.get('/downloadBuild/:id', async (ctx) => {
    const { id } = ctx.params;
    const { title, posters } = await getBuild({ id });
    const posterIds = posters
      .filter((poster) => poster.status === 'READY')
      .map((poster) => poster.id);
    await downloadPostersFromCloud(posterIds);
    const content = await fileHandler.concatenate(posterIds);

    ctx.type = 'application/pdf';
    ctx.set('Content-Disposition', `attachment; filename="${title}-${id}.pdf"`);
    ctx.body = content;

    content.on('close', () => {
      fileHandler.removeFiles([id]);
    });
  });

  router.get('/downloadPoster/:id', async (ctx) => {
    const { id } = ctx.params;
    const poster = await getPoster({ id });
    const name = get(poster, 'props.configuration.name');
    await downloadPostersFromCloud([id]);
    const content = await fileHandler.concatenate([id]);

    ctx.type = 'application/pdf';
    ctx.set('Content-Disposition', `attachment; filename="${name}.pdf"`);
    ctx.body = content;

    content.on('close', () => {
      fileHandler.removeFiles([id]);
    });
  });

  router.post('/import', async (ctx) => {
    const { targetDate } = ctx.query;
    let config = await getConfig();
    if (config && config.status === 'PENDING') {
      ctx.throw(503, `Already running for date: ${config.target_date}`);
    } else if (!targetDate) {
      ctx.throw(400, 'Missing targetDate query parameter');
    } else {
      config = await setDateConfig(targetDate);
      await generatePoints(config.target_date)
        .then(async () => {
          await setStatusConfig('READY');
        })
        .catch(async () => {
          await setStatusConfig('ERROR');
        });
      ctx.body = config;
    }
  });

  router.get('/config', async (ctx) => {
    ctx.body = await getConfig();
  });

  router.post('/login', async (ctx) => {
    const authResponse = await authEndpoints.authorize(ctx.request, ctx.response, ctx.session);
    ctx.session = null;
    if (authResponse.modifiedSession) {
      ctx.session = authResponse.modifiedSession;
    }
    ctx.body = authResponse.body;
    ctx.response.status = authResponse.status;
  });

  router.get('/logout', async (ctx) => {
    const authResponse = await authEndpoints.logout(ctx.request, ctx.response, ctx.session);
    ctx.session = null;
    ctx.response.status = authResponse.status;
  });

  router.get('/session', async (ctx) => {
    const authResponse = await authEndpoints.checkExistingSession(
      ctx.request,
      ctx.response,
      ctx.session,
    );
    ctx.body = authResponse.body;
    ctx.response.status = authResponse.status;
  });

  unAuthorizedRouter.get('/health', async (ctx) => {
    ctx.status = 200;
  });

  app.keys = ['secret key'];

  const CONFIG = {
    renew: true,
    maxAge: 86400000 * 30,
  };

  app.use(session(CONFIG, app));

  app
    .use(errorHandler)
    .use(unAuthorizedRouter.routes())
    .use(
      cors({
        credentials: true,
      }),
    )
    .use(authMiddleware)
    .use(jsonBody({ fallback: true, limit: '10mb' }))
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(PORT, () => console.log(`Listening at ${PORT}`)); // eslint-disable-line no-console
}

main().catch((error) => console.error(error)); // eslint-disable-line no-console
