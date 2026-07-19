/**
 * Router basename derived from the build-time base path.
 *
 * The app is served from '/' in dev and from '/ramolo/' on GitHub Pages.
 * React Router needs the prefix *without* the trailing slash, and `undefined`
 * rather than an empty string at the root. Kept in its own module so the app
 * entry point and the render tests cannot drift apart — a basename applied in
 * one but not the other renders a blank page in production while every test
 * passes at the root.
 */
export const routerBasename: string | undefined =
  import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;
