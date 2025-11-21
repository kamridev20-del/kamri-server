const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function cleanDescription(description) {
  if (!description) return '';
  
  // 1. Supprimer HTML
  let cleaned = description
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
  
  // 2. Supprimer CSS (itératif)
  let cssRemoved = cleaned;
  let previousLength = 0;
  let iterations = 0;
  while (cssRemoved.length !== previousLength && iterations < 10) {
    previousLength = cssRemoved.length;
    iterations++;
    cssRemoved = cssRemoved
      .replace(/#[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      .replace(/\.[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      .replace(/@media[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      .replace(/[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      .replace(/\{[^{}]*\}/g, '')
      .trim();
  }
  cleaned = cssRemoved;
  
  // 3. Supprimer markdown
  cleaned = cleaned
    .replace(/###\s*[^\n]+/g, '')
    .replace(/##\s*[^\n]+/g, '')
    .replace(/#\s*[^\n]+/g, '')
    .replace(/\*\*[^\*]+\*\*/g, '')
    .replace(/\*[^\*]+\*/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/⚠️\s*NOTES\s*IMPORTANTES[^\n]*/gi, '')
    .replace(/\*\*\s*##\s*⚠️[^\n]*/gi, '')
    .replace(/🎨\s*Couleurs\s*disponibles[^\n]*/gi, '')
    .replace(/🎯\s*Tailles\s*disponibles[^\n]*/gi, '')
    .trim();
  
  // 4. Supprimer "Technical Details" et tout ce qui suit
  // Chercher "Technical Details" même collé à d'autres mots
  cleaned = cleaned.replace(/Technical\s+Details?[\s\S]*$/i, '');
  cleaned = cleaned.replace(/Technical\s+Specifications?[\s\S]*$/i, '');
  
  // 5. Supprimer les spécifications techniques individuelles
  const specPatterns = [
    /Bike\s+Type:\s*[^\n]+/gi, /Age\s+Range[^\n]+/gi, /Number\s+of\s+Speeds?:\s*[^\n]+/gi,
    /Wheel\s+Size:\s*[^\n]+/gi, /Frame\s+Material:\s*[^\n]+/gi, /Suspension\s+Type:\s*[^\n]+/gi,
    /Accessories?:\s*[^\n]+/gi, /Included\s+Components?:\s*[^\n]+/gi, /Brake\s+Style:\s*[^\n]+/gi,
    /Cartoon\s+Character:\s*[^\n]+/gi, /Wheel\s+Width:\s*[^\n]+/gi,
    /Specific\s+Uses?\s+For\s+Product:\s*[^\n]+/gi, /Voltage:\s*[^\n]+/gi,
    /Theme:\s*[^\n]+/gi, /Style:\s*[^\n]+/gi, /Power\s+Source:\s*[^\n]+/gi,
    /Wattage:\s*[^\n]+/gi, /Wheel\s+Material:\s*[^\n]+/gi,
    /Lithium\s+Battery\s+Energy\s+Content:\s*[^\n]+/gi, /Seat\s+Material\s+Type:\s*[^\n]+/gi,
    /Warranty\s+Type:\s*[^\n]+/gi, /Maximum\s+Weight:\s*[^\n]+/gi,
    /Assembly\s+Required:\s*[^\n]+/gi, /Bicycle\s+Gear\s+Shifter\s+Type:\s*[^\n]+/gi,
    /Number\s+of\s+Handles?:\s*[^\n]+/gi, /Item\s+Package\s+Dimensions?[^\n]+/gi,
    /Package\s+Weight:\s*[^\n]+/gi, /Item\s+Dimensions?[^\n]+/gi,
    /Material:\s*[^\n]+/gi, /Suggested\s+Users?:\s*[^\n]+/gi, /Part\s+Number:\s*[^\n]+/gi,
  ];
  specPatterns.forEach(pattern => cleaned = cleaned.replace(pattern, ''));
  
  // 6. Supprimer les patterns mal formatés (ex: "26InchesFrameMaterial")
  cleaned = cleaned.replace(/[0-9]+Inches[A-Z][a-zA-Z]+/g, '');
  cleaned = cleaned.replace(/[A-Z][a-zA-Z]+[A-Z][a-zA-Z]+:\s*[A-Z]/g, '');
  
  // 7. Nettoyer espaces
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .trim();
  
  return cleaned;
}

(async () => {
  try {
    const product = await prisma.product.findFirst({
      where: { name: { contains: 'Professional Electric Bike' } },
      select: { id: true, name: true, description: true }
    });
    
    if (!product) {
      console.log('❌ Produit non trouvé');
      await prisma.$disconnect();
      return;
    }
    
    console.log('\n🧹 === NETTOYAGE PRODUIT ===\n');
    console.log(`📦 Produit: ${product.name.substring(0, 60)}...`);
    console.log(`📝 Description avant: ${product.description?.length || 0} caractères\n`);
    
    const cleaned = cleanDescription(product.description || '');
    
    console.log(`📝 Description après: ${cleaned.length} caractères\n`);
    console.log('✅ Aperçu nettoyé (premiers 500 car):');
    console.log(`"${cleaned.substring(0, 500)}..."\n`);
    
    if (cleaned !== product.description && cleaned.length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: { description: cleaned }
      });
      console.log('✅ Produit nettoyé et mis à jour !\n');
    } else {
      console.log('⏭️  Aucun changement nécessaire\n');
    }
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();

