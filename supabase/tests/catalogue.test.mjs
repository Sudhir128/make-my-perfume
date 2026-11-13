// Catalogue migration tests: runs the three migrations plus the rollback on an
// in-memory Postgres (PGlite) with Supabase's anon / authenticated /
// service_role roles mimicked, and checks constraints, RLS and the views.
// PGlite is deliberately NOT a project dependency. To run:
//   mkdir %TEMP%\pg && cd %TEMP%\pg && npm init -y && npm i @electric-sql/pglite
//   copy this file there, then: node catalogue.test.mjs <path to this repo>
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const root = process.argv[2];
const MIG = ['20261110061340_catalogue_schema', '20261110061345_catalogue_rls_and_views', '20261110061349_catalogue_seed_taxonomy'].map((n) => fs.readFileSync(`${root}/supabase/migrations/${n}.sql`, 'utf8'));
const DOWN = fs.readFileSync(`${root}/supabase/rollbacks/20261110_catalogue_down.sql`, 'utf8');

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail = '') {
  (ok ? pass++ : fail++);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   <-- ${detail}`}`);
}
async function rejects(db, sql, expect, name) {
  try { await db.exec(sql); check(name, false, 'statement succeeded but should have failed'); }
  catch (e) { check(name, expect ? expect.test(String(e.message)) : true, `wrong error: ${String(e.message).slice(0, 110)}`); }
}
async function rows(db, sql) { return (await db.query(sql)).rows; }
async function asRole(db, role, fn) {
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}

async function fresh() {
  const db = new PGlite();
  // Supabase's API roles and default privileges, mimicked.
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  return db;
}

const db = await fresh();
await db.exec(MIG[0]);
await db.exec(MIG[1]);
await db.exec(MIG[2]);

// ── guard + seed ────────────────────────────────────────────────────
await rejects(db, MIG[0], /Catalogue tables already exist/, 'migration 1 refuses to run when catalogue tables already exist');
check('seed: 7 categories', (await rows(db, 'select count(*)::int n from categories'))[0].n === 7);
check('seed: 6 scent families', (await rows(db, 'select count(*)::int n from scent_families'))[0].n === 6);
await db.exec(MIG[2]);
check('seed is idempotent (re-run adds nothing)', (await rows(db, 'select (select count(*) from categories)::int c, (select count(*) from scent_families)::int f'))[0].c === 7);
check('seed: no products, variants or stock', (await rows(db, 'select (select count(*) from products)::int + (select count(*) from product_variants)::int + (select count(*) from inventory)::int n'))[0].n === 0);

// ── constraints ─────────────────────────────────────────────────────
await db.exec(`insert into products (id, product_key, source_title, source_url) values ('00000000-0000-0000-0000-000000000001','k1','Source Title One','https://example.com/1')`);
check('draft product with no public title or slug is allowed', true);
await rejects(db, `insert into product_variants (product_id, sku, size_ml, price_inr) values ('00000000-0000-0000-0000-000000000001','K1-50',50,0)`, /price_inr_check|violates check/, 'a price of 0 is rejected');
await rejects(db, `insert into product_variants (product_id, sku, size_ml, price_inr) values ('00000000-0000-0000-0000-000000000001','k1-50',50,100)`, /violates check/, 'lowercase SKU is rejected');
await rejects(db, `insert into product_variants (product_id, sku, size_ml, price_inr, compare_at_inr) values ('00000000-0000-0000-0000-000000000001','K1-50',50,100,150)`, /variants_compare_at_approved_ck/, 'a compare-at price without approval is rejected');
await rejects(db, `insert into product_variants (product_id, sku, size_ml, price_inr, compare_at_inr, compare_at_approved_at) values ('00000000-0000-0000-0000-000000000001','K1-50',50,100,90,now())`, /variants_compare_at_ck/, 'a compare-at price not above the selling price is rejected');
await rejects(db, `insert into product_variants (product_id, sku, size_ml, price_inr, sale_starts_at, sale_ends_at) values ('00000000-0000-0000-0000-000000000001','K1-50',50,100, now(), now() - interval '1 day')`, /variants_sale_window_ck/, 'a sale window that ends before it starts is rejected');
await db.exec(`insert into product_variants (id, product_id, sku, size_ml, price_inr, is_active) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','K1-50',50,1000,true)`);
await rejects(db, `insert into product_variants (product_id, sku, size_ml, price_inr) values ('00000000-0000-0000-0000-000000000001','K1-50B',50,900)`, /product_id, size_ml|unique/, 'one product cannot have two variants of the same size');
await rejects(db, `insert into products (product_key) values ('k1')`, /unique/, 'product_key is unique (idempotent import key)');
await rejects(db, `insert into products (product_key, status, title, slug, approved_at, published_at) values ('kx','published','T','t',now(),now())`, /without an active variant/, 'a product cannot be created already published (no variant yet)');
await rejects(db, `update products set status='published' where product_key='k1'`, /products_published_ck/, 'publishing needs title, slug, approval and publish time');
await db.exec(`insert into product_scent_families (product_id, family_id) select '00000000-0000-0000-0000-000000000001', id from scent_families where slug in ('fresh','woody')`);
check('a product can carry several scent families', (await rows(db, `select count(*)::int n from product_scent_families`))[0].n === 2);
await rejects(db, `insert into inventory (variant_id, quantity) values ('00000000-0000-0000-0000-0000000000a1', -1)`, /violates check/, 'negative stock is rejected');
await db.exec(`insert into inventory (variant_id) values ('00000000-0000-0000-0000-0000000000a1')`);
check('inventory defaults to unknown availability, no quantity', (await rows(db, `select availability, quantity from inventory`))[0].availability === 'unknown');
await rejects(db, `insert into product_images (product_id) values ('00000000-0000-0000-0000-000000000001')`, /product_images_location_ck/, 'an image needs a storage path or URL');
await rejects(db, `insert into product_import_rows (batch_id, source_sheet, source_row, original) values (gen_random_uuid(),'s',1,'{}')`, /foreign key/, 'import rows must belong to a batch');
await db.exec(`insert into product_import_batches (id, source_file, source_sha256) values ('00000000-0000-0000-0000-0000000000b1','x.xlsx','abc')`);
await rejects(db, `insert into product_import_batches (source_file, source_sha256) values ('x.xlsx','abc')`, /unique/, 'the same source file (hash) cannot be staged twice');
await db.exec(`insert into product_import_rows (batch_id, source_sheet, source_row, original) values ('00000000-0000-0000-0000-0000000000b1','Website Products',2,'{"price":"0"}')`);
await rejects(db, `insert into product_import_rows (batch_id, source_sheet, source_row, original) values ('00000000-0000-0000-0000-0000000000b1','Website Products',2,'{}')`, /unique/, 're-importing the same source row is rejected (no duplicates)');

