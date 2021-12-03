const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

const outputPath = path.join(__dirname, '..', 'output');
const pdfPath = id => path.join(outputPath, `${id}.pdf`);

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
  concatenate,
  removeFiles,
};
