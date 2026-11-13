import { useRef } from 'react';
import { Link } from 'react-router';
import type { Product, Variant } from '../data/catalog';
import { trackSiteActivity } from '../data/activity';
import { productImage } from '../data/productImages';
import { useReveal } from '../scroll/reveal';
import { useBag } from '../store/bag';
import { useToast } from '../store/toast';
import { Button } from './Button';
import { ImageryPending } from './ImageryPending';
import { NoteGlyph } from './NoteGlyph';
import { Price } from './Price';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  variant?: Variant;
  headingLevel?: 'h2' | 'h3';
  /** Horizontal layout: artwork thumbnail beside the text (narrative stage 3). */
  compact?: boolean;
}

/** Curated card: shouldered material frame, name, italic price, tagline, add to bag. */
export function ProductCard({ product, variant, headingLevel: Heading = 'h3', compact = false }: ProductCardProps) {
  const addProduct = useBag((s) => s.addProduct);
  const show = useToast((s) => s.show);
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  const href = `/product/${product.slug}`;
  const photo = productImage(product.slug);
  const shownPrice = variant?.price ?? product.price;
  const shownSize = variant?.sizeMl ?? product.sizeMl;
  const shownCompareAt = variant?.sale?.compareAt ?? product.variants?.find((v) => v.sizeMl === shownSize)?.sale?.compareAt;
  const outOfStock = product.availability === 'out_of_stock';
  const notesLine = product.notes.top.length ? product.notes.top.join(' · ') : product.fragranceType ?? product.audience ?? '';

  return (
    <article ref={ref} className={[styles.card, compact ? styles.compact : ''].join(' ')} aria-labelledby={`card-${product.slug}`} data-reveal="card">
      {/* The image repeats the name link for pointer users; keyboard users get one stop. */}
      <Link to={href} className={styles.media} tabIndex={-1} aria-hidden="true">
        {photo ? (
          <img
            className={`${styles.photo} shoulder-mask`}
            src={photo.src}
            srcSet={photo.srcSet}
            sizes={compact ? '104px' : '(min-width: 1000px) 24rem, (min-width: 600px) 45vw, 90vw'}
            width={480}
            height={480}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <ImageryPending subject={product.name} family={product.collection || 'Warm'} shape="shoulder" ratio="1 / 1" fill="reveal" />
        )}
      </Link>
      <div className={styles.body}>
        <p className={styles.family}>
          <NoteGlyph family={product.collection || 'Warm'} size={16} />
          {product.collection || product.fragranceType || 'Signature'}
        </p>
        <div className={styles.titleRow}>
          <Heading id={`card-${product.slug}`} className={styles.name}>
            <Link to={href}>{product.name}</Link>
          </Heading>
          <Price amount={shownPrice} sizeMl={shownSize} compareAt={shownCompareAt} kind="provisional" hideTag />
        </div>
        {product.tagline && <p className={styles.tagline}>{product.tagline}</p>}
        {notesLine && (
          <p className={styles.notes}>
            <span className="visually-hidden">Notes: </span>
            {notesLine}
          </p>
        )}
        <Button
          variant="ghost"
          small
          disabled={outOfStock}
          className={styles.add}
          onClick={() => {
            addProduct({ ...product, price: shownPrice, sizeMl: shownSize, sku: variant?.sku ?? product.sku });
            trackSiteActivity('bag.item_added', 'product', product.slug, `Added ${product.name} (${shownSize} ml) to bag`);
            show(`${product.name} added to your bag.`, { label: 'View bag', to: '/bag' });
          }}
        >
          {outOfStock ? 'Out of stock' : 'Add to bag'}
          <span className="visually-hidden">, {product.name}</span>
        </Button>
      </div>
    </article>
  );
}
