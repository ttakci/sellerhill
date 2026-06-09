import { Button, Card, Icon, Modal, ModernTextInput, PageHeader, StatusBadge, Text, useTheme } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountsPage.style';
import type { AmazonAccountsPageComponentProps } from './AmazonAccountsPage.types';

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
  onAdd,
  onEdit,
  onDelete,
  onVerify,
  editingAccount,
  isAddModalOpen,
  onOpenAddModal,
  onCloseModal,
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
          <Button variant="primary" iconLeft="plus" onClick={onOpenAddModal}>
            {t('amazon.accounts.addButton')}
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
                  iconLeft="check-circle"
                  onClick={() => onVerify(account.id)}
                  isLoading={isVerifying === account.id}
                >
                  {t('amazon.accounts.verifyButton')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft="edit"
                  onClick={() => {}}
                >
                  {t('amazon.accounts.editButton')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft="trash"
                  onClick={() => onDelete(account.id)}
                >
                  {t('amazon.accounts.deleteButton')}
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
            <Button variant="primary" iconLeft="plus" onClick={onOpenAddModal}>
              {t('amazon.accounts.addButton')}
            </Button>
          </S.EmptyStateInner>
        </Card>
      )}

      <AccountFormModal
        isOpen={isAddModalOpen || isEditing}
        onClose={onCloseModal}
        onSubmit={isEditing ? (data) => onEdit(editingAccount.id, data) : onAdd}
        isSaving={isSaving}
        defaultValues={editingAccount}
        title={isEditing ? t('amazon.accounts.editTitle') : t('amazon.accounts.addTitle')}
      />
    </S.Container>
  );
};

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { label?: string; email?: string; password?: string; twoFactorSecret?: string }) => void;
  isSaving: boolean;
  defaultValues?: { label?: string; email?: string } | null;
  title: string;
}

const AccountFormModal = ({ isOpen, onClose, onSubmit, isSaving, defaultValues, title }: AccountFormModalProps) => {
  const { t } = useTranslation(['amazon', 'translation']);
  const [label, setLabel] = useState(defaultValues?.label || '');
  const [email, setEmail] = useState(defaultValues?.email || '');
  const [password, setPassword] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const isEditing = !!defaultValues;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, string> = {};
    if (label) {data.label = label;}
    if (email) {data.email = email;}
    if (password) {data.password = password;}
    if (twoFactorSecret) {data.twoFactorSecret = twoFactorSecret;}
    onSubmit(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit}>
        <S.FormFields>
          <ModernTextInput
            label={t('amazon.accounts.labelField')}
            placeholder={t('amazon.accounts.labelPlaceholder')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          {!isEditing && (
            <ModernTextInput
              label={t('amazon.accounts.emailField')}
              placeholder={t('amazon.accounts.emailPlaceholder')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <ModernTextInput
            label={isEditing ? t('amazon.accounts.passwordField') : t('amazon.accounts.passwordField')}
            placeholder={t('amazon.accounts.passwordPlaceholder')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEditing}
          />
          <ModernTextInput
            label={t('amazon.accounts.twoFactorField')}
            placeholder={t('amazon.accounts.twoFactorPlaceholder')}
            value={twoFactorSecret}
            onChange={(e) => setTwoFactorSecret(e.target.value)}
          />
          <S.InfoText variant="caption" color="text.tertiary">
            {t('amazon.accounts.twoFactorInfo')}
          </S.InfoText>
          <S.FormActions>
            <Button variant="ghost" onClick={onClose} type="button">
              {t('translation:common.cancel')}
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving}>
              {t('amazon.accounts.saveButton')}
            </Button>
          </S.FormActions>
        </S.FormFields>
      </form>
    </Modal>
  );
};
