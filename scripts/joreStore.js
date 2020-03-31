const config = require('../knexfile_jore');
// eslint-disable-next-line import/order
const knex = require('knex')(config);
const cleanup = require('./cleanup');

// Must cleanup knex, otherwise the process keeps going.
cleanup(() => {
  knex.destroy();
});

async function generatePoints(date) {
  return knex.raw('select jorestatic.create_intermediate_points(?)', [date]);
}

module.exports = {
  generatePoints,
};
