import { useMemo, useRef, useState } from 'react';
import { NarrativeStage } from '../narrative/NarrativeStage';
import { Link, useLoaderData } from 'react-router';
import type { Product } from '../data/catalog';
import { listFamilies, listProducts } from '../data/repository';
import { useNarrativeTier } from '../narrative/useNarrativeTier';
import { Botanical } from '../components/Botanical';
import { BottlePreview } from '../components/BottlePreview';
import { ButtonAnchor, ButtonLink } from '../components/Button';
import { CollectionBottle } from '../components/CollectionBottle';
import { Drydown } from '../components/Drydown';
import { NoteGlyph } from '../components/NoteGlyph';
import { FamilyRing } from '../components/FamilyRing';
import { ImageryPending } from '../components/ImageryPending';
import { IngredientField } from '../components/IngredientField';
import { MistField } from '../components/MistField';
import { ProductCard } from '../components/ProductCard';
import { Reveal } from '../components/Reveal';
import { useMedia, useScrollProgress } from '../scroll/useScrollProgress';
import sunflowers800 from '../assets/editorial/sunflowers-800.webp';
import sunflowers1400 from '../assets/editorial/sunflowers-1400.webp';
import spray800 from '../assets/editorial/spray-still-life-800.webp';
import spray1400 from '../assets/editorial/spray-still-life-1400.webp';
import styles from './Home.module.css';

export async function loader() {
  const [products, families] = await Promise.all([listProducts(), listFamilies()]);
  return { products, families };
}

const NAME_MAX = 18;

/** Mood lines from the previous site's scent tiles (only these three had them). */
const FAMILY_MOOD: Record<string, string> = {
  Fresh: 'Energize. Vitalize. Awaken.',
  Floral: 'Fruity. Bloom. Candylicious.',
  Woody: 'Exotic. Sensual. Subtle.',
};

/**
 * "From Nature to Signature": one continuous vertical sequence
 * (Ingredients → Composition and families → Bottle and collection → Ritual →
 * Signature), then the Drydown, then Make yours. Every stage carries real
 * content in normal flow. Full tier: one sticky Three.js stage behind the
 * stages follows them as they scroll past. Still tier: each
 * `[data-scene-slot]` holds the static composition instead.
 */
