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

async function getConfig() {
  const configs = await knex('intermediate_points_status')
    .select('*')
    .where({ name: 'default' });
  if (configs.length === 1) {
    return configs[0];
  }
  return null;
}

async function setDateConfig(date) {
  const oldConfig = await getConfig();
  if (oldConfig) {
    await knex('intermediate_points_status')
      .where({ name: 'default' })
      .update({
        target_date: date,
        status: 'PENDING',
      });
  } else {
    await knex('intermediate_points_status').insert({
      name: 'default',
      status: 'PENDING',
      target_date: date,
    });
  }
  return getConfig();
}

async function setUpdatedAtConfig() {
  const oldConfig = await getConfig();
  if (oldConfig) {
    await knex('intermediate_points_status')
      .where({ name: 'default' })
      .update({
        updated_at: new Date().toISOString(),
      });
  } else {
    await knex('intermediate_points_status').insert({
      name: 'default',
      updated_at: new Date().toISOString(),
    });
  }
  return getConfig();
}

async function setStatusConfig(status) {
  const oldConfig = await getConfig();
  if (oldConfig) {
    await knex('intermediate_points_status')
      .where({ name: 'default' })
      .update({ status });
  } else {
    await knex('intermediate_points_status').insert({ status, name: 'default' });
  }
  return getConfig();
}

module.exports = {
  generatePoints,
  setDateConfig,
  setStatusConfig,
  setUpdatedAtConfig,
  getConfig,
};
