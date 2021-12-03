const { Worker, QueueScheduler } = require('bullmq');
const Redis = require('ioredis');
const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const { uploadPosterToCloud } = require('./cloudService');
const { addEvent, updatePoster } = require('./store');

const { REDIS_CONNECTION_STRING } = require('../constants');

const CLIENT_URL = 'http://localhost:5000';
const RENDER_TIMEOUT = 24 * 60 * 60 * 1000;
const MAX_RENDER_ATTEMPTS = 3;
const SCALE = 96 / 72;

let browser = null;

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

  await page.emulateMedia('screen');

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
}

const connection = new Redis(REDIS_CONNECTION_STRING, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue scheduler to restart stopped jobs.
const queueScheduler = new QueueScheduler('generator', { connection });

// Worker implementation
const worker = new Worker(
  'generator',
  async job => {
    const { options } = job.data;
    await generate(options);
  },
  { connection },
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

process.on('SIGINT', () => {
  console.log('Shutting down worker...');
  worker.close(true);
  queueScheduler.close();
  process.exit(0);
});
