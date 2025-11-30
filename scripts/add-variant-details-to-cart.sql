-- Migration pour ajouter variantId et variantDetails à la table cart_items
-- Date: 2025-01-01

-- Ajouter la colonne variantId (optionnelle)
ALTER TABLE cart_items 
ADD COLUMN IF NOT EXISTS "variantId" TEXT;

-- Ajouter la colonne variantDetails (JSON, optionnelle)
ALTER TABLE cart_items 
ADD COLUMN IF NOT EXISTS "variantDetails" JSONB;

-- Ajouter un index sur variantId pour améliorer les performances
CREATE INDEX IF NOT EXISTS "cart_items_variantId_idx" ON cart_items("variantId");

-- Ajouter la contrainte de clé étrangère vers product_variants
-- Note: On utilise ON DELETE SET NULL car variantId est optionnel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cart_items_variantId_fkey'
    ) THEN
        ALTER TABLE cart_items
        ADD CONSTRAINT "cart_items_variantId_fkey" 
        FOREIGN KEY ("variantId") 
        REFERENCES product_variants(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON COLUMN cart_items."variantId" IS 'ID du variant choisi (optionnel)';
COMMENT ON COLUMN cart_items."variantDetails" IS 'Détails du variant (taille, couleur, etc.) au format JSON';


