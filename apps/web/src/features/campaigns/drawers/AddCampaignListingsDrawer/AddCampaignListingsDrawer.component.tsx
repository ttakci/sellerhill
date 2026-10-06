import { Button, Checkbox, Drawer, EmptyState, InfoMessage, ModernSelect, SearchField, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './AddCampaignListingsDrawer.style';
import type { AddCampaignListingsDrawerComponentProps } from './AddCampaignListingsDrawer.types';

export function AddCampaignListingsDrawerComponent(props: AddCampaignListingsDrawerComponentProps) {
  const { t } = useTranslation(['campaigns', 'translation']);
  return (
    <Drawer
      isOpen
      onClose={props.onClose}
      title={t('campaigns.add.title')}
      primaryAction={{
        label: t('campaigns.actions.addListings'),
        onClick: props.onSubmit,
        isLoading: props.isSaving,
        disabled: props.isSaving || props.filling || !props.writable,
      }}
    >
      <S.Form variant="bordered" padding="lg">
        <ModernSelect
          label={t('campaigns.add.group')}
          options={props.options}
          value={props.group}
          onChange={props.onGroup}
          isDisabled={props.isSaving || !props.writable}
        />
        <Text variant="caption" muted>
          {t('campaigns.add.groupHint')}
        </Text>
        {props.groupsError && (
          <InfoMessage type="error">
            <Text variant="body-sm">{t('campaigns.add.groupsError')}</Text>
            <Button variant="text" onClick={props.onRetryGroups}>
              <Text variant="body-sm">{t('campaigns.actions.retry')}</Text>
            </Button>
          </InfoMessage>
        )}
        {props.groupError && (
          <InfoMessage type="error">
            <Text variant="body-sm">{props.groupError}</Text>
            <Button variant="text" onClick={props.onRetryGroup}>
              <Text variant="body-sm">{t('campaigns.add.retryGroup')}</Text>
            </Button>
          </InfoMessage>
        )}
        {props.filling && <Text variant="body-sm">{t('campaigns.add.filling')}</Text>}
        <SearchField
          value={props.search}
          onChange={props.onSearch}
          aria-label={t('campaigns.members.search')}
          placeholder={t('campaigns.members.search')}
          disabled={props.isSaving || !props.writable}
        />
        <Text variant="body-sm" numeric>
          {t('campaigns.add.skipped', { count: props.skipped })}
        </Text>
        <Text variant="h4" weight="semibold">
          {t('campaigns.add.selection', { count: props.selected.length })}
        </Text>
        {props.selectionError && (
          <InfoMessage type="error">
            <Text variant="body-sm">{props.selectionError}</Text>
          </InfoMessage>
        )}
        {props.selected.map((member) => (
          <S.Row key={member.listingId}>
            <Text variant="body-sm">{member.title}</Text>
            <Button variant="text" size="small" disabled={props.isSaving} onClick={() => props.onToggle(member, false)}>
              <Text variant="body-sm">{t('campaigns.add.removeSelection', { title: member.title })}</Text>
            </Button>
          </S.Row>
        ))}
        {props.feedback && (
          <InfoMessage type="info">
            <Text variant="body-sm">{props.feedback}</Text>
          </InfoMessage>
        )}
        {props.isLoading ? (
          <EmptyState title={t('translation:common.loading')} description={t('campaigns.add.title')} />
        ) : props.candidatesError ? (
          <EmptyState
            title={t('campaigns.errors.load')}
            description={t('campaigns.errors.description')}
            action={t('campaigns.actions.retry')}
            onAction={props.onRetryCandidates}
          />
        ) : props.items.length ? (
          props.items.map(({ member, checked }) => (
            <S.Row key={member.listingId}>
              <Checkbox
                checked={checked}
                label={member.title}
                disabled={props.isSaving || !props.writable}
                onChange={(value) => props.onToggle(member, value)}
              />
            </S.Row>
          ))
        ) : (
          <EmptyState title={t('campaigns.add.empty')} description={t('campaigns.add.groupHint')} />
        )}
        <S.Row>
          <Button variant="text" disabled={props.previousDisabled} onClick={props.onPrevious}>
            <Text variant="body-sm">{t('campaigns.add.previous')}</Text>
          </Button>
          <Text variant="caption" numeric>
            {props.pageLabel}
          </Text>
          <Button variant="text" disabled={props.nextDisabled} onClick={props.onNext}>
            <Text variant="body-sm">{t('campaigns.add.next')}</Text>
          </Button>
        </S.Row>
      </S.Form>
    </Drawer>
  );
}
