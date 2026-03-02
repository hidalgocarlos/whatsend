import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@whatsend.local').trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin ya existe:', email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name: 'Administrador',
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('Admin creado:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
