/** Retain v3 sibling spacing/dividers and forced-color outlines after v4 compilation. */
export function legacyUtilityCompatibility() {
  return {
    postcssPlugin: 'sms-tailwind-compatibility',
    OnceExit(root) {
      root.walkRules((rule) => {
        if (/(?:space-[xy]-|divide-)/.test(rule.selector)) {
          rule.selector = rule.selector.replace(
            /:where\((.+)>:not\(:last-child\)\)/g,
            '$1>:not([hidden])~:not([hidden])',
          );
          const properties = {
            'margin-block-start': 'margin-bottom',
            'margin-block-end': 'margin-top',
            'margin-inline-start': 'margin-right',
            'margin-inline-end': 'margin-left',
            'border-top-width': 'border-bottom-width',
            'border-bottom-width': 'border-top-width',
            'border-inline-start-width': 'border-right-width',
            'border-inline-end-width': 'border-left-width',
          };
          rule.walkDecls((decl) => { decl.prop = properties[decl.prop] ?? decl.prop; });
        }
        if (rule.selector.includes('outline-none') || rule.nodes?.some((node) =>
          node.type === 'decl' && node.prop === 'outline' && /transparent|#0000/.test(node.value))) {
          rule.walkDecls((decl) => {
            if (decl.prop === 'outline-style' || decl.prop === '--tw-outline-style') decl.value = 'solid';
          });
          rule.append({ prop: 'outline-style', value: 'solid' });
        }
      });
    },
  };
}
