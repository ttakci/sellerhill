import type { ListingSettingsGroupResponse } from '@repo/shared';
import { Badge, Button, Icon, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';
import * as S from './ListingSettingsGroupPage.style';
import { ListingSettingsGroupPageProps } from './ListingSettingsGroupPage.types';

export const ListingSettingsGroupPageComponent = ({
  groups,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: ListingSettingsGroupPageProps) => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon name="check-list" size={28} color="brand.primary" />
            <Text variant="h3" weight="bold" style={{ fontSize: '26px' }}>
              {t('listingSettingsGroup.title')}
            </Text>
          </div>
          <Text variant="body" color="text.secondary">
            {t('listingSettingsGroup.subtitle')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="primary" size="md" onClick={onCreateGroup}>
            <Icon name="plus" size={18} />
            <Text variant="body" weight="medium" color="inherit">
              {t('listingSettingsGroup.createNewGroup')}
            </Text>
          </Button>
        </S.Actions>
      </S.Header>

      {groups.length === 0 ? (
        <S.EmptyState>
          <Icon name="box" size={64} color="text.tertiary" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Text variant="h4" weight="bold">
              {t('listingSettingsGroup.emptyState.title')}
            </Text>
            <Text variant="body" color="text.secondary">
              {t('listingSettingsGroup.emptyState.description')}
            </Text>
          </div>
          <Button variant="secondary" onClick={onCreateGroup}>
            {t('listingSettingsGroup.emptyState.action')}
          </Button>
        </S.EmptyState>
      ) : (
        <S.CardGrid>
          {groups.map((group: ListingSettingsGroupResponse) => (
            <S.GroupCard key={group.id} onClick={() => onEditGroup(group.id)}>
              <S.CardHeader>
                <S.CardIconWrapper>
                  <Icon name="check-list" size={24} />
                </S.CardIconWrapper>
                <Badge variant="success" size="sm">
                  {t('listingSettingsGroup.statusActive')}
                </Badge>
              </S.CardHeader>
              
              <S.CardContent>
                <Text variant="h4" weight="bold">
                  {group.name}
                </Text>
                {group.description && (
                  <Text variant="caption" color="text.secondary" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {group.description}
                  </Text>
                )}
              </S.CardContent>

              <S.CardFooter>
                <S.Stats>
                  <S.StatItem>
                    <Icon name="grid" size={14} />
                    {t('listingSettingsGroup.productsCount', { count: 0 })}
                  </S.StatItem>
                  <S.StatItem>
                    <Icon name="settings" size={14} />
                    {group.templates.type === 'custom' 
                      ? t('listingSettingsGroup.customTemplate') 
                      : t('listingSettingsGroup.predefinedTemplate')}
                  </S.StatItem>
                </S.Stats>

                <S.CardActions onClick={(e) => e.stopPropagation()}>
                  <S.IconButton onClick={() => onEditGroup(group.id)} title={t('listingSettingsGroup.tooltips.editGroup')}>
                    <Icon name="settings" size={18} />
                  </S.IconButton>
                  <S.IconButton 
                    className="delete" 
                    onClick={() => onDeleteGroup(group.id)} 
                    title={t('listingSettingsGroup.tooltips.deleteGroup')}
                  >
                    <Icon name="trash" size={18} />
                  </S.IconButton>
                </S.CardActions>
              </S.CardFooter>
            </S.GroupCard>
          ))}
        </S.CardGrid>
      )}
    </S.Container>
  );
};
