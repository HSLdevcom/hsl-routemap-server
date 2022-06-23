const { Worker, QueueScheduler } = require('bullmq');
const Redis = require('ioredis');
const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const { uploadPosterToCloud } = require('./cloudService');
const { addEvent, getPoster, updatePoster } = require('./store');

const { REDIS_CONNECTION_STRING } = require('../constants');

const CLIENT_URL = 'http://localhost:5000';
const RENDER_TIMEOUT = 24 * 60 * 60 * 1000;
const MAX_RENDER_ATTEMPTS = 3;
const SCALE = 96 / 72;

let browser = null;
let currentJob = null;

const outputPath = path.join(__dirname, '..', 'output');
const pdfPath = id => path.join(outputPath, `${id}.pdf`);

async function initialize() {
  browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  browser.on('disconnected', () => {
    browser = null;
  });
}

/**
 * Renders component to PDF file
 * @returns {Promise}
 */
async function renderComponent(options) {
  const { id, props, onInfo, onError } = options;
  props.id = id;
  const page = await browser.newPage();

  page.on('error', error => {
    page.close();
    browser.close();
    onError(error);
  });

  page.on('console', ({ type, text }) => {
    if (['error', 'warning', 'log'].includes(type)) {
      onInfo(`Console(${type}): ${text}`);
    }
  });

  const encodedProps = encodeURIComponent(JSON.stringify(props));
  const renderUrl = `${CLIENT_URL}/?props=${encodedProps}`;
  console.log(renderUrl);

  await page.goto(renderUrl);

  const { error, width, height } = await page.evaluate(
    () =>
      new Promise(resolve => {
        window.callPhantom = opts => resolve(opts);
      }),
  );

  if (error) {
    throw new Error(error);
  }

  await page.emulateMediaType('screen');

  let printOptions = {};
  if (props.printTimetablesAsA4) {
    printOptions = {
      printBackground: true,
      format: 'A4',
      margin: 0,
    };
  } else {
    printOptions = {
      printBackground: true,
      width: width * SCALE,
      height: height * SCALE,
      pageRanges: '1',
      scale: SCALE,
    };
  }

  const contents = await page.pdf(printOptions);

  await fs.outputFile(pdfPath(id), contents);
  await page.close();
  await uploadPosterToCloud(pdfPath(id));
}

async function renderComponentRetry(options) {
  const { onInfo, onError } = options;
  for (let i = 0; i < MAX_RENDER_ATTEMPTS; i++) {
    /* eslint-disable no-await-in-loop */

    // Check if the job was manually cancelled. Do not restart the rendering process.
    const poster = await getPoster({ id: options.id });
    if (poster.status === 'FAILED' || !poster) {
      onInfo('Failed or canceled');
      return { success: false };
    }
    try {
      onInfo(i > 0 ? 'Retrying' : 'Rendering');

      if (!browser) {
        onInfo('Creating new browser instance');
        await initialize();
      }

      const timeout = new Promise((resolve, reject) =>
        setTimeout(reject, RENDER_TIMEOUT, new Error('Render timeout')),
      );

      await Promise.race([renderComponent(options), timeout]);
      onInfo('Rendered successfully');
      return { success: true };
    } catch (error) {
      onError(error);
    }
  }

  return { success: false };
}

/**
 * Adds component to render queue
 * @param {Object} options
 * @param {string} options.id - Unique id
 * @param {Object} options.props - Props to pass to component
 */

async function generate(options) {
  const { id } = options;
  currentJob = id;

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

  const { success } = await renderComponentRetry({
    ...options,
    onInfo,
    onError,
  });

  updatePoster({ id, status: success ? 'READY' : 'FAILED' });
  currentJob = null;
}

const bullRedisConnection = new Redis(REDIS_CONNECTION_STRING, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue scheduler to restart stopped jobs.
// TODO: If multiple services, move to separeted microservice! Only few instances maximum needed for the cluster.
// Not needed for local dev environment.
const queueScheduler = new QueueScheduler('generator', { connection: bullRedisConnection });

// Worker implementation
const worker = new Worker(
  'generator',
  async job => {
    const { options } = job.data;
    await generate(options);
  },
  { connection: bullRedisConnection },
);

console.log('Worker ready for jobs!');

worker.on('active', job => {
  console.log(`Started to process ${job.id}`);
});

worker.on('completed', job => {
  console.log(`${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`${job.id} has failed with ${err.message}`);
});

worker.on('drained', () => console.log('Job queue empty! Waiting for new jobs...'));

// While bullmq doesn't support cancelling the jobs, this helper will do it by closing the browser.
const cancelSignalRedis = new Redis(REDIS_CONNECTION_STRING);

cancelSignalRedis.subscribe('cancel', err => {
  if (err) {
    console.error('Failed to start listening to cancellation signals: %s', err.message);
  } else {
    console.log('Listening to cancellation signals.');
  }
});

cancelSignalRedis.on('message', (channel, message) => {
  if (channel === 'cancel') {
    console.log(`Received cancellation signal for id ${message}`);
    if (message === currentJob) {
      console.log('The job was in progress on this worker! Terminating it...');
      if (browser) {
        browser.close();
      }
    }
  }
});

// Make sure all the connections will be removed.
process.on('SIGINT', () => {
  console.log('Shutting down worker...');
  worker.close(true);
  queueScheduler.close();
  cancelSignalRedis.disconnect();
  cancelSignalRedis.quit();
  process.exit(0);
});
