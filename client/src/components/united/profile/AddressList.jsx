import { RippleButton } from '../../../components/ui/ripple-button';
import React from 'react';

const AddressList = ({ addresses, onAdd, onBack, loading, onEdit, onDelete }) => {
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
                <RippleButton onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </RippleButton>
                <h3 className="text-lg font-bold text-gray-900">My Addresses</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ud-primary"></div>
                    </div>
                ) : addresses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No addresses saved yet.</p>
                    </div>
                ) : (
                    addresses.map((addr) => (
                        <div key={addr.id} className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm relative group">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-1 text-xs font-bold rounded-md uppercase ${addr.type === 'HOME' ? 'bg-blue-50 text-blue-600' :
                                        addr.type === 'WORK' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'
                                    }`}>
                                    {addr.type}
                                </span>
                                <div className="flex gap-2">
                                    <RippleButton
                                        onClick={() => onEdit(addr)}
                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </RippleButton>
                                    <RippleButton
                                        onClick={() => onDelete(addr.id)}
                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </RippleButton>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-gray-900">
                                {addr.recipientName || addr.user?.name || addr.user?.phone || 'Me'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                {addr.houseNo}, {addr.street}<br />
                                {addr.city}, {addr.state} - {addr.zipCode}
                            </p>
                            {addr.recipientPhone && (
                                <p className="text-xs text-gray-500 mt-1">Phone: {addr.recipientPhone}</p>
                            )}
                            {addr.mapsLink && (
                                <a href={addr.mapsLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">View on Maps</a>
                            )}
                        </div>
                    ))
                )}
            </div>

            <RippleButton
                onClick={onAdd}
                className="mt-4 w-full py-3 bg-ud-primary text-white font-bold rounded-xl shadow-lg hover:bg-emerald-600 transition-colors"
            >
                + Add New Address
            </RippleButton>
        </div>
    );
};

export default AddressList;
