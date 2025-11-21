import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
  {
    name: 'Vêtements',
    description: 'Tous types de vêtements pour hommes, femmes et enfants',
    icon: '👕',
    color: '#FF6B6B',
    isDefault: true
  },
  {
    name: 'Technologie',
    description: 'Électronique, smartphones, ordinateurs et accessoires tech',
    icon: '💻',
    color: '#4ECDC4',
    isDefault: true
  },
  {
    name: 'Decorations',
    description: 'Objets de décoration pour la maison et le bureau',
    icon: '🏠',
    color: '#45B7D1',
    isDefault: true
  },
  {
    name: 'Beauté',
    description: 'Produits de beauté, cosmétiques et soins personnels',
    icon: '💄',
    color: '#F7DC6F',
    isDefault: true
  },
  {
    name: 'Accessoires',
    description: 'Accessoires de mode, bijoux et articles complémentaires',
    icon: '👜',
    color: '#BB8FCE',
    isDefault: true
  },
  {
    name: 'Sport',
    description: 'Équipements sportifs, vêtements de sport et accessoires',
    icon: '⚽',
    color: '#85C1E9',
    isDefault: true
  },
  {
    name: 'Enfants & Bébé',
    description: 'Produits pour enfants et bébés, jouets et articles de puériculture',
    icon: '👶',
    color: '#F8C471',
    isDefault: true
  }
];

async function seedDefaultCategories() {
  console.log('🌱 Seeding default categories...');

  for (const categoryData of defaultCategories) {
    const existingCategory = await prisma.category.findFirst({
      where: { name: categoryData.name }
    });

    if (!existingCategory) {
      await prisma.category.create({
        data: categoryData
      });
      console.log(`✅ Created category: ${categoryData.name}`);
    } else {
      console.log(`⚠️  Category already exists: ${categoryData.name}`);
    }
  }

  console.log('🎉 Default categories seeding completed!');
}

seedDefaultCategories()
  .catch((e) => {
    console.error('❌ Error seeding categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
