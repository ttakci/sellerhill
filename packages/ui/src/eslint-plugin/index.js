/**
 * Custom ESLint Plugin: Design System Enforcer
 * 
 * Prevents hardcoded values in styled components to enforce design system tokens.
 */

module.exports = {
  rules: {
    'no-hardcoded-colors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow hardcoded color values (hex, rgb, rgba) in styled components',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          hardcodedHex: 'Hardcoded hex color "{{value}}" detected. Use theme tokens via tkn() instead.',
          hardcodedRgb: 'Hardcoded rgb/rgba color "{{value}}" detected. Use theme tokens via tkn() instead.',
        },
        schema: [],
      },
      create(context) {
        return {
          TemplateElement(node) {
            const value = node.value.raw;
            
            // Check for hex colors (#fff, #ffffff, #AABBCC)
            const hexPattern = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
            const hexMatches = value.match(hexPattern);
            if (hexMatches) {
              hexMatches.forEach(match => {
                context.report({
                  node,
                  messageId: 'hardcodedHex',
                  data: { value: match },
                });
              });
            }

            // Check for rgb/rgba colors
            const rgbPattern = /rgba?\s*\([^)]+\)/g;
            const rgbMatches = value.match(rgbPattern);
            if (rgbMatches) {
              rgbMatches.forEach(match => {
                context.report({
                  node,
                  messageId: 'hardcodedRgb',
                  data: { value: match },
                });
              });
            }
          },
        };
      },
    },
    'no-hardcoded-spacing': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow hardcoded spacing values (px, rem) in styled components',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          hardcodedSpacing: 'Hardcoded spacing "{{value}}" detected. Use tkn(\'spacing.*\') instead.',
        },
        schema: [],
      },
      create(context) {
        return {
          TemplateElement(node) {
            const value = node.value.raw;
            
            // Check for hardcoded px/rem values in spacing CSS properties
            // Scope: padding/margin/gap ONLY (genuine spacing).
            // width/height/top/bottom/left/right are layout dimensions, not spacing tokens.
            // Exclude: font-size, line-height (covered by typography), border-width (1px is acceptable)
            const spacingPattern = /(?:padding|margin|gap):\s*(?:\$\{[^}]*\}\s+)?(\d+(?:\.\d+)?(?:px|rem))/g;
            let match;

            while ((match = spacingPattern.exec(value)) !== null) {
              const spacingValue = match[1];
              // Allow 1px (and equivalent 0.0625rem) for borders
              if (spacingValue !== '1px' && spacingValue !== '0.0625rem') {
                context.report({
                  node,
                  messageId: 'hardcodedSpacing',
                  data: { value: spacingValue },
                });
              }
            }
          },
        };
      },
    },
    'no-inline-styles': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow inline style attributes in JSX',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          inlineStyle: 'Inline style attribute detected. Use styled components instead.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name.name === 'style' && node.value && node.value.type === 'JSXExpressionContainer') {
              context.report({
                node,
                messageId: 'inlineStyle',
              });
            }
          },
        };
      },
    },
    'no-styled-typography': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow styled.h1/h2/etc. Use <Text> component instead.',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          noStyledTypography: 'Usage of styled.{{tag}} is forbidden. Use the <Text> component from @repo/ui with variants instead.',
        },
        schema: [],
      },
      create(context) {
        return {
          TaggedTemplateExpression(node) {
            if (
              node.tag.type === 'MemberExpression' &&
              node.tag.object.name === 'styled' &&
              ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(node.tag.property.name)
            ) {
              context.report({
                node,
                messageId: 'noStyledTypography',
                data: { tag: node.tag.property.name },
              });
            }
          },
        };
      },
    },
    'no-bare-text-in-button': {
      // ... existing no-bare-text-in-button rule ...
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow bare text or expression containers directly inside Button. Use <Text> component.',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          bareTextInButton: 'Bare text or expression detected inside Button. Wrap text in <Text> component.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXElement(node) {
            if (node.openingElement.name.name === 'Button') {
              node.children.forEach(child => {
                if (
                  (child.type === 'JSXText' && child.value.trim().length > 0) ||
                  (child.type === 'JSXExpressionContainer' && child.expression.type !== 'JSXEmptyExpression')
                ) {
                  if (child.type === 'JSXText' && child.value.trim().length > 0) {
                     context.report({
                      node: child,
                      messageId: 'bareTextInButton',
                    });
                  }
                  if (child.type === 'JSXExpressionContainer') {
                     if (
                        child.expression.type === 'CallExpression' || 
                        child.expression.type === 'Literal' ||
                        child.expression.type === 'TemplateLiteral'
                     ) {
                       context.report({
                        node: child,
                        messageId: 'bareTextInButton',
                      });
                     }
                  }
                }
              });
            }
          },
        };
      },
    },
    'no-implicit-i18n-namespaces': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce explicit namespace prefixing in i18n keys',
          category: 'Localization',
          recommended: true,
        },
        messages: {
          implicitNamespace: 'Implicit i18n namespace detected in key "{{key}}". Always use explicit prefix like "namespace:key.path".',
        },
        schema: [],
      },
      create(context) {
        const checkKey = (node, value) => {
          if (typeof value === 'string' && !value.includes(':')) {
             // Exception: Don't flag empty strings or strings that look like templates
             if (value.length > 0 && !value.includes('{{')) {
                context.report({
                  node,
                  messageId: 'implicitNamespace',
                  data: { key: value },
                });
             }
          }
        };

        return {
          CallExpression(node) {
            if (node.callee.name === 't' && node.arguments[0] && node.arguments[0].type === 'Literal') {
              checkKey(node.arguments[0], node.arguments[0].value);
            }
          },
          JSXAttribute(node) {
            const i18nAttributes = ['headerKey', 'descriptionKey', 'labelKey', 'placeholderKey'];
            if (i18nAttributes.includes(node.name.name) && node.value && node.value.type === 'Literal') {
              checkKey(node.value, node.value.value);
            }
          },
          Property(node) {
            const i18nProperties = ['headerKey', 'descriptionKey', 'labelKey', 'placeholderKey'];
            if (
                node.key.type === 'Identifier' && 
                i18nProperties.includes(node.key.name) && 
                node.value.type === 'Literal'
            ) {
              checkKey(node.value, node.value.value);
            }
          }
        };
      },
    },
    'no-native-select': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow native <select> elements. Use the <ModernSelect> molecule from @repo/ui instead.',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          nativeSelect: 'Native <select> element detected. Use <ModernSelect> from @repo/ui instead. All form controls must be atoms or molecules from the design system.',
        },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename();
        // Allow native select inside the design system package itself
        if (filename.includes('packages/ui')) {
          return {};
        }

        return {
          JSXElement(node) {
            if (
              node.openingElement.name &&
              node.openingElement.name.type === 'JSXIdentifier' &&
              node.openingElement.name.name === 'select'
            ) {
              context.report({
                node,
                messageId: 'nativeSelect',
              });
            }
          },
        };
      },
    },
  },
};
