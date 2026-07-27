export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  tls?: Record<string, never>;
}

export function redisConnectionFromUrl(redisUrl: string): RedisConnectionOptions {
  const parsed = new URL(redisUrl);
  const dbPath = parsed.pathname.replace('/', '');

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    db: dbPath ? Number(dbPath) : 0,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
