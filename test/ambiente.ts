// Corre antes de qualquer import: o ConfigModule lê o ambiente quando o AppModule é importado.
process.env.DATABASE_URL = process.env.DATABASE_URL_TESTE;
process.env.JWT_SECRET = 'jwt-de-teste';
process.env.CANAIS_SEGREDO_WEBHOOK = 'segredo-de-teste';
