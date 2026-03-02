import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const email = (process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@whatsend.local').trim().toLowerCase();
const newPassword = process.env.NEW_ADMIN_PASSWORD;

if (!newPassword || String(newPassword).length < 6) {
  console.error('Uso: define NEW_ADMIN_PASSWORD y ejecuta el script.');
  console.error('PowerShell: $env:NEW_ADMIN_PASSWORD = "tu_clave"; node scripts/set-admin-password.js');
  console.error('Bash: NEW_ADMIN_PASSWORD=tu_clave node scripts/set-admin-password.js');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('No existe usuario con email:', email);
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  console.log('Contraseña del admin actualizada:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
