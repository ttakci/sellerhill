import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

interface RootProps {
  $codeScroll: boolean;
}

/**
 * SafeMarkdown root — applies typography defaults for rendered markdown.
 * All visual treatments use theme tokens; no hardcoded colors/spacing.
 */
export const Root = styled.div<RootProps>`
  color: ${tkn('colors.text.primary')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.base')};
  line-height: ${tkn('typography.lineHeight.normal')};

  & > *:first-child {
    margin-top: 0;
  }

  & > *:last-child {
    margin-bottom: 0;
  }

  p {
    margin: 0 0 ${tkn('spacing.sm')};
  }

  strong {
    font-weight: ${tkn('typography.fontWeight.semibold')};
  }

  em {
    font-style: italic;
  }

  code {
    font-family: ${tkn('typography.fontFamily.mono')};
    font-size: ${tkn('typography.fontSize.sm')};
    background-color: ${tkn('colors.background.tertiary')};
    color: ${tkn('colors.text.primary')};
    padding: ${tkn('spacing.2xs')} ${tkn('spacing.xs')};
    border-radius: ${tkn('radius.sm')};
  }

  pre {
    margin: 0 0 ${tkn('spacing.sm')};
    padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
    background-color: ${tkn('colors.background.tertiary')};
    border-radius: ${tkn('radius.md')};
    overflow-x: ${({ $codeScroll }) => ($codeScroll ? 'auto' : 'visible')};

    & code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      font-size: ${tkn('typography.fontSize.sm')};
      color: ${tkn('colors.text.primary')};
      white-space: ${({ $codeScroll }) => ($codeScroll ? 'pre' : 'pre-wrap')};
      word-break: ${({ $codeScroll }) => ($codeScroll ? 'normal' : 'break-word')};
    }
  }

  ul,
  ol {
    margin: 0 0 ${tkn('spacing.sm')};
    padding-left: ${tkn('spacing.lg')};
  }

  li {
    margin: ${tkn('spacing.2xs')} 0;
  }

  ul li {
    list-style-type: disc;
  }

  ol li {
    list-style-type: decimal;
  }

  sup {
    font-size: ${tkn('typography.fontSize.xs')};
    color: ${tkn('colors.text.secondary')};
    font-weight: ${tkn('typography.fontWeight.medium')};
    padding: 0 ${tkn('spacing.2xs')};
  }
`;
