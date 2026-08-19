import { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  phone: string;
  role: string;
  storeId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
