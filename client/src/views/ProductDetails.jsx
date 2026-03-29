import { RippleButton } from '../components/ui/ripple-button';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLocation } from '../context/LocationContext';
import Header from '../components/united/Header';
import ImageCarousel from '../components/united/ImageCarousel';
import { useCategory } from '../context/CategoryContext';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { location } = useLocation();
    const { addToCart, setIsCartOpen } = useCategory();
    const { token } = useAuth();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Upload state
    const [uploadType, setUploadType] = useState('NONE');
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadPreviews, setUploadPreviews] = useState([]);
    const [uploadedUrls, setUploadedUrls] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const previewUrlsRef = useRef([]);

    // Print product / size selection (for DESIGN_UPLOAD)
    const [printProducts, setPrintProducts] = useState([]);
    const [selectedPrintProduct, setSelectedPrintProduct] = useState(null);
    const [selectedSize, setSelectedSize] = useState('');

    // Revoke all object URLs on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await axios.get(`${API_URL}/products/${id}`, {
                    params: {
                        lat: location?.lat,
                        lng: location?.lng
                    }
                });
                setProduct(response.data);

                // Check category config for upload type
                const storeType = response.data.category;
                if (storeType === 'DROP_IN_FACTORY' && response.data.subCategory) {
                    try {
                        const configRes = await axios.get(`${API_URL}/stores/category-config?storeType=DROP_IN_FACTORY`);
                        const configs = configRes.data;
                        let ut = 'NONE';
                        if (Array.isArray(configs)) {
                            const match = configs.find(c => c.subcategory === response.data.subCategory);
                            if (match) ut = match.uploadType;
                        } else if (configs && typeof configs === 'object') {
                            ut = configs[response.data.subCategory] || 'NONE';
                        }
                        setUploadType(ut);

                        // Fetch print products if design upload
                        if (ut === 'DESIGN_UPLOAD') {
                            const ppRes = await axios.get(`${API_URL}/print-products/active`);
                            setPrintProducts(ppRes.data || []);
                        }
                    } catch (err) {
                        console.error('Failed to fetch category config:', err);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch product", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchProduct();
        }
    }, [id, location?.lat, location?.lng]);

    const handleBack = () => {
        navigate(-1);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        const maxFiles = uploadType === 'PHOTO_UPLOAD' ? 1 : 3;
        const totalFiles = uploadFiles.length + files.length;

        if (totalFiles > maxFiles) {
            setUploadError(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed`);
            return;
        }

        setUploadError('');
        const newFiles = [...uploadFiles, ...files].slice(0, maxFiles);
        setUploadFiles(newFiles);

        // Generate previews, revoking old ones first
        const previews = newFiles.map(file => URL.createObjectURL(file));
        setUploadPreviews(prev => {
            prev.forEach(url => URL.revokeObjectURL(url));
            previewUrlsRef.current = previews;
            return previews;
        });
    };

    const removeFile = (index) => {
        setUploadFiles(prev => prev.filter((_, i) => i !== index));
        setUploadPreviews(prev => {
            URL.revokeObjectURL(prev[index]);
            const next = prev.filter((_, i) => i !== index);
            previewUrlsRef.current = next;
            return next;
        });
        setUploadedUrls(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (uploadFiles.length === 0) return;
        if (!token) {
            setUploadError('Please login to upload files');
            return;
        }
        setUploading(true);
        setUploadError('');

        try {
            const formData = new FormData();
            uploadFiles.forEach(file => formData.append('designs', file));

            const res = await axios.post(`${API_URL}/uploads/user-designs`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            });
            setUploadedUrls(res.data.urls || []);
        } catch (err) {
            setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleAddToCart = () => {
        const customFields = {};

        if (uploadedUrls.length > 0) {
            customFields.userUploadUrls = uploadedUrls;
        }

        if (uploadType === 'DESIGN_UPLOAD') {
            if (!selectedPrintProduct) {
                setUploadError('Please select a product type');
                return;
            }
            if (!selectedSize) {
                setUploadError('Please select a size');
                return;
            }
            customFields.printProductId = selectedPrintProduct.id;
            customFields.selectedSize = selectedSize;
        }

        if (uploadType !== 'NONE' && uploadedUrls.length === 0) {
            setUploadError('Please upload your design/photo first');
            return;
        }

        addToCart(product, null, Object.keys(customFields).length > 0 ? customFields : undefined);
    };

    const handleBuyNow = () => {
        handleAddToCart();
        setIsCartOpen(true);
    };

    if (loading) {
        return (
            <div className="h-[100dvh] w-full flex flex-col overflow-hidden overscroll-none bg-gray-50">
                <Header />
                <div className="flex-1 w-full overflow-y-auto overscroll-none flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ud-primary"></div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="h-[100dvh] w-full flex flex-col overflow-hidden overscroll-none bg-gray-50">
                <Header />
                <div className="flex-1 w-full overflow-y-auto overscroll-none flex flex-col justify-center items-center gap-4">
                    <p className="text-red-500 text-lg">Failed to load product details.</p>
                    <RippleButton onClick={handleBack} className="px-4 py-2 bg-ud-primary text-white rounded-lg">
                        Go Back
                    </RippleButton>
                </div>
            </div>
        );
    }

    const discount = product.mrp && product.mrp > product.price
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
        : 0;

    const isUploadRequired = uploadType !== 'NONE';
    const hasUploaded = uploadedUrls.length > 0;
    const canAddToCart = !isUploadRequired || (hasUploaded && (uploadType !== 'DESIGN_UPLOAD' || (selectedPrintProduct && selectedSize)));

    return (
        <div className="h-[100dvh] w-full flex flex-col overflow-hidden overscroll-none bg-gray-50">
            <Header />
            <div className="flex-1 w-full overflow-y-auto overscroll-none min-h-0">
                <div className="container mx-auto px-4 py-8">
                    <RippleButton onClick={handleBack} className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Shopping
                    </RippleButton>

                    <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row">
                        {/* Image Carousel Section */}
                        <div className="md:w-1/2">
                            <ImageCarousel
                                images={product.images || []}
                                altText={product.name}
                                className="h-[400px]"
                            />
                        </div>

                        {/* Details Section */}
                        <div className="md:w-1/2 p-8">
                            <div className="mb-2">
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase tracking-wide">
                                    {product.category}
                                </span>
                                {product.subCategory && (
                                    <span className="ml-2 bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase tracking-wide">
                                        {product.subCategory}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                            {product.description && (
                                <p className="text-gray-500 mb-6 text-lg">{product.description}</p>
                            )}

                            <div className="flex items-end gap-3 mb-6">
                                <span className="text-4xl font-bold text-gray-900">₹{product.price}</span>
                                {product.mrp && product.mrp > product.price && (
                                    <span className="text-lg text-gray-500 line-through mb-1">₹{product.mrp}</span>
                                )}
                                {discount > 0 && (
                                    <span className="text-green-600 font-bold mb-1">
                                        {discount}% OFF
                                    </span>
                                )}
                            </div>

                            {/* Upload Section */}
                            {isUploadRequired && (
                                <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50">
                                    <h3 className="text-sm font-bold text-gray-700 mb-3">
                                        {uploadType === 'PHOTO_UPLOAD'
                                            ? 'Upload Your Photo'
                                            : 'Upload Your Designs (up to 3)'}
                                    </h3>

                                    {/* File Input */}
                                    {uploadedUrls.length === 0 && (
                                        <>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple={uploadType === 'DESIGN_UPLOAD'}
                                                onChange={handleFileSelect}
                                                className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-ud-primary/10 file:text-ud-primary hover:file:bg-ud-primary/20 w-full"
                                            />

                                            {/* Previews */}
                                            {uploadPreviews.length > 0 && (
                                                <div className="flex gap-3 mt-3 flex-wrap">
                                                    {uploadPreviews.map((preview, i) => (
                                                        <div key={i} className="relative">
                                                            <img src={preview} alt={`Preview ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
                                                            <button
                                                                onClick={() => removeFile(i)}
                                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                                                            >
                                                                &times;
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {uploadFiles.length > 0 && (
                                                <RippleButton
                                                    onClick={handleUpload}
                                                    disabled={uploading || !token}
                                                    className="mt-3 px-4 py-2 bg-ud-primary text-white rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50 w-full"
                                                >
                                                    {uploading ? 'Uploading...' : !token ? 'Login to Upload' : `Upload ${uploadFiles.length} File${uploadFiles.length > 1 ? 's' : ''}`}
                                                </RippleButton>
                                            )}
                                        </>
                                    )}

                                    {/* Uploaded confirmation */}
                                    {uploadedUrls.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-2">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                {uploadedUrls.length} file{uploadedUrls.length > 1 ? 's' : ''} uploaded successfully
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {uploadedUrls.map((url, i) => (
                                                    <img key={i} src={url} alt={`Upload ${i + 1}`} className="w-16 h-16 object-cover rounded border" />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {uploadError && (
                                        <p className="text-red-500 text-xs mt-2">{uploadError}</p>
                                    )}
                                </div>
                            )}

                            {/* Print Product + Size Selection (for DESIGN_UPLOAD) */}
                            {uploadType === 'DESIGN_UPLOAD' && hasUploaded && (
                                <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50">
                                    <h3 className="text-sm font-bold text-gray-700 mb-3">Select Product & Size</h3>

                                    {/* Print Product Selection */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-gray-500 mb-2">Print On</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {printProducts.map(pp => (
                                                <button
                                                    key={pp.id}
                                                    type="button"
                                                    onClick={() => { setSelectedPrintProduct(pp); setSelectedSize(''); }}
                                                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                                                        selectedPrintProduct?.id === pp.id
                                                            ? 'border-ud-primary bg-ud-primary/5 ring-1 ring-ud-primary'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {pp.image ? (
                                                        <img src={pp.image} alt={pp.name} className="w-8 h-8 rounded object-cover" />
                                                    ) : (
                                                        <span className="text-lg">
                                                            {pp.productType === 'TSHIRT' ? '👕' : pp.productType === 'FRAME' ? '🖼️' : pp.productType === 'MUG' ? '☕' : '📦'}
                                                        </span>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">{pp.name}</p>
                                                        <p className="text-xs text-gray-500">₹{pp.basePrice}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        {printProducts.length === 0 && (
                                            <p className="text-sm text-gray-400">No print products available</p>
                                        )}
                                    </div>

                                    {/* Size Selection */}
                                    {selectedPrintProduct && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-2">Select Size</label>
                                            <div className="flex flex-wrap gap-2">
                                                {(selectedPrintProduct.sizes || []).map(size => (
                                                    <button
                                                        key={size.value}
                                                        type="button"
                                                        onClick={() => setSelectedSize(size.value)}
                                                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                                            selectedSize === size.value
                                                                ? 'border-ud-primary bg-ud-primary text-white'
                                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {size.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Additional Info (Aisle and Count hidden from users) */}
                            <div className="border-t border-gray-100 pt-6 space-y-3 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span>Stock Status:</span>
                                    <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-4">
                                <RippleButton
                                    disabled={product.stock <= 0 || (isUploadRequired && !canAddToCart)}
                                    onClick={handleAddToCart}
                                    className="flex-1 py-3 px-6 bg-yellow-400 font-bold text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add to Cart
                                </RippleButton>
                                <RippleButton
                                    disabled={product.stock <= 0 || (isUploadRequired && !canAddToCart)}
                                    onClick={handleBuyNow}
                                    className="flex-1 py-3 px-6 bg-orange-500 font-bold text-white rounded-lg hover:bg-orange-600 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Buy Now
                                </RippleButton>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetails;
