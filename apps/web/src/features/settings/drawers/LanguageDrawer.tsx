import { Drawer, Radio, Text } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, LanguageOption } from './LanguageDrawer.style';
import type { LanguageDrawerProps } from './LanguageDrawer.types';

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

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.language.title')}
      subtitle={t('translation:settingsHub.drawer.language.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: handleSave,
      }}
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
