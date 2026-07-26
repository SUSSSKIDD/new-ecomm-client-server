import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCategory } from '../context/CategoryContext';
import { useAuth } from '../context/AuthContext';
import {
  getRouteSEO,
  updateMetaTag,
  updateCanonical,
  injectJSONLD,
  removeJSONLD,
  generateCategorySchema,
  generateBreadcrumbSchema,
} from '../lib/seo';

export const SEOProvider = ({ children }) => {
  const location = useLocation();
  const { selectedProduct } = useCategory();
  const { token } = useAuth();

  useEffect(() => {
    const path = location.pathname;
    let seoConfig = getRouteSEO(path, { product: selectedProduct });
    
    // Handle category pages dynamically
    if (path.startsWith('/category/')) {
      const [, , mainCat, subCat] = path.split('/');
      if (mainCat && subCat) {
        seoConfig = getRouteSEO(path, { 
          mainCategory: decodeURIComponent(mainCat), 
          subCategory: decodeURIComponent(subCat) 
        });
      }
    }

    // Update document title
    document.title = seoConfig.title;

    // Update meta tags
    updateMetaTag('description', seoConfig.description, 'name');
    updateMetaTag('og:title', seoConfig.title);
    updateMetaTag('og:description', seoConfig.description);
    updateMetaTag('og:url', seoConfig.canonical);
    updateMetaTag('og:image', seoConfig.ogImage || 'https://neyokart.com/logo.png');
    updateMetaTag('twitter:title', seoConfig.title);
    updateMetaTag('twitter:description', seoConfig.description);
    updateMetaTag('twitter:image', seoConfig.ogImage || 'https://neyokart.com/logo.png');

    // Update canonical
    updateCanonical(seoConfig.canonical);

    // Handle structured data
    if (seoConfig.structuredData) {
      injectJSONLD('dynamic-schema', seoConfig.structuredData);
    } else {
      removeJSONLD('dynamic-schema');
    }

    // Handle robots
    const robotsContent = seoConfig.noIndex ? 'noindex, nofollow' : 'index, follow';
    updateMetaTag('robots', robotsContent, 'name');

  }, [location.pathname, selectedProduct]);

  // Additional effect for category pages to inject schema with product data
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/category/') && !selectedProduct) {
      const [, , mainCat, subCat] = path.split('/');
      if (mainCat && subCat) {
        // Try to get products from the page or we'll inject basic schema
        // The ProductGrid component will handle fetching and we can enhance later
        const mainCategory = decodeURIComponent(mainCat);
        const subCategory = decodeURIComponent(subCat);
        
        // Inject basic category schema (will be enhanced when products load)
        const schema = {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': `https://neyokart.com/category/${mainCat}/${subCat}#collection`,
          'name': `${subCategory} - ${mainCategory} | NEYOKART`,
          'description': `Browse ${subCategory} from ${mainCategory} category. Fresh products from local Varanasi stores. Free delivery above ₹199.`,
          'url': `https://neyokart.com/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(subCategory)}`,
          'mainEntity': {
            '@type': 'ItemList',
            'name': `${subCategory} Products`,
            'itemListElement': []
          },
          'breadcrumb': generateBreadcrumbSchema(`/category/${mainCat}/${subCat}`),
          'publisher': { '@id': 'https://neyokart.com#localbusiness' }
        };
        injectJSONLD('category-schema', schema);
      }
    } else {
      removeJSONLD('category-schema');
    }
  }, [location.pathname, selectedProduct]);

  return <>{children}</>;
};

export default SEOProvider;