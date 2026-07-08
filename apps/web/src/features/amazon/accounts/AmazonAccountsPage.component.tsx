import { Button, Card, Icon, Modal, ModernTextInput, PageHeader, StatusBadge, Text, useTheme } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountsPage.style';
import type { AmazonAccountsPageComponentProps, AccountFormModalProps } from './AmazonAccountsPage.types';

const STATUS_VARIANT_MAP: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  active: 'success',
  invalid: 'error',
  needs_reauth: 'warning',
  locked: 'error',
};

export const AmazonAccountsPageComponent = ({
  accounts,
  isSaving,
  isVerifying,
  onDelete,
  onVerify,
  editingAccount,
  isAddModalOpen,
  onOpenAddModal,
  onCloseModal,
  formValues,
  onFormChange,
  onSubmitForm,
}: AmazonAccountsPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['amazon', 'translation']);
  const { theme } = useTheme();

  const isEditing = !!editingAccount;

  return (
    <S.Container>
      <PageHeader
        title={t('amazon.accounts.title')}
        subtitle={t('amazon.accounts.subtitle')}
        action={
          <Button variant="primary" onClick={onOpenAddModal}>
            <Text>{t('amazon.accounts.addButton')}</Text>
          </Button>
        }
      />

      {accounts.length > 0 ? (
        <S.AccountsGrid>
          {accounts.map((account) => (
            <Card key={account.id} variant="bordered" padding="lg">
              <S.CardHeader>
                <S.IconWrapper>
                  <Icon name="shopping-bag" size={24} color={theme.colors.semantic.success} />
                </S.IconWrapper>
                <StatusBadge status={STATUS_VARIANT_MAP[account.status] || 'info'} size="sm" />
              </S.CardHeader>
              <S.CardBody>
                <Text variant="h4" weight="semibold">{account.label || account.email}</Text>
                <Text variant="body-sm" color="text.secondary">{account.email}</Text>
              </S.CardBody>
              <S.CardMeta>
                {account.lastVerifiedAt && (
                  <S.MetaItem>
                    <Text variant="caption" color="text.tertiary">
                      {t('amazon.accounts.lastVerified')}: {new Date(account.lastVerifiedAt).toLocaleDateString()}
                    </Text>
                  </S.MetaItem>
                )}
              </S.CardMeta>
              <S.CardActions>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVerify(account.id)}
                  isLoading={isVerifying === account.id}
                >
                  <Text>{t('amazon.accounts.verifyButton')}</Text>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {}}
                >
                  <Text>{t('amazon.accounts.editButton')}</Text>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(account.id)}
                >
                  <Text>{t('amazon.accounts.deleteButton')}</Text>
                </Button>
              </S.CardActions>
            </Card>
          ))}
        </S.AccountsGrid>
      ) : (
        <Card variant="bordered" padding="lg">
          <S.EmptyStateInner>
            <S.EmptyIconWrapper>
              <Icon name="shopping-bag" size={40} color={theme.colors.brand.primary} />
            </S.EmptyIconWrapper>
            <Text variant="h3" weight="semibold">{t('amazon.accounts.noAccounts')}</Text>
            <S.EmptyDesc variant="body" color="text.secondary">
              {t('amazon.accounts.noAccountsDescription')}
            </S.EmptyDesc>
            <Button variant="primary" onClick={onOpenAddModal}>
              <Text>{t('amazon.accounts.addButton')}</Text>
            </Button>
          </S.EmptyStateInner>
        </Card>
      )}

      <AccountFormModal
        isOpen={isAddModalOpen || isEditing}
        onClose={onCloseModal}
        isSaving={isSaving}
        defaultValues={editingAccount}
        title={isEditing ? t('amazon.accounts.editTitle') : t('amazon.accounts.addTitle')}
        formValues={formValues}
        onFormChange={onFormChange}
        onSubmitForm={onSubmitForm}
      />
    </S.Container>
  );
};

const AccountFormModal = ({ isOpen, onClose, isSaving, defaultValues, title, formValues, onFormChange, onSubmitForm }: AccountFormModalProps) => {
  const { t } = useTranslation(['amazon', 'translation']);
  const isEditing = !!defaultValues;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmitForm(); }}>
        <S.FormFields>
          <ModernTextInput
            label={t('amazon.accounts.labelField')}
            placeholder={t('amazon.accounts.labelPlaceholder')}
            value={formValues.label}
            onChange={(e) => onFormChange('label', e.target.value)}
          />
          {!isEditing && (
            <ModernTextInput
              label={t('amazon.accounts.emailField')}
              placeholder={t('amazon.accounts.emailPlaceholder')}
              type="email"
              value={formValues.email}
              onChange={(e) => onFormChange('email', e.target.value)}
              required
            />
          )}
          <ModernTextInput
            label={isEditing ? t('amazon.accounts.passwordField') : t('amazon.accounts.passwordField')}
            placeholder={t('amazon.accounts.passwordPlaceholder')}
            type="password"
            value={formValues.password}
            onChange={(e) => onFormChange('password', e.target.value)}
            required={!isEditing}
          />
          <ModernTextInput
            label={t('amazon.accounts.twoFactorField')}
            placeholder={t('amazon.accounts.twoFactorPlaceholder')}
            value={formValues.twoFactorSecret}
            onChange={(e) => onFormChange('twoFactorSecret', e.target.value)}
          />
          <S.InfoText variant="caption" color="text.tertiary">
            {t('amazon.accounts.twoFactorInfo')}
          </S.InfoText>
          <S.FormActions>
            <Button variant="ghost" onClick={onClose} type="button">
              <Text>{t('translation:common.cancel')}</Text>
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving}>
              <Text>{t('amazon.accounts.saveButton')}</Text>
            </Button>
          </S.FormActions>
        </S.FormFields>
      </form>
    </Modal>
  );
};
