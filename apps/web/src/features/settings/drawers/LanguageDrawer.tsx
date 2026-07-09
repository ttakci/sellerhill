import styled from '@emotion/styled';
import { Button, Drawer, Radio, Text, tkn } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
`;

const LanguageOption = styled.label`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  background: ${tkn('colors.surface.secondary')};
`;

export interface LanguageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageDrawer: React.FC<LanguageDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState<string>(i18n.language);

  const handleSave = (): void => {
    void i18n.changeLanguage(language).then(() => {
      onClose();
    });
  };

  const footer = (
    <FooterRow>
      <Button variant="text" onClick={onClose}>
        <Text>{t('translation:common.cancel')}</Text>
      </Button>
      <Button variant="primary" onClick={handleSave}>
        <Text>{t('translation:common.save')}</Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.language.title')}
      subtitle={t('translation:settingsHub.drawer.language.subtitle')}
      footer={footer}
      size="sm"
    >
      <BodyStack>
        <LanguageOption>
          <Radio
            name="language"
            checked={language.startsWith('en')}
            onChange={() => setLanguage('en')}
          />
          <Text variant="body">
            {t('translation:settingsHub.drawer.language.en')}
          </Text>
        </LanguageOption>
        <LanguageOption>
          <Radio
            name="language"
            checked={language.startsWith('tr')}
            onChange={() => setLanguage('tr')}
          />
          <Text variant="body">
            {t('translation:settingsHub.drawer.language.tr')}
          </Text>
        </LanguageOption>
      </BodyStack>
    </Drawer>
  );
};
