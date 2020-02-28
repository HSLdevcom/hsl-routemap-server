const { PG_ROUTEMAP_CONNECTION_STRING } = require('./constants');

if (!PG_ROUTEMAP_CONNECTION_STRING) {
  throw new Error('PG_ROUTEMAP_CONNECTION_STRING variable is not set');
}

module.exports = {
  client: 'pg',
  connection: PG_ROUTEMAP_CONNECTION_STRING,
};
