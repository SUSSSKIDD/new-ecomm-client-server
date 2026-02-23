import { RippleButton } from '../ui/ripple-button';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import PropTypes from 'prop-types';

const LoginModal = ({ isOpen, onClose }) => {
    const { sendOtp, verifyOtp } = useAuth();
    const [step, setStep] = useState('phone'); // 'phone' or 'otp'
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError(null);

        // Basic frontend validation for +91
        const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;

        const response = await sendOtp(formattedPhone);
        if (response.success) {
            setStep('otp');
            setPhone(formattedPhone);
        } else {
            setError(response.message);
        }
        setLoading(false);
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError(null);

        const response = await verifyOtp(phone, otp);
        if (response.success) {
            onClose(); // Close modal on success
        } else {
            setError(response.message);
        }
        setLoading(false);
    };

    // Start cooldown when entering OTP step
    useEffect(() => {
        if (step === 'otp') {
            setResendCooldown(30);
        }
    }, [step]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleResendOtp = useCallback(async () => {
        if (resendCooldown > 0 || loading) return;
        setLoading(true);
        setError(null);
        const response = await sendOtp(phone);
        if (response.success) {
            setResendCooldown(30);
        } else {
            setError(response.message);
        }
        setLoading(false);
    }, [resendCooldown, loading, phone, sendOtp]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">
                            {step === 'phone' ? 'Login or Sign up' : 'Enter OTP'}
                        </h2>
                        <RippleButton onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </RippleButton>
                    </div>

                    {step === 'phone' ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+91</span>
                                    <input
                                        type="tel"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ud-primary focus:border-ud-primary outline-none transition-all font-medium text-lg tracking-wide group-hover:border-gray-300"
                                        placeholder="Enter mobile number"
                                        value={phone.replace('+91', '')}
                                        onChange={(e) => setPhone(e.target.value)}
                                        pattern="[0-9]{10}"
                                        maxLength="10"
                                        inputMode="numeric"
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>
                            {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
                            <RippleButton
                                type="submit"
                                disabled={loading || phone.length < 10}
                                className="w-full py-3 bg-ud-primary text-white font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-ud-primary/20"
                            >
                                {loading && (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                )}
                                {loading ? 'Sending OTP...' : 'Continue'}
                            </RippleButton>
                            <p className="text-xs text-center text-gray-400 mt-4 leading-relaxed">
                                By continuing, you agree to our <span className="text-gray-600 underline cursor-pointer">Terms of Service</span> & <span className="text-gray-600 underline cursor-pointer">Privacy Policy</span>
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">
                                    We sent a code to <span className="font-bold text-gray-900">{phone}</span>
                                </p>
                                <RippleButton
                                    type="button"
                                    onClick={() => setStep('phone')}
                                    className="text-xs text-ud-primary font-bold hover:underline transition-all"
                                >
                                    Wrong number?
                                </RippleButton>
                            </div>

                            <div className="flex justify-center">
                                <input
                                    type="text"
                                    className="w-full text-center text-3xl tracking-[0.5em] py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ud-primary outline-none font-bold text-gray-800 transition-all focus:bg-white placeholder-gray-300"
                                    placeholder="••••••"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength="6"
                                    inputMode="numeric"
                                    autoFocus
                                    required
                                />
                            </div>

                            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}

                            <RippleButton
                                type="submit"
                                disabled={loading || otp.length < 6}
                                className="w-full py-3 bg-ud-primary text-white font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-ud-primary/20"
                            >
                                {loading && (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                )}
                                {loading ? 'Verifying...' : 'Verify & Login'}
                            </RippleButton>

                            <div className="text-center">
                                <RippleButton
                                    type="button"
                                    className={`text-xs font-medium transition-colors ${resendCooldown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-ud-primary hover:underline'}`}
                                    onClick={handleResendOtp}
                                    disabled={resendCooldown > 0 || loading}
                                >
                                    {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                                </RippleButton>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

LoginModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default LoginModal;
