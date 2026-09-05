import axios from 'axios';

export interface ServiceHealth {
  name: string;
  key: 'auth' | 'catalog' | 'quotation' | 'fulfillment' | 'billing' | 'analytics';
  url: string;
  status: 'connected' | 'offline' | 'development';
  version?: string;
  error?: string;
  implemented: boolean;
}

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://127.0.0.1:3000';

export const KNOWN_SERVICES: Array<{
  name: string;
  key: ServiceHealth['key'];
  url: string;
  healthEndpoint: string;
  implemented: boolean;
}> = [
  {
    name: 'Auth Service',
    key: 'auth',
    url: `${GATEWAY_URL}/api/v1/auth`,
    healthEndpoint: `${GATEWAY_URL}/health/auth`,
    implemented: true,
  },
  {
    name: 'Catalog Service',
    key: 'catalog',
    url: `${GATEWAY_URL}/api/v1/catalog`,
    healthEndpoint: `${GATEWAY_URL}/health/catalog`,
    implemented: true,
  },
  {
    name: 'Quotation Service',
    key: 'quotation',
    url: `${GATEWAY_URL}/api/v1/quotations`,
    healthEndpoint: `${GATEWAY_URL}/health/quotation`,
    implemented: true,
  },
  {
    name: 'Fulfillment Service',
    key: 'fulfillment',
    url: `${GATEWAY_URL}/api/v1/fulfillment`,
    healthEndpoint: `${GATEWAY_URL}/health/fulfillment`,
    implemented: true,
  },
  {
    name: 'Billing Service',
    key: 'billing',
    url: `${GATEWAY_URL}/api/v1/billing`,
    healthEndpoint: `${GATEWAY_URL}/health/billing`,
    implemented: true,
  },
  {
    name: 'Analytics Service',
    key: 'analytics',
    url: `${GATEWAY_URL}/api/v1/analytics`,
    healthEndpoint: `${GATEWAY_URL}/health/analytics`,
    implemented: true,
  },
];

export async function checkServiceHealth(service: typeof KNOWN_SERVICES[0]): Promise<ServiceHealth> {
  if (!service.implemented) {
    return {
      name: service.name,
      key: service.key,
      url: service.url,
      status: 'development',
      implemented: false,
    };
  }

  try {
    const res = await axios.get(service.healthEndpoint, { timeout: 3000 });
    return {
      name: service.name,
      key: service.key,
      url: service.url,
      status: res.status === 200 ? 'connected' : 'offline',
      version: res.data?.version || '1.0.0',
      implemented: true,
    };
  } catch (err: any) {
    return {
      name: service.name,
      key: service.key,
      url: service.url,
      status: 'offline',
      error: err.message || 'Connection refused via Gateway',
      implemented: true,
    };
  }
}

export async function checkAllServices(): Promise<ServiceHealth[]> {
  return Promise.all(KNOWN_SERVICES.map(checkServiceHealth));
}
