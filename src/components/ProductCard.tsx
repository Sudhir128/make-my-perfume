import { useRef } from 'react';
import { Link } from 'react-router';
import type { Product } from '../data/catalog';
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
  headingLevel?: 'h2' | 'h3';
  /** Horizontal layout: artwork thumbnail beside the text (narrative stage 3). */
  compact?: boolean;
}

/** Curated card: shouldered material frame, name, italic price, tagline, add to bag. */
export function ProductCard({ product, headingLevel: Heading = 'h3', compact = false }: ProductCardProps) {
  const addProduct = useBag((s) => s.addProduct);
  const show = useToast((s) => s.show);
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  const href = `/product/${product.slug}`;
  const photo = productImage(product.slug);

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
          <ImageryPending subject={product.name} family={product.collection} shape="shoulder" ratio="1 / 1" fill="reveal" />
        )}
      </Link>
      <div className={styles.body}>
        <p className={styles.family}>
          <NoteGlyph family={product.collection} size={16} />
          {product.collection}
        </p>
        <div className={styles.titleRow}>
          <Heading id={`card-${product.slug}`} className={styles.name}>
            <Link to={href}>{product.name}</Link>
          </Heading>
          <Price amount={product.price} sizeMl={product.sizeMl} kind="provisional" hideTag />
        </div>
        <p className={styles.tagline}>{product.tagline}</p>
        <p className={styles.notes}>
          <span className="visually-hidden">Top notes: </span>
          {product.notes.top.join(' · ')}
        </p>
        <Button
          variant="ghost"
          small
          className={styles.add}
          onClick={() => {
            addProduct(product);
            show(`${product.name} added to your bag.`, { label: 'View bag', to: '/bag' });
          }}
        >
          Add to bag<span className="visually-hidden">, {product.name}</span>
        </Button>
      </div>
    </article>
  );
}