// ── fixtures for the security tests ─────────────────────────────────
await db.exec(`
  insert into products (id, product_key, slug, title, status, approved_at, published_at, source_title, source_url) values
   ('00000000-0000-0000-0000-000000000002','p2','draft-two',null,'draft',null,null,'Draft Source','https://x/2');
  -- published products need a variant first, then the status flip
  insert into products (id, product_key) values
   ('00000000-0000-0000-0000-000000000003','p3'), ('00000000-0000-0000-0000-000000000004','p4'),
   ('00000000-0000-0000-0000-000000000005','p5'), ('00000000-0000-0000-0000-000000000006','p6');
  insert into product_variants (id, product_id, sku, size_ml, price_inr, compare_at_inr, compare_at_approved_at, sale_starts_at, sale_ends_at, is_active) values
   ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','K1-100',100,1500,null,null,null,null,false),
   ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000002','K2-50',50,500,null,null,null,null,true),
   ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-000000000003','K3-50',50,800,1000,now(),now()-interval '1 day',now()+interval '1 day',true),
   ('00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-000000000004','K4-50',50,800,1000,now(),now()+interval '5 days',now()+interval '9 days',true),
   ('00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-000000000005','K5-50',50,800,1000,now(),now()-interval '9 days',now()-interval '5 days',true),
   ('00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-000000000006','K6-50',50,700,null,null,null,null,true);
  update products set title='Test One', slug='test-one', status='published', approved_at=now(), published_at=now()-interval '3 days' where product_key='k1';
  update products set title='Test Three', slug='test-three', status='published', approved_at=now(), published_at=now()-interval '2 days' where product_key='p3';
  update products set title='Test Four', slug='test-four', status='published', approved_at=now(), published_at=now()-interval '1 day' where product_key='p4';
  update products set title='Test Five', slug='test-five', status='published', approved_at=now(), published_at=now()-interval '4 days' where product_key='p5';
  update products set title='Test Six', slug='test-six', status='published', approved_at=now(), published_at=now()+interval '7 days' where product_key='p6';
  insert into product_categories (product_id, category_id) select p.id, c.id from products p join categories c on (p.product_key,c.slug) in (('k1','mens-perfumes'),('p3','inspired-fragrances'),('p2','womens-perfumes'));
  insert into inventory (variant_id, quantity, availability) values
   ('00000000-0000-0000-0000-0000000000a4', 12, 'in_stock'),
   ('00000000-0000-0000-0000-0000000000a3', 5, 'low_stock'),   -- variant of a DRAFT product
   ('00000000-0000-0000-0000-0000000000a2', 9, 'in_stock');    -- INACTIVE variant of a published product
  insert into product_images (product_id, url, alt_text, sort_order, verification_status) values
   ('00000000-0000-0000-0000-000000000001','https://img/1-ok','ok',0,'verified'),
   ('00000000-0000-0000-0000-000000000001','https://img/1-un','un',1,'unverified'),
   ('00000000-0000-0000-0000-000000000002','https://img/2-ok','draft',0,'verified');
`);
check('a product can be published once it has an active variant, title, slug and approval', (await rows(db, `select count(*)::int n from products where status='published'`))[0].n === 5);

