/**
 * Dados iniciais: botijas, zonas e tarifas do documento de preço, e um depósito e bairros de exemplo.
 * Pode correr-se várias vezes (não duplica nada nem sobrepõe preços já alterados na central).
 *
 * Os valores são a proposta inicial do documento "preço do transporte por distância e
 * enquadramento legal" e devem ser confirmados (preço oficial da 51 kg, custos por zona).
 */
import { PerfilUtilizador, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const producao = process.env.NODE_ENV === 'production';

const PRODUTOS = [
  { codigo: '12KG', nome: 'Botija 12 kg', pesoKg: 12, precoRecarga: 1200 },
  { codigo: '51KG', nome: 'Botija 51 kg', pesoKg: 51, precoRecarga: 5100 },
];

// [numero, nome, kmMax, exigeOrcamento, taxa 12 kg, taxa 51 kg, por km 12 kg, por km 51 kg]
const ZONAS: [
  number,
  string,
  number | null,
  boolean,
  number,
  number,
  number,
  number,
][] = [
  [1, 'Zona 1 (até 3 km)', 3, false, 1000, 2000, 0, 0],
  [2, 'Zona 2 (3 a 7 km)', 7, false, 1500, 2500, 0, 0],
  [3, 'Zona 3 (7 a 12 km)', 12, false, 2000, 3500, 0, 0],
  [4, 'Zona 4 (12 a 20 km)', 20, false, 3000, 5000, 0, 0],
  [5, 'Fora de zona (mais de 20 km)', null, true, 3000, 5000, 150, 250],
];

// Exemplo para o piloto (coordenadas aproximadas do centro de cada bairro).
// A zona fica por classificar: até lá calcula-se pela distância ao depósito.
const BAIRROS: [string, string, number, number][] = [
  ['Talatona', 'Talatona', -8.917, 13.183],
  ['Benfica', 'Talatona', -8.95, 13.15],
  ['Camama', 'Talatona', -8.948, 13.24],
  ['Kilamba', 'Belas', -8.996, 13.27],
  ['Viana', 'Viana', -8.903, 13.374],
  ['Zango', 'Viana', -8.99, 13.41],
  ['Maianga', 'Luanda', -8.826, 13.233],
];

async function main() {
  const produtos = [];
  for (const p of PRODUTOS) {
    produtos.push(
      await prisma.produto.upsert({
        where: { codigo: p.codigo },
        create: p,
        update: {},
      }),
    );
  }
  const [p12, p51] = produtos;

  for (const [
    numero,
    nome,
    kmMax,
    exigeOrcamento,
    t12,
    t51,
    km12,
    km51,
  ] of ZONAS) {
    const zona = await prisma.zonaEntrega.upsert({
      where: { numero },
      create: { numero, nome, kmMax, exigeOrcamento },
      update: {},
    });
    for (const [produto, valor, valorPorKm] of [
      [p12, t12, km12],
      [p51, t51, km51],
    ] as const) {
      await prisma.tarifaEntrega.upsert({
        where: { zonaId_produtoId: { zonaId: zona.id, produtoId: produto.id } },
        create: { zonaId: zona.id, produtoId: produto.id, valor, valorPorKm },
        update: {},
      });
    }
  }

  await prisma.configuracao.upsert({
    where: { chave: 'preco.percentagemBotijaAdicional' },
    create: { chave: 'preco.percentagemBotijaAdicional', valor: '50' },
    update: {},
  });

  if ((await prisma.deposito.count()) === 0) {
    await prisma.deposito.create({
      data: { nome: 'Depósito Talatona (exemplo)', lat: -8.92, lng: 13.19 },
    });
  }

  for (const [nome, municipio, lat, lng] of BAIRROS) {
    await prisma.bairro.upsert({
      where: { nome_municipio: { nome, municipio } },
      create: { nome, municipio, lat, lng },
      update: {},
    });
  }

  const email =
    process.env.SEED_ADMIN_EMAIL ?? (producao ? undefined : 'admin@gasja.ao');
  const password =
    process.env.SEED_ADMIN_PASSWORD ??
    (producao ? undefined : 'gasja-admin-dev');
  if (email && password) {
    await prisma.utilizador.upsert({
      where: { email },
      create: {
        nome: 'Administrador',
        email,
        perfil: PerfilUtilizador.ADMIN,
        passwordHash: await bcrypt.hash(password, 10),
      },
      update: {},
    });
  }

  if (!producao) {
    await prisma.condutor.upsert({
      where: { telefone: '+244923000001' },
      create: {
        nome: 'Condutor de teste',
        telefone: '+244923000001',
        pinHash: await bcrypt.hash('1234', 10),
        veiculo: 'Moto',
        matricula: 'LD-00-00',
      },
      update: {},
    });
  }

  console.log('Dados iniciais prontos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
