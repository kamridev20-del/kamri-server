-- Script SQL direct pour ajouter variantId et variantDetails à cart_items
-- À exécuter avec: PGPASSWORD=avUQefgltUYjOGVtXyouUFwtEyeLshdY psql -h yamabiko.proxy.rlwy.net -U postgres -p 28846 -d railway -f apply-variant-details-direct.sql

-- Connexion à la base de données
\c railway

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

-- Vérification
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'cart_items' 
AND column_name IN ('variantId', 'variantDetails');