for (const role of ['anon', 'authenticated']) {
  const R = (sql) => asRole(db, role, () => rows(db, sql));
  const denied = async (sql, name) => asRole(db, role, async () => { await rejects(db, sql, /permission denied|row-level security/, `${role}: ${name}`); });
  const slugs = (await R(`select slug from products order by slug`)).map((r) => r.slug);
  check(`${role}: sees only published, scheduled-in-the-past products`, JSON.stringify(slugs) === JSON.stringify(['test-five', 'test-four', 'test-one', 'test-three']), JSON.stringify(slugs));
  await denied(`select source_url from products`, 'cannot read source_url');
  await denied(`select source_title from products`, 'cannot read source_title');
  await denied(`select product_key from products`, 'cannot read product_key');
  const skus = (await R(`select sku from product_variants order by sku`)).map((r) => r.sku);
  check(`${role}: sees active variants of published products only`, JSON.stringify(skus) === JSON.stringify(['K1-50', 'K3-50', 'K4-50', 'K5-50']), JSON.stringify(skus));
  const inv = (await R(`select variant_id from inventory order by variant_id`)).map((r) => r.variant_id.slice(-2));
  check(`${role}: inventory availability shown only for visible variants (a1 and a4; not the draft's a3 or the inactive a2)`, JSON.stringify(inv) === JSON.stringify(['a1', 'a4']), JSON.stringify(inv));
  await denied(`select quantity from inventory`, 'cannot read stock quantity');
  await denied(`select * from product_import_batches`, 'cannot read import batches');
  await denied(`select * from product_import_rows`, 'cannot read import rows');
  const imgs = (await R(`select url from product_images`)).map((r) => r.url);
  check(`${role}: sees verified images of published products only`, JSON.stringify(imgs) === JSON.stringify(['https://img/1-ok']), JSON.stringify(imgs));
  check(`${role}: category links shown only for published products`, (await R(`select count(*)::int n from product_categories`))[0].n === 2);
  await denied(`insert into products (product_key) values ('hack')`, 'cannot insert products');
  await denied(`update products set title='hacked'`, 'cannot update products');
  await denied(`delete from products`, 'cannot delete products');
  await denied(`update product_variants set price_inr = 1`, 'cannot change prices');
  await denied(`insert into categories (slug,name,kind) values ('x','X','all')`, 'cannot insert categories');
  await denied(`insert into product_images (product_id,url) values ('00000000-0000-0000-0000-000000000001','u')`, 'cannot insert images');
  await denied(`update inventory set availability='in_stock'`, 'cannot change inventory');

  const cats = (await R(`select slug from v_public_categories order by slug`)).map((r) => r.slug);
  check(`${role}: v_public_categories = landing pages + categories with published products`, JSON.stringify(cats) === JSON.stringify(['inspired-fragrances', 'mens-perfumes', 'personalized-perfumes', 'shop-all']), JSON.stringify(cats));
  const sf = await R(`select slug, from_price_inr::int p, sizes_ml s from v_storefront_products order by published_at desc`);
  check(`${role}: v_storefront_products latest-first, hides the scheduled one`, JSON.stringify(sf.map((r) => r.slug)) === JSON.stringify(['test-four', 'test-three', 'test-one', 'test-five']), JSON.stringify(sf.map((r) => r.slug)));
  check(`${role}: v_storefront_products shows only active sizes (test-one = 50 ml)`, JSON.stringify(sf.find((r) => r.slug === 'test-one').s) === '[50]');
  const sales = await R(`select sku, discount_pct from v_active_sales order by sku`);
  check(`${role}: v_active_sales = only the approved sale inside its window, 20% off`, sales.length === 1 && sales[0].sku === 'K3-50' && sales[0].discount_pct === 20, JSON.stringify(sales));
}

const svc = (sql) => asRole(db, 'service_role', () => rows(db, sql));
check('service_role can read drafts and import rows (bypasses RLS)', (await svc(`select count(*)::int n from products`))[0].n === 6 && (await svc(`select count(*)::int n from product_import_rows`))[0].n === 1);
await asRole(db, 'service_role', async () => { await db.exec(`update products set is_featured = true where product_key='p2'`); });
check('service_role can write the catalogue', (await rows(db, `select is_featured from products where product_key='p2'`))[0].is_featured === true);
check('updated_at trigger fires on update', (await rows(db, `select updated_at > created_at as ok from products where product_key='p2'`))[0].ok === true);

// ── rollback and re-apply ───────────────────────────────────────────
const db2 = await fresh();
await db2.exec(MIG[0]); await db2.exec(MIG[1]); await db2.exec(MIG[2]);
await db2.exec(DOWN);
const left = (await rows(db2, `select count(*)::int n from information_schema.tables where table_schema='public'`))[0].n;
const fnLeft = (await rows(db2, `select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'catalogue_%'`))[0].n;
check('rollback script removes every table, view and function it created', left === 0 && fnLeft === 0, `tables=${left} fns=${fnLeft}`);
await db2.exec(MIG[0]); await db2.exec(MIG[1]); await db2.exec(MIG[2]);
check('migrations apply again cleanly after a rollback', (await rows(db2, 'select count(*)::int n from categories'))[0].n === 7);

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