export default function Home() {
  const { products, families } = useLoaderData() as { products: Product[]; families: string[] };
  const [name, setName] = useState('');
  const { tier, fail } = useNarrativeTier();
  const sequence = useRef<HTMLDivElement>(null);

  const hero = useRef<HTMLElement>(null);
  const desktop = useMedia('(min-width: 900px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  useScrollProgress(hero, { mode: 'exit', enabled: desktop && !reduced });

  const familyItems = useMemo(
    () => families.map((family) => ({ family, scent: products.find((p) => p.collection === family)?.name ?? '' })),
    [families, products],
  );

  // Stage 3: the bottle takes the light of the card at the centre of the screen.
  const cards = useRef<HTMLUListElement>(null);

  return (
    <div className={styles.narrative} data-tier={tier}>
      <div ref={sequence} className={styles.sequence}>
      {tier === 'full' && <NarrativeStage sequence={sequence} onFailure={fail} />}
      {/* ── 1. Ingredients ───────────────────────────────────────────── */}
      <section ref={hero} className={styles.hero} aria-labelledby="hero-title" data-stage="ingredients">
        <div className={`${styles.heroInner} page-width`}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Make My Perfume</p>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span className={styles.heroCaps}>Your scent.</span> <em>Your signature.</em>
            </h1>
            <p className={styles.heroLede}>
              Fragrance composed in layers: a bright first thought, a textured middle, and a base that stays close.
            </p>
            <div className={styles.heroActions}>
              {/* Shopping is never behind the story: this jumps straight to stage 3. */}
              <ButtonAnchor href="#collection">Shop the collection</ButtonAnchor>
              <ButtonAnchor href="#make" variant="quiet" arrow>
                Make yours
              </ButtonAnchor>
            </div>
          </div>
          <div className={styles.heroArt} data-scene-slot="vessel">
            <IngredientField />
            <div className={styles.flaskLayer}>
              <div className={styles.flask}>
                <ImageryPending subject="Make My Perfume house fragrance" family="Warm" shape="flask" ratio="100 / 130" fill="load" />
              </div>
            </div>
            <div className={styles.sprigLayer} aria-hidden="true">
              <Botanical className={styles.sprig} />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Composition and the six families ──────────────────────── */}
      <section className={`${styles.composition} page-width`} aria-labelledby="story-title" data-stage="composition">
        <Reveal className={styles.compositionHead}>
          <figure className={styles.editorial}>
            <img
              src={sunflowers800}
              srcSet={`${sunflowers800} 800w, ${sunflowers1400} 1400w`}
              sizes="(min-width: 960px) 28rem, 90vw"
              width={800}
              height={533}
              alt="Sunflowers in full bloom, filling the frame"
              loading="lazy"
              decoding="async"
            />
                      </figure>
          <p className="eyebrow">Our point of view</p>
          <h2 id="story-title" className={styles.h2Center}>
            Made for the <em>in-between.</em>
          </h2>
          <p className={styles.lede}>
            Make My Perfume is an independent fragrance studio for people who find meaning in the small rituals.
          </p>
        </Reveal>
        <FamilyRing items={familyItems} />
      </section>

      {/* ── 3. Bottle and the collection ─────────────────────────────── */}
      <section id="collection" className={styles.collection} aria-labelledby="collection-title" data-stage="bottle" tabIndex={-1}>
        <div className={`${styles.collectionInner} page-width`}>
          <div className={styles.collectionContent}>
            <Reveal as="header" className={styles.collectionHead}>
              <p className="eyebrow eyebrow--lead">The collection</p>
              <h2 id="collection-title" className={styles.h2}>
                Six scents, <em>as they stand.</em>
              </h2>
            </Reveal>
            <ul ref={cards} className={styles.cards}>
              {products.map((p) => (
                <li key={p.slug} data-active-key={p.slug}>
                  <ProductCard product={p} compact />
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.bottleColumn} data-scene-slot="bottle">
            <div className={styles.bottleSticky}>
              <CollectionBottle cards={cards} products={products} />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Ritual: the implied gesture ───────────────────────────── */}
      <section className={styles.ritual} aria-labelledby="ritual-title" data-stage="ritual">
        <div className={`${styles.ritualInner} page-width`}>
          <div className={styles.ritualArt} data-scene-slot="spray">
            <div className={styles.ritualBottle}>
              <MistField className={styles.mist} />
              <BottlePreview house capOff />
            </div>
          </div>
          <Reveal className={styles.ritualCopy}>
            <h2 id="ritual-title" className={styles.ritualLine}>
              Built to leave <em>a mark.</em>
            </h2>
            <figure className={`${styles.editorial} ${styles.editorialTall}`}>
              <img
                src={spray800}
                srcSet={`${spray800} 800w, ${spray1400} 1400w`}
                sizes="(min-width: 960px) 20rem, 70vw"
                width={800}
                height={1200}
                alt="Unbranded glass bottles misting in warm light on an ochre ground"
                loading="lazy"
                decoding="async"
              />
                          </figure>
          </Reveal>
        </div>
      </section>

      {/* ── 5. Signature: the bookend, where the mist becomes words ──── */}
      <section className={styles.signatureStage} aria-labelledby="signature-title" data-stage="signature">
        <div className="page-width">
          <h2 id="signature-title" className={styles.signatureTitle} data-scene-slot="type">
            <span className={styles.heroCaps}>Your scent.</span> <em>Your signature.</em>
          </h2>
        </div>
      </section>
      </div>

      {/* ── The Drydown (existing signature section) ─────────────────── */}
      <Drydown products={products} />

      {/* ── Explore scents: every family, one tile each ──────────────── */}
      <section className={`${styles.explore} page-width`} aria-labelledby="explore-title">
        <Reveal as="header" className={styles.sectionHead}>
          <p className="eyebrow eyebrow--lead">Explore scents</p>
          <h2 id="explore-title" className={styles.h2}>
            Begin with <em>a mood.</em>
          </h2>
        </Reveal>
        <ul className={styles.tiles}>
          {familyItems.map(({ family, scent }) => (
            <li key={family}>
              <Link to={`/collection?family=${encodeURIComponent(family)}`} className={styles.tile}>
                <span className={styles.tileArt} aria-hidden="true">
                  {family === 'Floral' ? (
                    <img src={sunflowers800} srcSet={`${sunflowers800} 800w, ${sunflowers1400} 1400w`} sizes="(min-width: 960px) 26rem, 90vw" width={800} height={533} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <ImageryPending subject="" family={family} shape="frame" ratio="3 / 2" />
                  )}
                </span>
                <span className={styles.tileText}>
                  <span className={styles.tileFamily}>
                    <NoteGlyph family={family} size={18} />
                    {family}
                  </span>
                  <span className={styles.tileMood}>{FAMILY_MOOD[family] ?? scent}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Best sellers ─────────────────────────────────────────────── */}
      <section className={`${styles.bestSellers} page-width`} aria-labelledby="best-title">
        <Reveal as="header" className={styles.sectionHeadRow}>
          <div>
            <p className="eyebrow eyebrow--lead">Our best sellers</p>
            <h2 id="best-title" className={styles.h2}>
              Loved <em>first.</em>
            </h2>
          </div>
          <ButtonLink to="/collection" variant="quiet" arrow>
            View all
          </ButtonLink>
        </Reveal>
        <ul className={styles.bestGrid}>
          {products.slice(0, 4).map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Make yours ───────────────────────────────────────────────── */}
      <section id="make" className={styles.signature} aria-labelledby="make-title" tabIndex={-1}>
        <div className={`${styles.makeInner} page-width`}>
          <div className={styles.makeArt}>
            <BottlePreview name={name} />
          </div>
          <Reveal className={styles.makeCopy}>
            <p className="eyebrow eyebrow--lead">Make yours</p>
            <h2 id="make-title" className={styles.h3}>
              Make it <em>yours.</em>
            </h2>
            <p className={styles.makeLine}>A gift that lasts a lifetime.</p>
            <p className={styles.body}>
              Choose notes for each layer and the name on the label.
            </p>
            <div className={styles.field}>
              <label htmlFor="label-name">Name on the label</label>
              <input
                id="label-name"
                type="text"
                maxLength={NAME_MAX}
                autoComplete="off"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-describedby="label-name-hint"
              />
              <span id="label-name-hint" className={styles.hint}>
                Up to {NAME_MAX} characters. Shown on the label preview.
              </span>
            </div>
            <div className={styles.makeActions}>
              <ButtonLink to={name.trim() ? `/make?name=${encodeURIComponent(name.trim())}` : '/make'}>
                Start your blend
              </ButtonLink>
              <ButtonAnchor href="#collection" variant="ghost">
                Shop the collection
              </ButtonAnchor>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
