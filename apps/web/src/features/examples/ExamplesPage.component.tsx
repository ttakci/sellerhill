import React from 'react';
import { useTranslation } from 'react-i18next';

import { ExampleForm } from './ExampleForm';
import { ExampleList } from './ExampleList';
import * as S from './ExamplesPage.style';
import { type ExamplesPageProps } from './ExamplesPage.types';

export const ExamplesPage = (props: ExamplesPageProps): React.ReactElement => {
  const { t } = useTranslation();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderContent>
          <S.Title>{t('example.dashboardTitle')}</S.Title>
          <S.Subtitle>{t('example.dashboardSubtitle')}</S.Subtitle>
        </S.HeaderContent>
      </S.Header>

      <S.Container>
        <S.Section>
          <S.SectionTitle>{t('example.createSectionTitle')}</S.SectionTitle>
          <S.Card>
            <ExampleForm onSubmit={props.onCreateExample} />
          </S.Card>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('example.allExamplesTitle')}</S.SectionTitle>
          <ExampleList
            items={props.items}
            onArchive={props.onArchive}
            onDelete={props.onDelete}
            isArchived={props.isArchived}
          />
        </S.Section>
      </S.Container>
    </S.Page>
  );
};
