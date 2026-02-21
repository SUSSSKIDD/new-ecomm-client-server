import { RippleButton } from '../components/ui/ripple-button';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/united/Header';
import ImageCarousel from '../components/united/ImageCarousel';
import { useCategory } from '../context/CategoryContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart, setIsCartOpen } = useCategory();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await axios.get(`${API_URL}/products/${id}`);
                setProduct(response.data);
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
    }, [id]);

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Header />
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ud-primary"></div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Header />
                <div className="flex-1 flex flex-col justify-center items-center gap-4">
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

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />
            <div className="flex-1 container mx-auto px-4 py-8">
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

                        {/* Additional Info */}
                        <div className="border-t border-gray-100 pt-6 space-y-3 text-sm text-gray-600">
                            {product.storeLocation && (
                                <div className="flex justify-between">
                                    <span>Aisle Location:</span>
                                    <span className="font-medium text-gray-900">{product.storeLocation}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>Stock Status:</span>
                                <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {product.stock > 0 ? 'In Stock' : 'Out of Stock'} ({product.stock} items)
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-4">
                            <RippleButton
                                disabled={product.stock <= 0}
                                onClick={() => addToCart(product)}
                                className="flex-1 py-3 px-6 bg-yellow-400 font-bold text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add to Cart
                            </RippleButton>
                            <RippleButton
                                disabled={product.stock <= 0}
                                onClick={() => { addToCart(product); setIsCartOpen(true); }}
                                className="flex-1 py-3 px-6 bg-orange-500 font-bold text-white rounded-lg hover:bg-orange-600 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Buy Now
                            </RippleButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetails;
