import { createServerFn } from '@tanstack/react-start';
import { publicPaymentConfiguration } from './payment-public-config.server';

export const getPublicPaymentConfiguration = createServerFn({ method: 'GET' })
  .handler(async () => publicPaymentConfiguration(process.env));
