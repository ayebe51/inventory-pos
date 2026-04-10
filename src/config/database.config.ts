import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  replicaUrl: process.env.DATABASE_REPLICA_URL,
}));
