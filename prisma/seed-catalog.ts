/**
 * SERT каталогын DB-ге жүктеу (PDF экстракциясынан).
 * Дереккөз: _catalog_extract/manifest.json + images/*
 * Идемпотентті: sku = "SERT-NNN" бойынша upsert, әр қайтаруда суреттер ауыстырылады.
 *
 * Қолдану:  npx ts-node prisma/seed-catalog.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Seed деректері репода (prisma/catalog-data) — деплойда Railway импорттайды.
const EXTRACT = path.join(process.cwd(), 'prisma', 'catalog-data');
const IMAGES = path.join(EXTRACT, 'images');

const TRANSLIT: Record<string, string> = {
  а:'a',ә:'a',б:'b',в:'v',г:'g',ғ:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',
  к:'k',қ:'q',л:'l',м:'m',н:'n',ң:'n',о:'o',ө:'o',п:'p',р:'r',с:'s',т:'t',у:'u',
  ұ:'u',ү:'u',ф:'f',х:'h',һ:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',і:'i',
  ь:'',э:'e',ю:'yu',я:'ya',
};
function slugify(s: string): string {
  let out = '';
  for (const ch of (s || '').toLowerCase().trim()) {
    if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/[\s\-_.]/.test(ch)) out += '-';
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'product';
}

interface Item {
  page: number; category: string; name: string; model: string | null;
  price: number | null; material: string | null; size: string | null;
  description: string; image: string;
}

async function main() {
  const manifestPath = path.join(EXTRACT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('Каталог seed: manifest.json жоқ — өткізілді');
    return;
  }
  const manifest: Item[] = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Манифест: ${manifest.length} тауар`);

  // Идемпотенттік: импорт бұрын жасалса (барлық SERT тауары бар) — өткіземіз.
  const already = await prisma.product.count({ where: { sku: { startsWith: 'SERT-' } } });
  if (already >= manifest.length) {
    console.log(`Каталог seed: ${already} SERT тауары бар — өткізілді`);
    return;
  }

  const usedSlugs = new Set<string>();
  let created = 0, updated = 0, imgCount = 0, skipped = 0;

  for (let i = 0; i < manifest.length; i++) {
    const it = manifest[i];
    const sku = `SERT-${String(i + 1).padStart(3, '0')}`;
    try {
      const imgPath = path.join(IMAGES, it.image);
      if (!fs.existsSync(imgPath)) { skipped++; continue; }
      const bytes = fs.readFileSync(imgPath);

      // бірегей slug
      const base = slugify(it.name);
      let slug = base, n = 1;
      while (usedSlugs.has(slug)) { n++; slug = `${base}-${n}`; }
      usedSlugs.add(slug);

      const data = {
        name: it.name,
        category: it.category,
        description: it.description || null,
        unit: 'шт',
        price: it.price != null ? new Prisma.Decimal(it.price) : null,
        currency: 'KZT',
        isPublished: true,
        sortOrder: i,
      };

      const existing = await prisma.product.findUnique({ where: { sku } });
      let productId: string;
      if (existing) {
        await prisma.product.update({ where: { sku }, data });
        await prisma.productImage.deleteMany({ where: { productId: existing.id } });
        productId = existing.id;
        updated++;
      } else {
        const p = await prisma.product.create({ data: { ...data, sku, slug } });
        productId = p.id;
        created++;
      }

      await prisma.productImage.create({
        data: {
          productId,
          data: bytes,
          mimeType: 'image/jpeg',
          sizeBytes: bytes.length,
          sortOrder: 0,
        },
      });
      imgCount++;
    } catch (e: any) {
      // Деплойды бұғаттамаймыз — бір тауардың қатесін елемей жалғастырамыз.
      console.error(`Каталог seed қатесі (${sku}):`, e?.message || e);
    }
  }

  console.log(`✓ Жасалды: ${created}, жаңартылды: ${updated}, суреттер: ${imgCount}, өткізілді: ${skipped}`);
  const total = await prisma.product.count();
  console.log(`DB-дегі барлық тауар: ${total}`);
}

main()
  // НАЗАР: ешқашан exit(1) жасамаймыз — start:prod тізбегі серверге жетуі керек.
  .catch((e) => { console.error('Каталог seed жалпы қатесі:', e?.message || e); })
  .finally(() => prisma.$disconnect());
