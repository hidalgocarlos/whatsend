-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "ctas" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "cuerpos" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "saludos" TEXT NOT NULL DEFAULT '[]';
