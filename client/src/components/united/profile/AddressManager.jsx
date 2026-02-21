import { useState, useEffect } from 'react';
import { useAddresses } from '../../../hooks/useAddresses';
import AddressList from './AddressList';
import AddressForm from './AddressForm';

const AddressManager = ({ onBack }) => {
    const { addresses, fetchAddresses, addAddress, updateAddress, deleteAddress, loading, error } = useAddresses();
    const [view, setView] = useState('list'); // 'list', 'add'
    const [editingAddress, setEditingAddress] = useState(null);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    const handleSaveAddress = async (formData) => {
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
            alert(result.error || "Failed to save address");
        }
    };

    const handleStartEdit = (address) => {
        setEditingAddress(address);
        setView('add');
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this address?")) {
            const result = await deleteAddress(id);
            if (!result.success) {
                alert(result.error || "Failed to delete address");
            }
        }
    };

    if (view === 'list') {
        return (
            <AddressList
                addresses={addresses}
                onAdd={() => { setEditingAddress(null); setView('add'); }}
                onBack={onBack}
                loading={loading}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
            />
        );
    }

    return (
        <AddressForm
            onSubmit={handleSaveAddress}
            onCancel={() => { setEditingAddress(null); setView('list'); }}
            loading={loading}
            initialData={editingAddress}
        />
    );
};

export default AddressManager;
