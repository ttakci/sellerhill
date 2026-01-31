import type { ListingSettingsGroupResponse } from '@repo/shared';
import { Icon, ModernButton, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';
import * as S from './ListingSettingsGroupPage.style';
import { ListingSettingsGroupPageProps } from './ListingSettingsGroupPage.types';

export const ListingSettingsGroupPageComponent = ({
  groups,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: ListingSettingsGroupPageProps) => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.PageTitle>{t('listingSettingsGroup.title')}</S.PageTitle>
          <Text color="text.secondary">{t('listingSettingsGroup.subtitle')}</Text>
        </S.HeaderContent>
        <S.Actions>
          <ModernButton variant="primary" size="medium" onClick={onCreateGroup} iconLeft="plus">
            {t('listingSettingsGroup.createNewGroup')}
          </ModernButton>
        </S.Actions>
      </S.Header>

      <S.CardGrid>
        {groups.map((group: ListingSettingsGroupResponse) => (
          <S.InteractiveCard key={group.id} variant="bordered" onClick={() => onEditGroup(group.id)}>
            <S.CardHeader>
              <S.CardIconWrapper>
                <Icon name="view-list" size={24} />
              </S.CardIconWrapper>
              <S.ActiveBadge variant="success" size="sm">
                {t('listingSettingsGroup.statusActive').toUpperCase()}
              </S.ActiveBadge>
            </S.CardHeader>

            <S.CardBodyContent>
              <S.CardTitleGroup>
                <S.CardTitleText variant="h4" weight="bold" className="card-title">
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
                  <Icon name="grid-view" size={18} color="text.tertiary" />
                  <span style={{ fontSize: '0.75rem' }}>{t('listingSettingsGroup.productsCount', { count: 0 })}</span>
                </S.StatItem>
              </S.Stats>

              <S.CardActions onClick={(e) => e.stopPropagation()}>
                <S.IconButton
                  $type="edit"
                  onClick={() => onEditGroup(group.id)}
                  title={t('listingSettingsGroup.tooltips.editGroup')}
                >
                  <Icon name="edit-note" size={20} />
                </S.IconButton>
                <S.IconButton
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

        <S.DashedCard onClick={onCreateGroup}>
          <S.DashedCardIconWrapper className="dashed-icon-wrapper">
            <Icon name="plus" size={28} />
          </S.DashedCardIconWrapper>
          <Text weight="semibold" variant="caption" color="text.secondary">
            {t('listingSettingsGroup.createNewGroup')}
          </Text>
        </S.DashedCard>
      </S.CardGrid>

      <S.Copyright>{t('listingSettingsGroup.copyright', { year: new Date().getFullYear() })}</S.Copyright>
    </S.Container>
  );
};
