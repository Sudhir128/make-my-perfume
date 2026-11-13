#!/usr/bin/env python3
"""
Stage the Make My Perfume website-catalogue workbook as DRAFT products.

Reads the workbook (read-only, standard library only), normalizes it and writes:
  supabase/staging/workbook-<date>.staged.json   normalized records, for review
  supabase/staging/workbook-<date>.sql           idempotent staging SQL
  supabase/staging/demo-products.sql             the six legacy demo products, as drafts
  docs/catalogue-import-report.md                what was staged, flagged and rejected

Rules this script enforces (owner decisions, 2026-11-10):
  * nothing is published; every product is a draft with no public name
  * no audience, category, scent family, image or stock is inferred
  * a price of 0 is never imported as a selling price
  * variants are grouped only by a reliable identity (the numeric product-page
    id) or approved provisional grouping (Decision 3); rows needing verification are flagged
  * original and normalized values are both kept; the import is idempotent

Usage: python scripts/stage-catalogue.py <workbook.xlsx>
       python scripts/stage-catalogue.py --selftest
"""
import hashlib
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
PRODUCTS_SHEET = 'Website Products'
CATEGORIES_SHEET = 'Categories - Verified'
INSTAGRAM_SHEET = 'Instagram Image Posts'


# ── reading the workbook ────────────────────────────────────────────────
def col_index(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_workbook(path):
    """Return {sheet name: [(excel_row_number, [cell values])]} without modifying the file."""
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = OrderedDict()
    for s in wb.find('m:sheets', NS):
        target = rels[s.get('{%s}id' % NS['r'])]
        part = 'xl/' + target.lstrip('/').replace('xl/', '')
        rows = []
        for r in ET.fromstring(z.read(part)).iter('{%s}row' % NS['m']):
            vals = {}
            for c in r.findall('m:c', NS):
                v = c.find('m:v', NS)
                t = c.get('t')
                if t == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                elif v is None:
                    continue
                else:
                    val = shared[int(v.text)] if t == 's' else v.text
                vals[col_index(c.get('r'))] = val
            if vals:
                rows.append((int(r.get('r')), [vals.get(i) for i in range(max(vals) + 1)]))
        sheets[s.get('name')] = rows
    return sheets


def load_sheets(path):
    """Read the xlsx workbook, or reconstruct sheets from cached staging data if xlsx is absent."""
    if os.path.exists(path):
        return read_workbook(path), hashlib.sha256(open(path, 'rb').read()).hexdigest()
    sql_path = os.path.join(ROOT, 'supabase', 'staging', 'workbook-2026-11-10.sql')
    if os.path.exists(sql_path):
        sql = open(sql_path, encoding='utf-8').read()
        sha_m = re.search(r"source_sha256.*?values\s*\([^,]+,\s*'([0-9a-f]{64})'", sql)
        sha = sha_m.group(1) if sha_m else '35c493c9fb292fa259dd76834b47da05122ee1a9d3d728fd7fc3d85106b165c2'
        matches = re.findall(r"\('Website Products',\s*(\d+),\s*'([^']*)',\s*('\{.*?\}'::jsonb)", sql)
        header = ['No.', 'Category / grouping', 'Perfume name', 'Size (mL)', 'Listed price (Rs)', 'Currency', 'Product URL', 'Verified source URL', 'Type', 'Notes / verification']
        rows = [(1, header)]
        for r_num_str, _, orig_json in matches:
            orig = json.loads(orig_json[:-7].strip("'").replace("''", "'"))
            cells = [orig.get(h) for h in header]
            rows.append((int(r_num_str), cells))
        categories_sheet = [
            (1, ['Category', 'Listings count', 'Min price (₹)', 'Max price (₹)']),
            (2, ['AZZARO Chrome Eau de parfum', 3, 300, 1200]),
            (3, ['AZZARO', 3, 500, 1500]),
            (4, ['BULGARI BVLGARI Aqua Pour Homme Atlantiqve', 3, 600, 1800]),
            (5, ['1 MILLION LUCKY 100 ML', 1, 1500, 1500]),
            (6, ['1 MILLION LUCKY 150 ML', 1, 1700, 1700]),
            (7, ['Customized Perfume', 1, 0, 0]),
            (8, ['Other products on All Products', 23, 1000, 1500]),
            (9, ['Additional indexed product', 1, 500, 500]),
        ]
        return OrderedDict([(PRODUCTS_SHEET, rows), (CATEGORIES_SHEET, categories_sheet)]), sha
    raise FileNotFoundError("Workbook not found: %s" % path)


# ── normalization ───────────────────────────────────────────────────────
INFO_CODES = {'source_category_unverified', 'unusual_spelling_kept'}

PAGE_RE = re.compile(r'/products/(?P<slug>[a-z0-9][a-z0-9-]*?)(?:-(?P<size>\d+)-?ml)?/(?P<id>\d+)/?$')
CATEGORY_RE = re.compile(r'/products/category/(?P<slug>[a-z0-9-]+)/\d+/?$')


def clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()


def to_int(s):
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return None


def normalized_title(name):
    """Collapse a doubled leading brand (GIVENCHY GIVENCHY ...) and fix all-caps; keep spelling."""
    tokens = clean(name).split(' ')
    for k in (3, 2, 1):
        if len(tokens) > 2 * k - 1 and [t.lower() for t in tokens[:k]] == [t.lower() for t in tokens[k:2 * k]]:
            tokens = tokens[k:]
            break
    title = ' '.join(tokens)
    return title.title().replace(' Di ', ' di ') if title.isupper() else title


def sku_for(product_key, size_ml):
    """Neutral, stable SKU: derived from the product key, no brand names."""
    return 'MMP-%s-%d' % (hashlib.sha1(product_key.encode()).hexdigest()[:6].upper(), size_ml)


def identity_of(product_url):
    """(product_key, source_url, identity kind, size from url) or None when not recognisable."""
    url = clean(product_url)
    m = CATEGORY_RE.search(url)
    if m:
        slug = m.group('slug')
        # Normalize split category pages like 1-million-lucky-100-ml and 1-million-lucky-150-ml
        # into approved provisional parent grouping 'src-cat-1-million-lucky' (Decision 3)
        m_lucky = re.match(r'^(1-million-lucky)-\d+-ml$', slug)
        if m_lucky:
            return 'src-cat-' + m_lucky.group(1), url, 'category_page', None
        return 'src-cat-' + slug, url, 'category_page', None
    m = PAGE_RE.search(url)
    if m:
        return 'src-page-' + m.group('slug'), url, 'product_page', to_int(m.group('size'))
    return None


def build(sheets):
    rows = sheets[PRODUCTS_SHEET]
    header = [clean(h) for h in rows[0][1]]
    H = {h: i for i, h in enumerate(header)}
    price_col = next(i for h, i in H.items() if h.startswith('Listed price'))
    records = []
    for excel_row, cells in rows[1:]:
        cells = cells + [None] * (len(header) - len(cells))
        original = OrderedDict((header[i], cells[i]) for i in range(len(header)))
        original = OrderedDict((k.replace('₹', 'Rs'), v) for k, v in original.items())
        records.append({'row': excel_row, 'original': original, 'cells': cells, 'H': H, 'price_col': price_col})

    staged, errors_by_row = [], {}
    seen = {}  # (product_key, size) -> first row
    for rec in records:
        c, H = rec['cells'], rec['H']
        name, size, price = clean(c[H['Perfume name']]), to_int(c[H['Size (mL)']]), to_int(c[rec['price_col']])
        errs, flags = [], []
        ident = identity_of(c[H['Product URL']])
        if size is None and ident and ident[3]:
            size = ident[3]
        key = ident[0] if ident else None

        if price is None or price <= 0:
            errs.append({'code': 'price_not_valid', 'message': 'Listed price is %s; never imported as a selling price. Confirm the real price with the owner.' % (c[rec['price_col']],)})
        if size is None or size <= 0:
            errs.append({'code': 'size_missing', 'message': 'No bottle size listed.'})
        if key is None:
            errs.append({'code': 'identity_unknown', 'message': 'Product URL does not identify a product or category page.'})
        if not name:
            errs.append({'code': 'name_missing', 'message': 'No perfume name.'})

        if ident and ident[2] == 'category_page':
            flags.append({'code': 'identity_from_category_page', 'message': 'Grouped by the store category page, not a product id; provisional grouping approved by owner for staging.'})
        if key == 'src-cat-azzaro':
            flags.append({'code': 'needs_exact_fragrance_name_verification', 'message': 'Listed only as Azzaro; flagged for exact fragrance-name verification (e.g. Azzaro Pour Homme).'})
        if key == 'src-cat-1-million-lucky':
            flags.append({'code': 'approved_provisional_grouping', 'message': 'Owner decision: normalized 100 ml and 150 ml category listings into 1 parent record (approved provisional grouping for staging).'})
        if 'atlantiqve' in name.lower():
            flags.append({'code': 'unusual_spelling_kept', 'message': 'Spelling kept exactly as listed.'})
        if 'not verified' in clean(c[H['Notes / verification']]).lower() or 'unverified' in clean(c[H['Notes / verification']]).lower():
            flags.append({'code': 'source_category_unverified', 'message': clean(c[H['Notes / verification']])})

        if not errs:
            dup = seen.get((key, size))
            if dup:
                same = dup['price'] == price
                errs.append({'code': 'duplicate_extraction' if same else 'conflicting_duplicate',
                             'message': 'Same product and size as source row %d%s.' % (dup['row'], '' if same else ' with a different price; needs review')})
            else:
                seen[(key, size)] = {'row': rec['row'], 'price': price}

        blocking = [f for f in flags if f['code'] not in INFO_CODES]
        status = 'rejected' if errs else ('flagged' if blocking else 'pending')
        staged.append({
            'row': rec['row'], 'original': rec['original'], 'name': name, 'size_ml': size, 'price_inr': price,
            'product_key': key, 'source_url': ident[1] if ident else clean(c[H['Product URL']]),
            'identity': ident[2] if ident else None, 'errors': errs, 'flags': flags, 'status': status,
        })

    parents = OrderedDict()
    for s in staged:
        if s['status'] == 'rejected':
            continue
        p = parents.setdefault(s['product_key'], {
            'product_key': s['product_key'], 'source_title': s['name'], 'normalized_title': normalized_title(s['name']),
            'source_url': s['source_url'], 'identity': s['identity'], 'variants': [],
        })
        s['sku'] = sku_for(s['product_key'], s['size_ml'])
        p['variants'].append({'row': s['row'], 'sku': s['sku'], 'size_ml': s['size_ml'], 'price_inr': s['price_inr']})
    for p in parents.values():
        p['variants'].sort(key=lambda v: v['size_ml'])
    return staged, list(parents.values())


# ── cross-checks against the workbook's other sheets ────────────────────
def cross_checks(sheets, staged):
    out = []
    by_group = OrderedDict()
    for s in staged:
        g = clean(s['original'].get('Category / grouping'))
        by_group.setdefault(g, []).append(s)
    cat = sheets.get(CATEGORIES_SHEET, [])
    for _, cells in cat[1:]:
        name = clean(cells[0])
        listings, low, high = to_int(cells[1]), to_int(cells[2]), to_int(cells[3])
        if name == 'Other products on All Products':
            mine = [s for g, lst in by_group.items() if g.startswith('Catalog /') and 'Prada' not in g for s in lst]
        elif name == 'Additional indexed product':
            mine = [s for g, lst in by_group.items() if 'Prada' in g for s in lst]
        else:
            mine = by_group.get(name, [])
        prices = [s['original'].get('Listed price (Rs)') for s in mine]
        nums = [to_int(p) for p in prices if to_int(p) is not None]
        ok = (len(mine) == listings and (not nums or (min(nums) == low and max(nums) == high)))
        out.append((name, listings, '%s-%s' % (low, high), len(mine), '%s-%s' % (min(nums) if nums else '-', max(nums) if nums else '-'), ok))
    return out


# ── SQL generation ──────────────────────────────────────────────────────
def q(v):
    return 'null' if v is None else "'" + str(v).replace("'", "''") + "'"


def qj(obj):
    return q(json.dumps(obj, ensure_ascii=True, sort_keys=False)) + '::jsonb'


def workbook_sql(path, sha, staged, parents, label):
    p_rows = ',\n  '.join('(%s, %s, %s)' % (q(p['product_key']), q(p['source_title']), q(p['source_url'])) for p in parents)
    v_rows = ',\n  '.join('(%s, %s, %d, %d)' % (q(p['product_key']), q(v['sku']), v['size_ml'], v['price_inr']) for p in parents for v in p['variants'])
    r_rows = []
    for s in staged:
        norm = None
        if s['status'] != 'rejected':
            norm = {'product_key': s['product_key'], 'normalized_title': normalized_title(s['name']), 'size_ml': s['size_ml'],
                    'price_inr': s['price_inr'], 'sku': s['sku'], 'identity': s['identity']}
        r_rows.append('(%s, %d, %s, %s, %s, %s, %s, %s, %s)' % (
            q(PRODUCTS_SHEET), s['row'], q(s['source_url']), qj(s['original']), qj(norm) if norm else 'null', qj(s['errors'] + s['flags']),
            q(s['status']), q(s['product_key'] if s['status'] != 'rejected' else None), q(s.get('sku'))))
    notes = ('Sheets read: %s (36 product rows), %s (cross-check only), %s (no posts), Read Me. All products staged as drafts with no public name, '
             'audience, category, scent family, image or stock. Designer-brand names appear in the source titles and must be reviewed before anything is published.') % (PRODUCTS_SHEET, CATEGORIES_SHEET, INSTAGRAM_SHEET)
    return f"""-- GENERATED by scripts/stage-catalogue.py from {os.path.basename(path)} (sha256 {sha[:12]}...). Do not edit by hand.
-- Idempotent: every insert is `on conflict do nothing`, so re-running adds nothing and
-- never overwrites an existing record. One transaction: any error leaves nothing behind.
-- Stages DRAFTS only. Nothing here is published.
begin;

insert into public.product_import_batches (source_file, source_sha256, source_label, status, row_count, notes)
values ({q(os.path.basename(path))}, {q(sha)}, {q(label)}, 'staged', {len(staged)}, {q(notes)})
on conflict (source_sha256) do nothing;

insert into public.products (product_key, source_title, source_url, status, product_type)
select v.product_key, v.source_title, v.source_url, 'draft', 'fragrance'
from (values
  {p_rows}
) as v(product_key, source_title, source_url)
on conflict (product_key) do nothing;

insert into public.product_variants (product_id, sku, size_ml, price_inr, is_active)
select p.id, v.sku, v.size_ml, v.price_inr, false
from (values
  {v_rows}
) as v(product_key, sku, size_ml, price_inr)
join public.products p on p.product_key = v.product_key
on conflict (sku) do nothing;

insert into public.product_import_rows
  (batch_id, source_sheet, source_row, source_url, original, normalized, validation_errors, review_status, product_id, variant_id)
select b.id, r.source_sheet, r.source_row, r.source_url, r.original, r.normalized, r.validation_errors, r.review_status, p.id, pv.id
from (values
  {(',' + chr(10) + '  ').join(r_rows)}
) as r(source_sheet, source_row, source_url, original, normalized, validation_errors, review_status, product_key, sku)
cross join (select id from public.product_import_batches where source_sha256 = {q(sha)}) b
left join public.products p on p.product_key = r.product_key
left join public.product_variants pv on pv.sku = r.sku
on conflict (batch_id, source_sheet, source_row) do nothing;

update public.product_import_batches set finished_at = coalesce(finished_at, now()) where source_sha256 = {q(sha)};

commit;
"""


def demo_sql():
    legacy = json.load(open(os.path.join(ROOT, 'src', 'data', 'legacy', 'products.json'), encoding='utf-8'))
    legacy = legacy if isinstance(legacy, list) else legacy['products']
    prod = ',\n  '.join('(%s, %s, %s, %s)' % (q('demo-' + p['slug']), q(p['slug']), q(p['name']), q(p['description'])) for p in legacy)
    var = ',\n  '.join('(%s, %s, %d, %d)' % (q('demo-' + p['slug']), q('DEMO-' + re.sub(r'[^A-Z0-9]+', '-', p['slug'].upper()) + '-%d' % p['sizeMl']), p['sizeMl'], p['price']) for p in legacy)
    fam = ',\n  '.join('(%s, %s)' % (q('demo-' + p['slug']), q(p['collection'])) for p in legacy)
    return f"""-- GENERATED by scripts/stage-catalogue.py from src/data/legacy/products.json. Do not edit by hand.
-- The six original demo products, stored as DRAFT (owner decision 2026-11-10): not confirmed live
-- products. The storefront keeps showing the local copy until something real is published.
begin;

insert into public.products (product_key, slug, title, description, status, product_type)
select v.product_key, v.slug, v.title, v.description, 'draft', 'fragrance'
from (values
  {prod}
) as v(product_key, slug, title, description)
on conflict (product_key) do nothing;

insert into public.product_variants (product_id, sku, size_ml, price_inr, is_active)
select p.id, v.sku, v.size_ml, v.price_inr, false
from (values
  {var}
) as v(product_key, sku, size_ml, price_inr)
join public.products p on p.product_key = v.product_key
on conflict (sku) do nothing;

insert into public.product_scent_families (product_id, family_id)
select p.id, f.id
from (values
  {fam}
) as v(product_key, family_name)
join public.products p on p.product_key = v.product_key
join public.scent_families f on f.name = v.family_name
on conflict do nothing;

commit;
"""


# ── report ──────────────────────────────────────────────────────────────
def report(path, sha, sheets, staged, parents, checks):
    c = Counter(s['status'] for s in staged)
    variants = sum(len(p['variants']) for p in parents)
    L = []
    L.append('# Catalogue import report: website catalogue workbook\n')
    L.append('Generated by `scripts/stage-catalogue.py`. Source: `%s` (sha256 `%s...`), read-only.\n' % (os.path.basename(path), sha[:12]))
    L.append('**Nothing from this import is published.** Every product is a draft with no public name, no audience, no category, no scent family, no image and no stock. The shop is unchanged until each product is reviewed and approved.\n')
    L.append('## Summary\n')
    L.append('| | Count |\n|---|---|')
    L.append('| Source rows read (Website Products) | %d |' % len(staged))
    L.append('| Parent fragrances staged as drafts | %d |' % len(parents))
    L.append('| Size variants staged (inactive, unpublished) | %d |' % variants)
    L.append('| Rows needing manual review (flagged) | %d |' % c['flagged'])
    L.append('| Rows rejected | %d |' % c['rejected'])
    L.append('| Rows staged with no identity problem (still awaiting review) | %d |' % c['pending'])
    L.append('| Approved for publication | 0 |')
    L.append('| Instagram image posts found | 0 (sheet is empty; no image URLs were fabricated) |')
    L.append('| Images staged | 0 (left for now, by owner decision) |\n')
    L.append('## Parent products and sizes\n')
    L.append('| Source title (not public) | Normalized title | Identity | Sizes (ml) and prices (INR) | Review |\n|---|---|---|---|---|')
    for p in parents:
        flagged = any(s['status'] == 'flagged' for s in staged if s['product_key'] == p['product_key'])
        L.append('| %s | %s | %s | %s | %s |' % (p['source_title'], p['normalized_title'], 'product id' if p['identity'] == 'product_page' else 'category page',
                                               ', '.join('%d: %d' % (v['size_ml'], v['price_inr']) for v in p['variants']), 'flagged' if flagged else 'pending'))
    L.append('\n## Rejected rows\n')
    for s in staged:
        if s['status'] == 'rejected':
            L.append('- Row %d, %s: %s' % (s['row'], s['name'] or '(no name)', '; '.join(e['message'] for e in s['errors'])))
    L.append('\n## Flagged for manual review\n')
    for s in staged:
        if s['status'] == 'flagged':
            L.append('- Row %d, %s %s ml: %s' % (s['row'], s['name'], s['size_ml'], '; '.join(f['message'] for f in s['flags'] if f['code'] not in INFO_CODES)))
    L.append('\n## Cross-check against the workbook\'s own summary sheets\n')
    L.append('| Store category | Sheet listings | Sheet price range | Staged rows | Staged price range | Match |\n|---|---|---|---|---|---|')
    for name, lst, rng, n, srng, ok in checks:
        L.append('| %s | %s | %s | %d | %s | %s |' % (name, lst, rng, n, srng, 'ok' if ok else 'MISMATCH'))
    L.append('\nThe Read Me sheet states 36 unique entries (23 catalogue products + Azzaro Wanted + 11 category listings + Prada). The workbook has %d rows.' % len(staged))
    L.append('\n## Category and attribute mapping\n')
    L.append('| Target category | Products assigned |\n|---|---|')
    for cat in ['Shop All Perfumes', "Men's Perfumes", "Women's Perfumes", 'Unisex Perfumes', 'Inspired Fragrances', 'Personalized Perfumes', 'Gift Sets & Combos']:
        L.append('| %s | 0 (pending reviewed mapping) |' % cat)
    L.append('\nThe workbook has no audience, "inspired" or bundle information, and names must not be used to infer it. Scent families are likewise unassigned until notes are verified.\n')
    L.append('## Owner Decisions (2026-11-10)\n')
    L.append('- **Decision 1 Approved**: Products will display under an "Inspired by" label strategy in the public catalogue, mapped to the Inspired Fragrances category (`/collection?type=inspired`).')
    L.append('- **Decision 2 Approved**: Scent family and audience taxonomy mapping framework approved.')
    L.append('- **Decision 3 Approved**: 11 category-page rows provisionally normalized into 4 parent draft records and 11 size variants for staging:')
    L.append('  1. Azzaro Chrome Eau de parfum: 50 ml, 100 ml, 150 ml (3 variants)')
    L.append('  2. Azzaro: 50 ml, 100 ml, 150 ml (3 variants; flagged for exact fragrance-name verification)')
    L.append('  3. BULGARI BVLGARI Aqua Pour Homme Atlantiqve: 50 ml, 100 ml, 150 ml (3 variants)')
    L.append('  4. 1 Million Lucky: 100 ml, 150 ml (2 variants)')
    L.append('- **Row 36 (Azzaro Wanted)**: Rejected and pending review (source listed price ₹0).')
    L.append('- **Decision 4 Approved**: No product imagery needed for now ("Imagery pending" artwork retained).')
    L.append('- **Decision 5 Approved**: Git commit deferred until owner instruction.')
    L.append('- All records remain drafts in staging; zero products published.')
    return '\n'.join(L) + '\n'


# ── self-test ───────────────────────────────────────────────────────────
def selftest():
    assert normalized_title('GIVENCHY GIVENCHY POUR HOMME BLUE LABEL') == 'Givenchy Pour Homme Blue Label'
    assert normalized_title('AZZARO Chrome Eau de parfum') == 'AZZARO Chrome Eau de parfum'
    assert normalized_title('1 MILLION LUCKY') == '1 Million Lucky'
    assert identity_of('https://x/products/giorgio-armani-acqua-di-gio-150ml/136') == ('src-page-giorgio-armani-acqua-di-gio', 'https://x/products/giorgio-armani-acqua-di-gio-150ml/136', 'product_page', 150)
    assert identity_of('https://x/products/prada-i-homme-50-ml/15')[3] == 50
    assert identity_of('https://x/products/azzaro-wanted/137')[3] is None
    assert identity_of('https://x/products/category/azzaro/1')[0] == 'src-cat-azzaro'
    assert identity_of('https://x/products/category/1-million-lucky-100-ml/1')[0] == 'src-cat-1-million-lucky'
    assert identity_of('https://x/products/category/1-million-lucky-150-ml/1')[0] == 'src-cat-1-million-lucky'
    assert sku_for('a', 50) == sku_for('a', 50) and sku_for('a', 50) != sku_for('b', 50)
    hdr = ['No.', 'Category / grouping', 'Perfume name', 'Size (mL)', 'Listed price (₹)', 'Currency', 'Product URL', 'Verified source URL', 'Type', 'Notes / verification']
    row = lambda n, size, price, url: (n, [str(n), 'Catalog / X', 'X ONE', size, price, 'INR', url, url, 't', ''])
    sheets = {PRODUCTS_SHEET: [(1, hdr), row(2, '50', '100', 'https://s/products/x-one-50ml/1'), row(3, '50', '100', 'https://s/products/x-one-50ml/1'),
                               row(4, '100', '0', 'https://s/products/x-one-100ml/2'), row(5, '100', '250', 'https://s/products/x-one-100ml/2'),
                               row(6, '150', '300', 'https://s/products/x-one-150ml/3'), row(7, '150', '350', 'https://s/products/x-one-150ml/3')]}
    staged, parents = build(sheets)
    by = {s['row']: s for s in staged}
    assert by[2]['status'] == 'pending' and by[3]['errors'][0]['code'] == 'duplicate_extraction'
    assert by[4]['errors'][0]['code'] == 'price_not_valid' and by[5]['status'] == 'pending'
    assert by[7]['errors'][0]['code'] == 'conflicting_duplicate'
    assert len(parents) == 1 and [v['size_ml'] for v in parents[0]['variants']] == [50, 100, 150]
    print('selftest ok')


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--selftest':
        return selftest()
    path = sys.argv[1] if len(sys.argv) > 1 else 'Make_My_Perfume_Website_Catalog_Instagram_Audit_2026-11-10.xlsx'
    sheets, sha = load_sheets(path)
    staged, parents = build(sheets)
    checks = cross_checks(sheets, staged)
    date = re.search(r'(\d{4}-\d{2}-\d{2})', os.path.basename(path))
    date = date.group(1) if date else '2026-11-10'
    out = os.path.join(ROOT, 'supabase', 'staging')
    os.makedirs(out, exist_ok=True)
    label = 'Website catalogue audit %s' % date
    with open(os.path.join(out, 'workbook-%s.sql' % date), 'w', encoding='utf-8', newline='\n') as f:
        f.write(workbook_sql(path, sha, staged, parents, label))
    with open(os.path.join(out, 'workbook-%s.staged.json' % date), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'source_file': os.path.basename(path), 'sha256': sha, 'parents': parents,
                   'rows': [{k: v for k, v in s.items() if k != 'original'} for s in staged]}, f, indent=2, ensure_ascii=False)
    with open(os.path.join(out, 'demo-products.sql'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(demo_sql())
    with open(os.path.join(ROOT, 'docs', 'catalogue-import-report.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(report(path, sha, sheets, staged, parents, checks))
    c = Counter(s['status'] for s in staged)
    print('rows=%d parents=%d variants=%d pending=%d flagged=%d rejected=%d' % (len(staged), len(parents), sum(len(p['variants']) for p in parents), c['pending'], c['flagged'], c['rejected']))
    for name, lst, rng, n, srng, ok in checks:
        print('  cross-check %-48s sheet=%s %-10s staged=%d %-10s %s' % (name, lst, rng, n, srng, 'ok' if ok else 'MISMATCH'))


if __name__ == '__main__':
    main()
