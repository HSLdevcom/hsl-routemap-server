const Koa = require('koa');
const Router = require('koa-router');
const session = require('koa-session');
const cors = require('@koa/cors');
const jsonBody = require('koa-json-body');
const { get } = require('lodash');
const authEndpoints = require('./auth/authEndpoints');
const generator = require('./generator');
const {
  migrate,
  addEvent,
  getBuilds,
  getBuild,
  addBuild,
  updateBuild,
  removeBuild,
  getPoster,
  addPoster,
  updatePoster,
  removePoster,
  getConfig,
  setDateConfig,
  setStatusConfig,
} = require('./store');
const { generatePoints } = require('./joreStore');
const { downloadPostersFromCloud } = require('./cloudService');

const PORT = 4000;

async function generatePoster(buildId, props) {
  const { id } = await addPoster({ buildId, props });

  const onInfo = message => {
    const date = new Date().toUTCString();
    console.log(`${date} ${id}: ${message}`); // eslint-disable-line no-console
    addEvent({ posterId: id, type: 'INFO', message });
  };
  const onError = error => {
    const date = new Date().toUTCString();
    console.error(`${date} ${id}: ${error.message} ${error.stack}`); // eslint-disable-line no-console
    addEvent({ posterId: id, type: 'ERROR', message: error.message });
  };

  const options = {
    id,
    props,
    onInfo,
    onError,
  };

  generator
    .generate(options)
    .then(({ success }) => updatePoster({ id, status: success ? 'READY' : 'FAILED' }))
    .catch(error => console.error(error)); // eslint-disable-line no-console

  return { id };
}

const errorHandler = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.body = { message: error.message };
    console.error(error); // eslint-disable-line no-console
  }
};

async function main() {
  await migrate();

  const app = new Koa();
  const router = new Router();

  router.get('/builds', async ctx => {
    const builds = await getBuilds();
    ctx.body = builds;
  });

  router.get('/builds/:id', async ctx => {
    const { id } = ctx.params;
    const builds = await getBuild({ id });
    ctx.body = builds;
  });

  router.post('/builds', async ctx => {
    const { title } = ctx.request.body;
    const build = await addBuild({ title });
    ctx.body = build;
  });

  router.put('/builds/:id', async ctx => {
    const { id } = ctx.params;
    const { status } = ctx.request.body;
    const build = await updateBuild({
      id,
      status,
    });
    ctx.body = build;
  });

  router.delete('/builds/:id', async ctx => {
    const { id } = ctx.params;
    const build = await removeBuild({ id });
    ctx.body = build;
  });

  router.get('/posters/:id', async ctx => {
    const { id } = ctx.params;
    const poster = await getPoster({ id });
    ctx.body = poster;
  });

  router.post('/posters', async ctx => {
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

  router.post('/cancelPoster', async ctx => {
    const { item } = ctx.request.body;
    console.log('cancellll');
    const onInfo = message => {
      const date = new Date().toUTCString();
      console.log(`${date} ${item.id}: ${message}`); // eslint-disable-line no-console
    };
    const options = {
      id: item.id,
      onInfo,
    };
    const poster = await updatePoster({ id: item.id, status: 'FAILED' });
    generator.cancelProcess(options);

    ctx.body = poster;
  });

  router.post('/removePosters', async ctx => {
    const { item } = ctx.request.body;
    const poster = await removePoster({ id: item.id });

    ctx.body = poster;
  });

  router.get('/downloadBuild/:id', async ctx => {
    const { id } = ctx.params;
    const { title, posters } = await getBuild({ id });
    const posterIds = posters.filter(poster => poster.status === 'READY').map(poster => poster.id);
    await downloadPostersFromCloud(posterIds);
    const content = await generator.concatenate(posterIds);

    ctx.type = 'application/pdf';
    ctx.set('Content-Disposition', `attachment; filename="${title}-${id}.pdf"`);
    ctx.body = content;

    content.on('close', () => {
      generator.removeFiles([id]);
    });
  });

  router.get('/downloadPoster/:id', async ctx => {
    const { id } = ctx.params;
    const poster = await getPoster({ id });
    const name = get(poster, 'props.configuration.name');
    await downloadPostersFromCloud([id]);
    const content = await generator.concatenate([id]);

    ctx.type = 'application/pdf';
    ctx.set('Content-Disposition', `attachment; filename="${name}.pdf"`);
    ctx.body = content;

    content.on('close', () => {
      generator.removeFiles([id]);
    });
  });

  router.post('/import', async ctx => {
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

  router.get('/config', async ctx => {
    ctx.body = await getConfig();
  });

  router.post('/login', async ctx => {
    const authResponse = await authEndpoints.authorize(ctx.request, ctx.response, ctx.session);
    ctx.session = null;
    if (authResponse.modifiedSession) {
      ctx.session = authResponse.modifiedSession;
    }
    ctx.body = authResponse.body;
    ctx.response.status = authResponse.status;
  });

  router.get('/logout', async ctx => {
    const authResponse = await authEndpoints.logout(ctx.request, ctx.response, ctx.session);
    ctx.session = null;
    ctx.response.status = authResponse.status;
  });

  router.get('/session', async ctx => {
    const authResponse = await authEndpoints.checkExistingSession(
      ctx.request,
      ctx.response,
      ctx.session,
    );
    ctx.body = authResponse.body;
    ctx.response.status = authResponse.status;
  });

  app.keys = ['secret key'];

  app.use(session(app));

  app
    .use(errorHandler)
    .use(
      cors({
        credentials: true,
      }),
    )
    .use(jsonBody({ fallback: true, limit: '10mb' }))
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(PORT, () => console.log(`Listening at ${PORT}`)); // eslint-disable-line no-console
}

main().catch(error => console.error(error)); // eslint-disable-line no-console
