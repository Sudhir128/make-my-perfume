import { useState } from 'react';
import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import { ChevronRight, ShoppingBag, Zap } from 'lucide-react';
import { TIERS, type Product as ProductT } from '../data/catalog';
import { productImage } from '../data/productImages';
import { getProduct, listProducts } from '../data/repository';
import { formatINR } from '../lib/format';
import { useBag } from '../store/bag';
import { useToast } from '../store/toast';
import { BottlePreview } from '../components/BottlePreview';
import { Button } from '../components/Button';
import { ImageryPending } from '../components/ImageryPending';
import { NoteGlyph } from '../components/NoteGlyph';
import { ProductCard } from '../components/ProductCard';
import { QuantityStepper } from '../components/QuantityStepper';
import NotFound from './NotFound';
import styles from './Product.module.css';

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await getProduct(params.slug ?? '');
  const related = product ? (await listProducts()).filter((p) => p.slug !== product.slug).slice(0, 3) : [];
  return { product, related };
}

const TIER_LABEL = { top: 'Top notes', heart: 'Heart notes', base: 'Base notes' } as const;
const ART_VIEWS = ['Artwork', 'Flask', 'Bottle'] as const;
type View = 'Photo' | (typeof ART_VIEWS)[number];

function Viewer({ product, view }: { product: ProductT; view: View }) {
  const photo = productImage(product.slug);
  if (view === 'Photo' && photo) {
    return (
      <img
        className={styles.photo}
        src={photo.src}
        srcSet={photo.srcSet}
        sizes="(min-width: 960px) 46vw, 92vw"
        width={960}
        height={960}
        alt={photo.alt}
        decoding="async"
      />
    );
  }
  if (view === 'Bottle') {
    return (
      <div className={styles.bottleView}>
        <BottlePreview house accent={product.collection} />
      </div>
    );
  }
  return (
    <ImageryPending
      subject={product.name}
      family={product.collection}
      shape={view === 'Flask' ? 'flask' : 'frame'}
      ratio={view === 'Flask' ? '100 / 130' : '1 / 1'}
      className={view === 'Flask' ? styles.flaskView : undefined}
    />
  );
}

export default function Product() {
  const { product, related } = useLoaderData() as { product: ProductT | null; related: ProductT[] };
  const photo = product ? productImage(product.slug) : null;
  const views: View[] = photo ? ['Photo', ...ART_VIEWS] : [...ART_VIEWS];
  const [view, setView] = useState<View>(photo ? 'Photo' : 'Artwork');
  const [qty, setQty] = useState(1);
  const addProduct = useBag((s) => s.addProduct);
  const show = useToast((s) => s.show);
  const navigate = useNavigate();

  if (!product) return <NotFound />;

  const add = () => {
    addProduct(product, qty);
    show(`${qty} × ${product.name} added to your bag.`, { label: 'View bag', to: '/bag' });
  };

  return (
    <div className={styles.page}>
      <nav className={`${styles.crumbs} page-width`} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
            <Link to="/collection">Collection</Link>
          </li>
          <li>
            <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
            <Link to={`/collection?family=${encodeURIComponent(product.collection)}`}>{product.collection}</Link>
          </li>
          <li aria-current="page">
            <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>{product.name}</span>
          </li>
        </ol>
      </nav>

      <div className={`${styles.layout} page-width`}>
        <section className={styles.gallery} aria-label={`${product.name} images`}>
          <div className={styles.stage}>
            <Viewer product={product} view={view} />
          </div>
          <div className={styles.thumbs} role="group" aria-label="Choose a view">
            {views.map((v) => (
              <button key={v} type="button" className={styles.thumb} aria-pressed={view === v} aria-label={`${v} view`} onClick={() => setView(v)}>
                <span className={styles.thumbArt} aria-hidden="true">
                  {v === 'Photo' && photo ? (
                    <img className={styles.thumbPhoto} src={photo.src} srcSet={photo.srcSet} sizes="80px" width={480} height={480} alt="" decoding="async" />
                  ) : v === 'Bottle' ? (
                    <BottlePreview house />
                  ) : (
                    <ImageryPending subject="" family={product.collection} shape={v === 'Flask' ? 'flask' : 'frame'} ratio="1 / 1" />
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.info} aria-labelledby="product-title">
          <p className={styles.family}>
            <NoteGlyph family={product.collection} size={18} />
            {product.collection} collection
          </p>
          <h1 id="product-title" className={styles.name}>
            {product.name}
          </h1>
          <p className={styles.tagline}>{product.tagline}</p>
          <p className={styles.description}>{product.description}</p>

          <div className={styles.priceBlock}>
            <p className={styles.price}>
              <span className="visually-hidden">Price </span>
              <span className="tabular">{formatINR(product.price)}</span>
            </p>
            <p className={styles.perSize}>for {product.sizeMl} ml</p>
          </div>

          <div className={styles.option}>
            <p className={styles.optionLabel} id="size-label">
              Size
            </p>
            <p className={styles.sizeChip} aria-labelledby="size-label">
              {product.sizeMl} ml
            </p>
          </div>

          <div className={styles.buy}>
            <QuantityStepper value={qty} onChange={(n) => setQty(Math.min(10, Math.max(1, n)))} label={product.name} />
            <Button className={styles.addButton} onClick={add}>
              <ShoppingBag size={17} strokeWidth={1.5} aria-hidden="true" />
              Add to bag
            </Button>
          </div>
          <Button
            variant="ghost"
            className={styles.buyNow}
            onClick={() => {
              addProduct(product, qty);
              navigate('/bag');
            }}
          >
            <Zap size={16} strokeWidth={1.5} aria-hidden="true" />
            Buy now
          </Button>

          <div className={styles.details}>
            <details open>
              <summary>The notes</summary>
              <dl className={styles.notes}>
                {TIERS.map((tier) => (
                  <div key={tier}>
                    <dt>{TIER_LABEL[tier]}</dt>
                    <dd>{product.notes[tier].join(' · ')}</dd>
                  </div>
                ))}
              </dl>
            </details>
            {(product.longevity || product.sillage) && (
              <details>
                <summary>Wear it well</summary>
                <dl className={styles.facts}>
                  {product.longevity && (
                    <div>
                      <dt>Longevity</dt>
                      <dd>{product.longevity}</dd>
                    </div>
                  )}
                  {product.sillage && (
                    <div>
                      <dt>Sillage</dt>
                      <dd>{product.sillage}</dd>
                    </div>
                  )}
                </dl>
              </details>
            )}
            <details>
              <summary>Ingredients &amp; details</summary>
              <dl className={styles.facts}>
                {product.ingredients && product.ingredients.length > 0 && (
                  <div className={styles.wide}>
                    <dt>Ingredients</dt>
                    <dd>{product.ingredients.join(' · ')}</dd>
                  </div>
                )}
                <div>
                  <dt>Collection</dt>
                  <dd>{product.collection}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{product.sizeMl} ml</dd>
                </div>
              </dl>
            </details>
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className={`${styles.related} page-width`} aria-labelledby="related-title">
          <p className="eyebrow eyebrow--lead">You may also like</p>
          <h2 id="related-title" className={styles.relatedTitle}>
            More to <em>discover.</em>
          </h2>
          <ul className={styles.relatedGrid}>
            {related.map((p) => (
              <li key={p.slug}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
