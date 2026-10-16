import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './styles/fonts';
import './styles/tokens.css';
import './styles/base.css';
import './styles/materials.css';
import './styles/motion.css';
import { initMotion } from './scroll/reveal';
import { router } from './app/router';

// Before the first render, so pre-reveal styles never flash on capable
// browsers and never apply at all on incapable ones.
initMotion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
