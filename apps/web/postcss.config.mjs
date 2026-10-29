// Tailwind CSS v4 runs only for the account, script and admin pages. Its entry
// (src/features/styles/site.css) decides what is generated; this file only
// registers the plugin with Next.js.
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
