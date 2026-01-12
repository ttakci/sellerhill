import { EXAMPLE_STATUS } from '@repo/shared';
import { Button, Icon } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ExampleList.style';
import { type ExampleListProps } from './ExampleList.types';

export const ExampleList = (props: ExampleListProps): React.ReactElement => {
  const { t } = useTranslation();

  if (props.items.length === 0) {
    return (
      <S.Grid>
        <S.EmptyState>
          <Icon name="inbox" size={48} strokeWidth={1.5} />
          <S.EmptyTitle>{t('example.emptyStateTitle')}</S.EmptyTitle>
          <S.EmptyText>{t('example.emptyStateText')}</S.EmptyText>
        </S.EmptyState>
      </S.Grid>
    );
  }

  return (
    <S.Grid>
      {props.items.map((item) => {
        const isActive = item.status === EXAMPLE_STATUS.ACTIVE;
        const createdDate = new Date(item.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        return (
          <S.Card key={item.id}>
            <S.CardHeader>
              <S.CardTitle>{item.name}</S.CardTitle>
              <S.StatusBadge $isActive={isActive}>
                {isActive ? t('example.statusActive') : t('example.statusArchived')}
              </S.StatusBadge>
            </S.CardHeader>

            <S.CardBody>
              <S.InfoRow>
                <Icon name="calendar" size={20} strokeWidth={2} />
                <span>{createdDate}</span>
              </S.InfoRow>
            </S.CardBody>

            <S.CardFooter>
              <Button disabled={props.isArchived(item.status)} onClick={() => props.onArchive(item.id)}>
                {t('example.archiveButton')}
              </Button>
              <Button variant="danger" onClick={() => props.onDelete(item.id)}>
                {t('example.deleteButton')}
              </Button>
            </S.CardFooter>
          </S.Card>
        );
      })}
    </S.Grid>
  );
};
