const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const moment = require('moment');
const { spawn } = require('child_process');
const { uploadPosterToCloud } = require('./cloudService');

const { getPoster, getBuilds, getBuild } = require('./store');

const CLIENT_URL = 'http://localhost:5000';
const RENDER_TIMEOUT = 24 * 60 * 60 * 1000;
const MAX_RENDER_ATTEMPTS = 3;
const SCALE = 96 / 72;

let browser = null;
let previous = Promise.resolve();

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

  const poster = await getPoster({ id: options.id });
  const { status } = poster;

  if (status === 'FAILED' || !poster) {
    page.close();
    browser.close();
    onInfo('Canceled');
  }
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
    const poster = await getPoster({ id: options.id });
    if (poster.status === 'FAILED' || !poster) {
      i = MAX_RENDER_ATTEMPTS;
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

async function getPosterInProgress(builds) {
  const allPendingPosters = [];
  const buildsWithPending = builds.filter(build => build.pending > 0);
  for (let i = 0; i < buildsWithPending.length; i++) {
    /* eslint-disable no-await-in-loop */
    const build = await getBuild({ id: buildsWithPending[i].id });
    const pendingPosters = build.posters.filter(poster => poster.status === 'PENDING');
    allPendingPosters.push(...pendingPosters);
  }
  allPendingPosters.sort((a, b) => moment(b.createdAt) - moment(a.createdAt));
  return allPendingPosters[0];
}

async function cancelProcess(options) {
  const builds = await getBuilds();
  const posterInProgress = await getPosterInProgress(builds);
  if (posterInProgress && options.id === posterInProgress.id) {
    if (browser) {
      browser.close();
      options.onInfo('Canceled');
    }
    return true;
  }
  return false;
}

/**
 * Adds component to render queue
 * @param {Object} options
 * @param {string} options.id - Unique id
 * @param {Object} options.props - Props to pass to component
 * @param {function} options.onInfo - Callback (string)
 * @param {function} options.onError - Callback (Error)
 * @returns {Promise} - Always resolves with { success }
 */
function generate(options) {
  previous = previous.then(() => renderComponentRetry(options));
  return previous;
}

/**
 * Concatenates posters to a multi-page PDF
 * @param {Object} options
 * @param {string[]} options.ids - Ids to concatate
 * @returns {Readable} - PDF stream
 */
function concatenate(ids) {
  const filenames = ids.map(id => pdfPath(id));
  const pdftk = spawn('pdftk', [...filenames, 'cat', 'output', '-']);
  pdftk.stderr.on('data', data => {
    pdftk.stdout.emit('error', new Error(data.toString()));
  });
  return pdftk.stdout;
}

async function removeFiles(ids) {
  const filenames = ids.map(id => pdfPath(id));
  const removePromises = [];

  filenames.forEach(filename => {
    const createPromise = async () => {
      try {
        await fs.remove(filename);
      } catch (err) {
        console.log(`Pdf ${filename} removal unsuccessful.`);
        console.error(err);
      }
    };

    removePromises.push(createPromise());
  });

  await Promise.all(removePromises);
}

module.exports = {
  generate,
  concatenate,
  removeFiles,
  cancelProcess,
};
