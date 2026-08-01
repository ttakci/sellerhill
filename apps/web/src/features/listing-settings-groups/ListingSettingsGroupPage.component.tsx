import type { ListingSettingsGroupResponse } from '@repo/shared';
import { Button, Icon, PageHeader, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './ListingSettingsGroupPage.style';
import { ListingSettingsGroupPageProps } from './ListingSettingsGroupPage.types';

export const ListingSettingsGroupPageComponent = ({
  groups,
  isLoading,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: ListingSettingsGroupPageProps) => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);

  return (
    <S.Container>
      <PageHeader
        title={t('listingSettingsGroup.title')}
        subtitle={<Text color="text.secondary">{t('listingSettingsGroup.subtitle')}</Text>}
        actions={
          groups.length > 0 ? (
            <Button variant="primary" size="medium" onClick={onCreateGroup}>
              <Text variant="body" weight="semibold">{t('listingSettingsGroup.createNewGroup')}</Text>
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <S.EmptyStateWrapper>
          <S.EmptyState
            icon="layers"
            title={t('translation:common.loading')}
            description={t('listingSettingsGroup.loadingDescription')}
          />
        </S.EmptyStateWrapper>
      ) : groups.length > 0 ? (
        <S.CardGrid>
          {groups.map((group: ListingSettingsGroupResponse) => (
            <S.InteractiveCard key={group.id} variant="interactive" onClick={() => onEditGroup(group.id)}>
              <S.CardBodyContent>
                <S.CardTitleGroup>
                  <S.CardTitleText variant="h4" weight="semibold" className="card-title">
                    {group.name}
                  </S.CardTitleText>
                  {group.description && (
                    <Text variant="caption" color="text.secondary" truncate>
                      {group.description}
                    </Text>
                  )}
                </S.CardTitleGroup>
              </S.CardBodyContent>

              <S.CardFooter>
                <S.Stats>
                  <S.StatItem>
                    <Icon name="inventory" size={18} color="text.tertiary" />
                    <Text variant="caption" color="text.tertiary">{t('listingSettingsGroup.productsCount', { count: 0 })}</Text>
                  </S.StatItem>
                </S.Stats>

                <S.CardActions onClick={(e) => e.stopPropagation()}>
                  <S.IconButton
                    variant="ghost"
                    $type="edit"
                    onClick={() => onEditGroup(group.id)}
                    title={t('listingSettingsGroup.tooltips.editGroup')}
                  >
                    <Icon name="edit-note" size={20} />
                  </S.IconButton>
                  <S.IconButton
                    variant="ghost"
                    $type="delete"
                    onClick={() => onDeleteGroup(group.id)}
                    title={t('listingSettingsGroup.tooltips.deleteGroup')}
                  >
                    <Icon name="delete" size={20} />
                  </S.IconButton>
                </S.CardActions>
              </S.CardFooter>
            </S.InteractiveCard>
          ))}
        </S.CardGrid>
      ) : (
        <S.EmptyStateWrapper>
          <S.EmptyState
            icon="layers"
            title={t('listingSettingsGroup.emptyState.title')}
            description={t('listingSettingsGroup.emptyState.description')}
          />
          <Button variant="primary" size="medium" onClick={onCreateGroup}>
            <Text variant="body" weight="semibold">{t('listingSettingsGroup.createNewGroup')}</Text>
          </Button>
        </S.EmptyStateWrapper>
      )}
    </S.Container>
  );
};
