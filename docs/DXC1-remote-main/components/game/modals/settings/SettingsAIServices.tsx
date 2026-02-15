import React from 'react';
import type { AppSettings, GlobalAISettings } from '../../../../types';
import { AIServicesView } from './views/AIServicesView';

interface SettingsAIServicesProps {
  formData: AppSettings;
  setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
  onSave?: (nextAiConfig: GlobalAISettings) => void;
}

export const SettingsAIServices: React.FC<SettingsAIServicesProps> = ({
  formData,
  setFormData,
  onSave
}) => {
  return (
    <AIServicesView
      formData={formData}
      setFormData={setFormData}
      onSave={onSave}
    />
  );
};
