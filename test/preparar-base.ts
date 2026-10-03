import { execSync } from 'child_process';

/**
 * Os testes e2e correm contra um PostgreSQL real (DATABASE_URL_TESTE).
 * Aplica as migrações e os dados iniciais; não apaga nada, por isso os testes
 * usam números de telefone novos em cada execução.
 */
export default function prepararBase() {
  const url = process.env.DATABASE_URL_TESTE;
  if (!url)
    throw new Error('Defina DATABASE_URL_TESTE (uma base só para testes).');
  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('npx prisma db seed', { stdio: 'inherit', env });
}
