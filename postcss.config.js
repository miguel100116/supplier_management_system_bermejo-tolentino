import tailwindcss from '@tailwindcss/postcss';
import { legacyUtilityCompatibility } from './scripts/tailwindCompatibility.mjs';

export default {
  plugins: [tailwindcss({ optimize: true }), legacyUtilityCompatibility()],
};
