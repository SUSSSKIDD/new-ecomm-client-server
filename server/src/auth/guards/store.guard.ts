import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class StoreGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            return false;
        }

        // Role.ADMIN bypasses everything
        if (user.role === Role.ADMIN) {
            return true;
        }

        // Role.STORE_MANAGER must match storeId
        if (user.role === Role.STORE_MANAGER) {
            if (!user.storeId) {
                throw new ForbiddenException('Store Manager has no assigned store');
            }

            const storeIdParam = request.params.storeId;
            const idParam = request.params.id;

            // Case 1: Route has :storeId param (e.g. /stores/:storeId/inventory)
            if (storeIdParam) {
                if (user.storeId !== storeIdParam) {
                    throw new ForbiddenException('Access denied to this store');
                }
                return true;
            }

            // Case 2: Route is /stores/:id (e.g. update store)
            // We check if the route path seems to be modifying a store directly.
            // This path check is a bit heuristic but effective for standard REST.
            if (
                request.path.includes('/stores/') &&
                idParam &&
                !request.path.includes('/products') // Avoid confusing /products/:id
            ) {
                // Validating /stores/:id
                if (user.storeId !== idParam) {
                    throw new ForbiddenException('Access denied to this store');
                }
                return true;
            }

            // If we are in a context where no store ID is explicitly in URL 
            // (e.g. creating product using body storeId, or listing "my" orders),
            // the Controller is responsible for using req.user.storeId to scope the DB query.
            // The Guard just ensures if a specific store RESOURCE is requested, it matches.

            return true;
        }

        // PARCEL_MANAGER gets read-only access to store resources (view stores)
        if (user.role === Role.PARCEL_MANAGER) {
            const method = request.method?.toUpperCase();
            if (method === 'GET') {
                return true;
            }
            throw new ForbiddenException('Parcel Managers have read-only access to store resources');
        }

        // All other roles (USER, DELIVERY_PERSON) are denied access to store resources
        throw new ForbiddenException('Access denied: insufficient role for store resources');
    }
}
