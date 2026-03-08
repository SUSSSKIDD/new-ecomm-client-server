import { useState, useEffect } from 'react';
import { useAddresses } from '../../../hooks/useAddresses';
import AddressList from './AddressList';
import AddressForm from './AddressForm';

const AddressManager = ({ onBack }) => {
    const { addresses, fetchAddresses, addAddress, updateAddress, deleteAddress, loading, error } = useAddresses();
    const [view, setView] = useState('list'); // 'list', 'add'
    const [editingAddress, setEditingAddress] = useState(null);
    const [actionError, setActionError] = useState('');

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    const handleSaveAddress = async (formData) => {
        setActionError('');
        let result;
        if (editingAddress) {
            result = await updateAddress(editingAddress.id, formData);
        } else {
            result = await addAddress(formData);
        }

        if (result.success) {
            setView('list');
            setEditingAddress(null);
        } else {
            setActionError(result.error || "Failed to save address");
        }
    };

    const handleStartEdit = (address) => {
        setActionError('');
        setEditingAddress(address);
        setView('add');
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this address?")) {
            setActionError('');
            const result = await deleteAddress(id);
            if (!result.success) {
                setActionError(result.error || "Failed to delete address");
            }
        }
    };

    if (view === 'list') {
        return (
            <>
                {actionError && (
                    <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {actionError}
                    </div>
                )}
                <AddressList
                    addresses={addresses}
                    onAdd={() => { setEditingAddress(null); setActionError(''); setView('add'); }}
                    onBack={onBack}
                    loading={loading}
                    onEdit={handleStartEdit}
                    onDelete={handleDelete}
                />
            </>
        );
    }

    return (
        <>
            {actionError && (
                <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {actionError}
                </div>
            )}
            <AddressForm
                onSubmit={handleSaveAddress}
                onCancel={() => { setEditingAddress(null); setActionError(''); setView('list'); }}
                loading={loading}
                initialData={editingAddress}
            />
        </>
    );
};

export default AddressManager;
