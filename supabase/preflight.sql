-- READ-ONLY. Run in the Supabase SQL editor BEFORE applying the catalogue
-- migrations, and send the result back. It changes nothing.

-- 1. Every table and view already in the public schema, with RLS state and
--    an approximate row count (-1 = never analysed).
select c.relname as name,
       case c.relkind when 'r' then 'table' when 'p' then 'partitioned table' when 'v' then 'view' end as kind,
       c.relrowsecurity as rls_enabled,
       c.reltuples::bigint as approx_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
order by c.relname;

-- 2. Catalogue table names that would block migration 1 (should return no rows).
select table_name as already_exists
from information_schema.tables
where table_schema = 'public'
  and table_name in ('categories', 'scent_families', 'products', 'product_variants',
                     'product_categories', 'product_scent_families', 'product_images',
                     'inventory', 'product_import_batches', 'product_import_rows');

-- 3. Existing RLS policies in public, so nothing is exposed unexpectedly.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
