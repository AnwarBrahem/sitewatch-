import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set in backend/.env!');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase cloud connection
  },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});
