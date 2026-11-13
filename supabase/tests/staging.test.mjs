// Staging SQL tests (PGlite, same setup as catalogue.test.mjs). Run: node staging.test.mjs <repo>
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const root = process.argv[2];
const migs = fs.readdirSync(`${root}/supabase/migrations`).sort().map((f) => fs.readFileSync(`${root}/supabase/migrations/${f}`, 'utf8'));
const staging = fs.readdirSync(`${root}/supabase/staging`).filter((f) => /^workbook-.*\.sql$/.test(f)).map((f) => fs.readFileSync(`${root}/supabase/staging/${f}`, 'utf8'))[0];
const demo = fs.readFileSync(`${root}/supabase/staging/demo-products.sql`, 'utf8');
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '   <-- ' + d}`); };
const one = async (db, sql) => Object.values((await db.query(sql)).rows[0])[0];
async function fresh() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`);
  for (const m of migs) await db.exec(m);
  return db;
}
const counts = (db) => db.query(`select (select count(*) from products)::int p, (select count(*) from product_variants)::int v, (select count(*) from product_import_rows)::int r, (select count(*) from product_import_batches)::int b`).then((x) => x.rows[0]);

const db = await fresh();
await db.exec(staging);
let c = await counts(db);
check('workbook staging: 13 parents, 35 variants, 36 import rows, 1 batch', c.p === 13 && c.v === 35 && c.r === 36 && c.b === 1, JSON.stringify(c));
check('review statuses: 24 pending, 11 flagged, 1 rejected', JSON.stringify((await db.query(`select review_status s, count(*)::int n from product_import_rows group by 1 order by 1`)).rows.map((r) => `${r.s}:${r.n}`)) === JSON.stringify(['flagged:11', 'pending:24', 'rejected:1']));
check('nothing is published or approved', (await one(db, `select count(*)::int from products where status <> 'draft' or approved_at is not null or published_at is not null`)) === 0);
check('no public name or slug on any imported product', (await one(db, `select count(*)::int from products where title is not null or slug is not null`)) === 0);
check('every imported variant is inactive', (await one(db, `select count(*)::int from product_variants where is_active`)) === 0);
check('no category, scent family, image or stock assigned', (await one(db, `select (select count(*) from product_categories)+(select count(*) from product_scent_families)+(select count(*) from product_images)+(select count(*) from inventory)::int`)) === 0);
check('the Rs 0 row is rejected with no product or variant, original kept', JSON.stringify((await db.query(`select review_status, product_id is null pn, variant_id is null vn, original->>'Listed price (Rs)' orig from product_import_rows where source_row = 36`)).rows[0]) === JSON.stringify({ review_status: 'rejected', pn: true, vn: true, orig: '0' }));
check('no variant has a price of 0 or less', (await one(db, `select count(*)::int from product_variants where price_inr <= 0`)) === 0);
check('original and normalized values both kept on accepted rows', (await one(db, `select count(*)::int from product_import_rows where review_status <> 'rejected' and original is not null and normalized is not null`)) === 35);
check('SKUs are neutral (no brand names)', (await one(db, `select count(*)::int from product_variants where sku !~ '^MMP-[0-9A-F]{6}-[0-9]+$'`)) === 0);
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  const pr = await one(db, `select count(*)::int from products`), vr = await one(db, `select count(*)::int from product_variants`), sf = await one(db, `select count(*)::int from v_storefront_products`), sl = await one(db, `select count(*)::int from v_active_sales`);
  let denied = false; try { await db.exec(`select * from product_import_rows`); } catch { denied = true; }
  await db.exec('reset role');
  check(`${role} sees none of it (products ${pr}, variants ${vr}, storefront ${sf}, sales ${sl}, import rows denied)`, pr === 0 && vr === 0 && sf === 0 && sl === 0 && denied);
}
await db.exec(staging);
check('re-running the staging SQL adds nothing (idempotent)', JSON.stringify(await counts(db)) === JSON.stringify(c));

// the six demo products
await db.exec(demo);
check('demo products: 6 drafts, 6 variants, 6 family links', (await one(db, `select count(*)::int from products where product_key like 'demo-%' and status = 'draft'`)) === 6 && (await one(db, `select count(*)::int from product_variants where sku like 'DEMO-%'`)) === 6 && (await one(db, `select count(*)::int from product_scent_families`)) === 6);
const before = await counts(db);
await db.exec(demo);
check('re-running the demo SQL adds nothing', JSON.stringify(await counts(db)) === JSON.stringify(before));
await db.exec(`set role anon`);
check('demo drafts are invisible to the public', (await one(db, `select count(*)::int from products`)) === 0);
await db.exec('reset role');

// atomicity: an error part-way leaves nothing behind
const db2 = await fresh();
const broken = staging.replace(/commit;\s*$/, 'select 1/0;\ncommit;');
let threw = false;
try { await db2.exec(broken); } catch { threw = true; try { await db2.exec('rollback'); } catch {} }
const left = await counts(db2);
check('a failing import leaves no partial data', threw && left.p === 0 && left.v === 0 && left.r === 0 && left.b === 0, JSON.stringify(left));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
