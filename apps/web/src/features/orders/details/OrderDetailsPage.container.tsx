import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useGetOrderByIdQuery, useUpdateOrderAmazonDetailsMutation } from '../api/orders.api';

import { OrderDetailsPageComponent } from './OrderDetailsPage.component';

export const OrderDetailsPageContainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading } = useGetOrderByIdQuery(id || '', {
    skip: !id,
  });

  const [updateOrder, { isLoading: isUpdating }] = useUpdateOrderAmazonDetailsMutation();

  const handleUpdateAmazonDetails = async (data: {
    amazonOrderUrl?: string;
    amazonTrackingUrl?: string;
    amazonTax?: number;
    amazonShipping?: number;
  }) => {
    if (!id) {return;}
    await updateOrder({ id, data });
  };

  const handleBack = () => {
    navigate('/orders');
  };

  return (
    <OrderDetailsPageComponent
      order={order}
      isLoading={isLoading}
      isUpdating={isUpdating}
      onUpdateAmazonDetails={handleUpdateAmazonDetails}
      onBack={handleBack}
    />
  );
};
