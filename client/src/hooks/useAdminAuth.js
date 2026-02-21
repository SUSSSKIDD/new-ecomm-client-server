import { useContext } from 'react';
import { AdminAuthContext } from '../context/AdminAuthContext';

export const useAdminAuth = () => {
    return useContext(AdminAuthContext);
};
