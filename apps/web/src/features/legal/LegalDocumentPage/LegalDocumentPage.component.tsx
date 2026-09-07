import { LegalBlockType, type LegalBlock } from '@repo/shared';
import { Dropdown, Icon, Logo, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './LegalDocumentPage.style';
import type { LegalDocumentPageProps } from './LegalDocumentPage.types';

/**
 * Renders one legal document from structured blocks.
 *
 * The switch below is total over `LegalBlockType`; anything else was already
 * dropped by `parseLegalDocument`, so there is no guessing default here.
 *
 * `Text` renders a <span> and takes no element-override prop, and the design
 * system forbids raw typography elements, so the document's heading levels are
 * declared with role/aria-level on the wrappers instead. Without that, a
 * twenty-nine-section legal document would expose no heading structure at all
 * to a screen reader — and this is exactly the kind of document people navigate
 * by heading rather than by reading top to bottom.
 */
export const LegalDocumentPageComponent = ({
  document,
  currentLocale,
  currentYear,
  onLocaleChange,
  onNavigateHome,
}: LegalDocumentPageProps) => {
  const { t } = useTranslation(['legal', 'translation']);

  const renderBlock = (block: LegalBlock, key: string) => {
    switch (block.type) {
      case LegalBlockType.PARAGRAPH:
        return (
          <Text key={key} variant="body" color="text.secondary">
            {block.text}
          </Text>
        );

      case LegalBlockType.SUBHEADING:
        return (
          <S.SubHeading key={key} role="heading" aria-level={3}>
            <Text variant="h4" weight="semibold">
              {block.text}
            </Text>
          </S.SubHeading>
        );

      case LegalBlockType.UNORDERED_LIST:
        return (
          <S.List key={key}>
            {block.items.map((item, index) => (
              <S.ListItem key={`${key}-${String(index)}`}>
                <Text variant="body" color="text.secondary">
                  {item}
                </Text>
              </S.ListItem>
            ))}
          </S.List>
        );

      case LegalBlockType.ORDERED_LIST:
        return (
          <S.OrderedList key={key}>
            {block.items.map((item, index) => (
              <S.ListItem key={`${key}-${String(index)}`}>
                <Text variant="body" color="text.secondary">
                  {item}
                </Text>
              </S.ListItem>
            ))}
          </S.OrderedList>
        );

      case LegalBlockType.DEFINITION_LIST:
        return (
          <S.DefinitionList key={key}>
            {block.items.map((item, index) => (
              <S.DefinitionItem key={`${key}-${String(index)}`}>
                <Text variant="body" weight="semibold">
                  {item.term}
                </Text>
                <Text variant="body" color="text.secondary">
                  {item.text}
                </Text>
              </S.DefinitionItem>
            ))}
          </S.DefinitionList>
        );

      case LegalBlockType.ADDRESS:
        return (
          <S.AddressBlock key={key}>
            {block.lines.map((line, index) => (
              <Text key={`${key}-${String(index)}`} variant="body" weight="medium">
                {line}
              </Text>
            ))}
          </S.AddressBlock>
        );

      case LegalBlockType.EMAIL:
        return (
          <S.EmailLink key={key} href={`mailto:${block.address}`}>
            <Icon name="mail" size={16} color="brand.primary" />
            <Text variant="body" weight="medium" color="brand.primary">
              {block.address}
            </Text>
          </S.EmailLink>
        );
    }
  };

  return (
    <S.Page>
      <S.Header>
        <S.BrandButton type="button" onClick={onNavigateHome} aria-label="SellerHill">
          <Logo layout="full" height={32} />
        </S.BrandButton>

        <S.HeaderActions>
          <S.BackLink type="button" onClick={onNavigateHome}>
            <Icon name="arrow-left" size={14} />
            <Text variant="body-sm" weight="medium" color="sidebar.textMuted">
              {t('legal.backToHome')}
            </Text>
          </S.BackLink>

          <Dropdown
            align="right"
            width="8rem"
            trigger={
              <S.LanguageTrigger>
                <Text variant="body-sm" weight="medium" color="sidebar.text">
                  {t(`translation:languages.${currentLocale}`)}
                </Text>
                <Icon name="chevron-down" size={12} />
              </S.LanguageTrigger>
            }
            items={[
              { label: t('translation:languages.en'), onClick: () => onLocaleChange('en') },
              { label: t('translation:languages.tr'), onClick: () => onLocaleChange('tr') },
            ]}
          />
        </S.HeaderActions>
      </S.Header>

      {document ? (
        <S.Layout>
          <S.Article>
            <S.DocumentHeader>
              <S.DocumentTitle role="heading" aria-level={1}>
                <Text variant="h1" weight="semibold">
                  {document.documentTitle}
                </Text>
              </S.DocumentTitle>
              {document.lastUpdated ? (
                <Text variant="body-sm" color="text.tertiary">
                  {document.lastUpdated}
                </Text>
              ) : null}
            </S.DocumentHeader>

            <S.Intro>
              {document.intro.map((paragraph, index) => (
                <Text key={`intro-${String(index)}`} variant="body" color="text.secondary">
                  {paragraph}
                </Text>
              ))}
            </S.Intro>

            {document.sections.map((section) => (
              <S.Section key={section.id}>
                <S.SectionHeading id={section.id} role="heading" aria-level={2}>
                  <Text variant="h3" weight="semibold">
                    {section.heading}
                  </Text>
                </S.SectionHeading>
                <S.Blocks>
                  {section.blocks.map((block, index) =>
                    renderBlock(block, `${section.id}-${String(index)}`)
                  )}
                </S.Blocks>
              </S.Section>
            ))}
          </S.Article>

          <S.Toc aria-label={t('legal.tocTitle')}>
            <Text variant="caption" weight="semibold" color="text.tertiary">
              {t('legal.tocTitle')}
            </Text>
            <S.TocList>
              {document.sections.map((section) => (
                <li key={section.id}>
                  <S.TocLink href={`#${section.id}`}>
                    <Text variant="body-sm">{section.heading}</Text>
                  </S.TocLink>
                </li>
              ))}
            </S.TocList>
          </S.Toc>
        </S.Layout>
      ) : (
        <S.Layout>
          <S.EmptyState>
            <Text variant="body" color="text.secondary">
              {t('legal.unavailable')}
            </Text>
          </S.EmptyState>
        </S.Layout>
      )}

      <S.Footer>
        <Text variant="caption" color="text.tertiary">
          {t('translation:landing.footer.copyright', { year: currentYear })}
        </Text>
      </S.Footer>
    </S.Page>
  );
};
