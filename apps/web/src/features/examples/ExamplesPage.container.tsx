import type { SerializedError } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { EXAMPLE_STATUS, type CreateExampleFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { toCreateExampleRequest } from './adapters/exampleAdapter';
import {
    useCreateExampleMutation,
    useDeleteExampleMutation,
    useGetExamplesQuery,
    useUpdateExampleMutation,
} from './api/examplesApi';
import { ExamplesPage } from './ExamplesPage.component';

import { getErrorMessage } from '@/utils/errorHandler';

export const ExamplesPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();

  // API queries and mutations
  const {
    data,
    isLoading,
    error: listError,
  } = useGetExamplesQuery({
    page: 1,
    limit: 20,
  });
  const [createExample, { isLoading: isCreating, isSuccess: createSuccess, error: createError }] =
    useCreateExampleMutation();
  const [updateExample, { isLoading: isUpdating, isSuccess: updateSuccess, error: updateError }] =
    useUpdateExampleMutation();
  const [deleteExample, { isLoading: isDeleting, isSuccess: deleteSuccess, error: deleteError }] =
    useDeleteExampleMutation();

  // Use RTK Query loading states with useLoading hook
  useLoading(isLoading || isCreating || isUpdating || isDeleting);

  // Success messages
  useEffect(() => {
    if (createSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'message.success.header',
          descriptionKey: 'example.createSuccess',
          primaryButton: {
            labelKey: 'message.success.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [createSuccess, showMessage, closeMessage, t]);

  useEffect(() => {
    if (updateSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'message.success.header',
          descriptionKey: 'example.archiveSuccess',
          primaryButton: {
            labelKey: 'message.success.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [updateSuccess, showMessage, closeMessage, t]);

  useEffect(() => {
    if (deleteSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'message.success.header',
          descriptionKey: 'example.deleteSuccess',
          primaryButton: {
            labelKey: 'message.success.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [deleteSuccess, showMessage, closeMessage, t]);

  // Error handling
  useEffect(() => {
    if (listError) {
      const { key, params } = getErrorMessage(listError as FetchBaseQueryError | SerializedError);
      showMessage(
        {
          type: 'error',
          headerKey: 'message.error.header',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    } else if (createError) {
      const { key, params } = getErrorMessage(createError as FetchBaseQueryError | SerializedError);
      showMessage(
        {
          type: 'error',
          headerKey: 'message.error.header',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'message.error.goHome',
            onClick: (): void => {
              closeMessage();
              void navigate('/');
            },
          },
          secondaryButton: {
            labelKey: 'message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    } else if (updateError) {
      const { key, params } = getErrorMessage(updateError as FetchBaseQueryError | SerializedError);
      showMessage(
        {
          type: 'error',
          headerKey: 'message.error.header',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    } else if (deleteError) {
      const { key, params } = getErrorMessage(deleteError as FetchBaseQueryError | SerializedError);
      showMessage(
        {
          type: 'error',
          headerKey: 'message.error.header',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [listError, createError, updateError, deleteError, showMessage, closeMessage, navigate, t]);

  // Event handlers
  const handleCreateExample = (formData: CreateExampleFormData): void => {
    const request = toCreateExampleRequest(formData);
    void createExample(request);
  };

  const handleArchive = (id: string): void => {
    void updateExample({ id, request: { status: EXAMPLE_STATUS.ARCHIVED } });
  };

  const handleDelete = (id: string): void => {
    void deleteExample({ id });
  };

  // Helper functions
  const isArchived = (status: string): boolean => status === EXAMPLE_STATUS.ARCHIVED;

  return (
    <ExamplesPage
      items={data?.data ?? []}
      onCreateExample={handleCreateExample}
      onArchive={handleArchive}
      onDelete={handleDelete}
      isArchived={isArchived}
    />
  );
};
