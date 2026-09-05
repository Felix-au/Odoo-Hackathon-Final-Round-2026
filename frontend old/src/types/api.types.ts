import { Role } from '../lib/constants';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId?: string;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface PortalCustomer {
  customerId: string;
  email: string;
  name?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Array<{ field: string; message: string }>;
}
