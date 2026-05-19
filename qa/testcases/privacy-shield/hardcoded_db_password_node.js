const { Client } = require('pg');

async function connectToDatabase() {
  // Vulnerable: Hardcoded Database Password in Connection String
  const connectionString = 'postgresql://admin:SuperSecretPassword123!@localhost:5432/production_db';

  const client = new Client({
    connectionString: connectionString,
  });

  await client.connect();
  console.log('Successfully connected to the database');
  return client;
}