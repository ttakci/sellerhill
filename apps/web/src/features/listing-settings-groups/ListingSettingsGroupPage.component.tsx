import type { ListingSettingsGroupResponse } from '@repo/shared';
import { Badge, Button, CardBody, CardHeader, Icon, Text } from '@repo/ui';
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
          <S.HeaderTitleWrapper>
            <Icon name="check-list" size={28} color="brand.primary" />
            <S.PageTitle variant="h3" weight="bold">
              {t('listingSettingsGroup:listingSettingsGroup.title')}
            </S.PageTitle>
          </S.HeaderTitleWrapper>
          <Text variant="body" color="text.secondary">
            {t('listingSettingsGroup:listingSettingsGroup.subtitle')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="primary" size="md" onClick={onCreateGroup}>
            <Icon name="plus" size={18} />
            <Text variant="body" weight="medium" color="inherit">
              {t('listingSettingsGroup:listingSettingsGroup.createNewGroup')}
            </Text>
          </Button>
        </S.Actions>
      </S.Header>

      {groups.length === 0 ? (
        <S.EmptyState>
          <Icon name="box" size={64} color="text.tertiary" />
          <S.EmptyStateContent>
            <Text variant="h4" weight="bold">
              {t('listingSettingsGroup:listingSettingsGroup.emptyState.title')}
            </Text>
            <Text variant="body" color="text.secondary">
              {t('listingSettingsGroup:listingSettingsGroup.emptyState.description')}
            </Text>
          </S.EmptyStateContent>
          <Button variant="secondary" onClick={onCreateGroup}>
            {t('listingSettingsGroup:listingSettingsGroup.emptyState.action')}
          </Button>
        </S.EmptyState>
      ) : (
        <S.CardGrid>
          {groups.map((group: ListingSettingsGroupResponse) => (
            <S.InteractiveCard 
              key={group.id} 
              variant="bordered"
              onClick={() => onEditGroup(group.id)}
            >
                <CardHeader 
                  icon={
                    <S.CardIconWrapper>
                      <Icon name="check-list" size={24} />
                    </S.CardIconWrapper>
                  }
                  actions={
                    <Badge variant="success" size="sm">
                      {t('listingSettingsGroup:listingSettingsGroup.statusActive')}
                    </Badge>
                  }
                >
                  {null}
                </CardHeader>
                
                <CardBody>
                  <S.CardContent>
                    <Text variant="h4" weight="bold">
                      {group.name}
                    </Text>
                    {group.description && (
                      <Text variant="caption" color="text.secondary" truncate>
                        {group.description}
                      </Text>
                    )}
                  </S.CardContent>

                  <S.CardFooter>
                    <S.Stats>
                      <S.StatItem>
                        <Icon name="grid" size={14} />
                        {t('listingSettingsGroup:listingSettingsGroup.productsCount', { count: 0 })}
                      </S.StatItem>
                    </S.Stats>

                    <S.CardActions onClick={(e) => e.stopPropagation()}>
                      <S.IconButton onClick={() => onEditGroup(group.id)} title={t('listingSettingsGroup:listingSettingsGroup.tooltips.editGroup')}>
                        <Icon name="edit" size={18} />
                      </S.IconButton>
                      <S.IconButton 
                        className="delete" 
                        onClick={() => onDeleteGroup(group.id)} 
                        title={t('listingSettingsGroup:listingSettingsGroup.tooltips.deleteGroup')}
                      >
                        <Icon name="trash" size={18} />
                      </S.IconButton>
                    </S.CardActions>
                  </S.CardFooter>
                </CardBody>
            </S.InteractiveCard>
          ))}
        </S.CardGrid>
      )}

      <S.Copyright>
        {t('listingSettingsGroup:listingSettingsGroup.copyright', { year: new Date().getFullYear() })}
      </S.Copyright>
    </S.Container>
  );
};
