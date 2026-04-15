import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { adminApi } from '../../lib/api';

const AdminLedger = () => {
    const { admin } = useAdminAuth();
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [downloading, setDownloading] = useState(false);

    const fetchLedger = async (signal) => {
        try {
            setLoading(true);
            const endpoint = admin?.role === 'ADMIN' ? '/ledger' : '/ledger/my-store';
            const res = await adminApi().get(endpoint, { signal });
            let filteredData = res.data;
            if (startDate) {
                filteredData = filteredData.filter(d => new Date(d.date) >= new Date(startDate));
            }
            if (endDate) {
                filteredData = filteredData.filter(d => new Date(d.date) <= new Date(endDate));
            }
            setLedgerEntries(filteredData);
        } catch (err) {
            if (err.name !== 'CanceledError') {
                console.error(err);
                setError('Error loading ledger entries');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const ctrl = new AbortController();
        fetchLedger(ctrl.signal);
        return () => ctrl.abort();
    }, [startDate, endDate]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await adminApi().get('/orders/admin/export/csv', {
                params: { startDate, endDate },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `export_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Payment Ledger</h1>

                <div className="flex gap-2 items-center">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900"
                    />
                    {(startDate || endDate) && (
                        <RippleButton
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            className="text-sm text-red-500 hover:text-red-700 ml-2"
                        >
                            Clear
                        </RippleButton>
                    )}
                    <RippleButton
                        onClick={handleDownload}
                        disabled={downloading}
                        className={`text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded ml-2 flex items-center gap-2 transition-all ${downloading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {downloading ? 'Exporting...' : 'Export CSV'}
                    </RippleButton>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>}

            {loading ? (
                <div className="text-center p-10 animate-pulse text-gray-500">Loading ledger...</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference Notes</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {ledgerEntries.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                            No ledger entries found.
                                        </td>
                                    </tr>
                                )}
                                {ledgerEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {entry.transactionId}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(entry.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                                            ₹{entry.amount?.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {entry.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={entry.referenceNotes}>
                                            {entry.referenceNotes || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLedger;
