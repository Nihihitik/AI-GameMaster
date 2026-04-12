import httpClient from './httpClient';
import {
  SubscriptionStatusResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
} from '../types/api';

export const subscriptionsApi = {
  me: () =>
    httpClient.get<SubscriptionStatusResponse>('/subscriptions/me'),

  create: (data: CreateSubscriptionRequest) =>
    httpClient.post<CreateSubscriptionResponse>('/subscriptions', data),
};
