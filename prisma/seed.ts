import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories - 7 catégories fixes (avec upsert)
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Mode' },
      update: {},
      create: {
        name: 'Mode',
        description: 'Vêtements et accessoires de mode',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Technologie' },
      update: {},
      create: {
        name: 'Technologie',
        description: 'Électronique et gadgets technologiques',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Maison' },
      update: {},
      create: {
        name: 'Maison',
        description: 'Décoration et équipement de la maison',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Beauté' },
      update: {},
      create: {
        name: 'Beauté',
        description: 'Produits de beauté et soins',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Accessoires' },
      update: {},
      create: {
        name: 'Accessoires',
        description: 'Accessoires et petits objets',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Sport' },
      update: {},
      create: {
        name: 'Sport',
        description: 'Équipement et vêtements de sport',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Enfants' },
      update: {},
      create: {
        name: 'Enfants',
        description: 'Produits pour enfants et bébés',
      },
    }),
  ]);

  console.log('✅ Categories created');

  // Create admin user only
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@kamri.com' },
    update: {},
    create: {
      email: 'admin@kamri.com',
      name: 'Admin KAMRI',
      password: hashedPassword, // ✅ Mot de passe hashé
      role: 'admin',
      status: 'active',
    },
  });

  console.log('✅ Admin user created');

  console.log('🎉 Database seeded successfully!');
  console.log('📝 Base de données vide - prête pour les tests');
  console.log('🔑 Connexion admin: admin@kamri.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });