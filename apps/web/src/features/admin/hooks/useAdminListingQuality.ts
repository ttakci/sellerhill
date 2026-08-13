import { useCallback, useState } from 'react';

import type { AdminListingQualityView } from '../AdminPage/AdminPage.types';
import {
  useGetAdminAspectDefaultsQuery,
  useGetAdminListingQualityQuery,
  useRemoveAdminAspectDefaultMutation,
} from '../api/admin.api';


/**
 * Listing-quality tab state.
 *
 * Split out of the container for the same reason the settings hook was: the
 * admin page owns several tabs, and folding each one's queries and handlers
 * into a single container is how god containers start.
 */
export function useAdminListingQuality(skip: boolean): AdminListingQualityView {
  const [search, setSearch] = useState('');

  const { data: summary } = useGetAdminListingQualityQuery(undefined, { skip });
  const { data: defaults } = useGetAdminAspectDefaultsQuery(search ? { search } : undefined, { skip });
  const [removeDefault, { isLoading: isRemoving }] = useRemoveAdminAspectDefaultMutation();

  const onRemoveDefault = useCallback(
    (id: string) => {
      void removeDefault(id);
    },
    [removeDefault]
  );

  return {
    summary,
    defaults: defaults?.items ?? [],
    search,
    onSearchChange: setSearch,
    onRemoveDefault,
    isRemoving,
  };
}
