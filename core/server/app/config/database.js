const { Sequelize } = require('sequelize');
const { logger } = require('../lib/myf.velixs.js');

const { DB_DATABASE, DB_USERNAME, DB_PASSWORD, DB_HOST, DB_PORT, DB_CONNECTION } = process.env;

// Validate dialect and provide a default fallback
const DIALECT = DB_CONNECTION || 'mysql'; // Default to 'mysql' if not provided

if (!['mysql', 'postgres', 'sqlite', 'mariadb', 'mssql'].includes(DIALECT)) {
    logger('error', `[DB] Invalid dialect: ${DIALECT}. Please use mysql, postgres, sqlite, mariadb, or mssql.`);
    process.exit(1);
}

// Convert DB_PORT to an integer
const PORT = DB_PORT ? parseInt(DB_PORT, 10) : undefined;

const sequelize = new Sequelize(DB_DATABASE, DB_USERNAME, DB_PASSWORD, {
    host: DB_HOST,
    port: PORT,
    dialect: DIALECT,
    logging: false,
});

async function connectDatabase() {
    try {
        await sequelize.authenticate();
        logger('info', `[DB] Database connection established successfully.`);
    } catch (error) {
        logger('error', `[DB] Unable to connect to the database: ${error.message}`);
        process.exit(1);
    }
}

module.exports = {
    sequelize,
    connectDatabase,
};
