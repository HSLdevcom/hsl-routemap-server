exports.up = async knex => {
  await knex.schema.dropTable('routepath_import_config');
};

exports.down = async knex => {
  await knex.schema.createTable('routepath_import_config', table => {
    table.string('name').primary();
    table.date('target_date').notNullable();
    table.enu('status', ['READY', 'PENDING', 'ERROR', 'EMPTY']);
    table.timestamps(true, true);
  });
};
