export const BASE_URL = 'https://neyokart.com';
export const SITE_NAME = 'NEYOKART';
export const DEFAULT_OG_IMAGE = `${BASE_URL}/logo.png`;

export const SEO_DEFAULTS = {
  title: 'NEYOKART - Fresh Grocery Delivery in Varanasi | 30 Min Delivery',
  description: 'Order fresh vegetables, fruits, groceries & daily essentials from NEYOKART. Free delivery above ₹199. 30-min delivery in Varanasi. COD & Online payment available.',
  canonical: BASE_URL,
  ogImage: DEFAULT_OG_IMAGE,
  noIndex: false,
  noFollow: false,
};

export const CATEGORY_LABELS = {
  GROCERY: 'Grocery',
  PIZZA_TOWN: 'Pizza Town & Food Zone',
  FASHION: 'Fashion',
  AUTO_SERVICE: 'Auto Service & Parts',
  DROP_IN_FACTORY: 'Print Factory',
  AUTO_PARTS_SHOP: 'Auto Parts Shop',
  HOME_SERVICE: 'Home Service',
};

export const SUBCATEGORIES = {
  GROCERY: [
    'Vegetables & Fruits',
    'Atta, Rice & Dal',
    'Oil, Ghee & Masala',
    'Dairy, Bread & Eggs',
    'Bakery & Biscuits',
    'Dry Fruits & Cereals',
    'Chicken, Meat & Fish',
    'Kitchenware & Appliances',
    'Chips & Namkeen',
    'Sweets & Chocolates',
    'Drinks & Juices',
    'Tea, Coffee & Milk Drinks',
    'Instant Food',
    'Sauces & Spreads',
    'Paan Corner',
    'Ice Creams & More',
    'Bath & Body',
    'Hair',
    'Skin & Face',
    'Beauty & Cosmetics',
    'Feminine Hygiene',
    'Baby Care',
    'Health & Pharma',
    'Sexual Wellness',
    'Home & Lifestyle',
    'Cleaners & Repellents',
    'Electronics',
    'Stationery & Games',
  ],
  PIZZA_TOWN: ['Pizza', 'Burger', 'Sandwich', 'French Fries', 'Cake'],
  FASHION: [],
  AUTO_SERVICE: [],
  DROP_IN_FACTORY: [
    'General',
    'Photo Frames',
    'Coffee Mugs',
    'Custom T-Shirts',
    'Personalized Gifts',
    'Stationery Printing',
  ],
  AUTO_PARTS_SHOP: [],
  HOME_SERVICE: [],
};

export function generateProductSchema(product) {
  if (!product) return null;
  
  const price = parseFloat(String(product.price || 0).replace(/[₹,]/g, ''));
  const mrp = product.mrp ? parseFloat(String(product.mrp).replace(/[₹,]/g, '')) : null;
  const inStock = (product.stock ?? 0) > 0;
  const availability = inStock 
    ? 'https://schema.org/InStock' 
    : 'https://schema.org/OutOfStock';
  
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${BASE_URL}/product/${product.id}#product`,
    'sku': product.id,
    'name': product.name,
    'description': product.description || `Buy ${product.name} from NEYOKART - Fresh delivery in Varanasi.`,
    'brand': {
      '@type': 'Brand',
      'name': 'NEYOKART',
      'logo': `${BASE_URL}/logo.png`
    },
    'category': product.category || 'Grocery',
    'image': product.images?.[0] || DEFAULT_OG_IMAGE,
    'url': `${BASE_URL}/product/${product.id}`,
    'offers': {
      '@type': 'Offer',
      '@id': `${BASE_URL}/product/${product.id}#offer`,
      'url': `${BASE_URL}/product/${product.id}`,
      'priceCurrency': 'INR',
      'price': price,
      'priceValidUntil': validUntil.toISOString().split('T')[0],
      'availability': availability,
      'seller': {
        '@type': 'Organization',
        'name': 'NEYOKART',
        'url': BASE_URL
      },
      'shippingDetails': {
        '@type': 'OfferShippingDetails',
        'shippingRate': {
          '@type': 'MonetaryAmount',
          'value': 30,
          'currency': 'INR'
        },
        'freeShippingThreshold': {
          '@type': 'MonetaryAmount',
          'value': 199,
          'currency': 'INR'
        },
        'deliveryTime': {
          '@type': 'ShippingDeliveryTime',
          'businessDays': {
            '@type': 'OpeningHoursSpecification',
            'dayOfWeek': [
              'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
            ]
          },
          'cutOffTime': '23:00',
          'handlingTime': {
            '@type': 'QuantitativeValue',
            'minValue': 0,
            'maxValue': 1,
            'unitCode': 'HUR'
          },
          'transitTime': {
            '@type': 'QuantitativeValue',
            'minValue': 0,
            'maxValue': 1,
            'unitCode': 'HUR'
          }
        },
        'doesNotShip': false,
        'shippingDestination': {
          '@type': 'DefinedRegion',
          'addressCountry': 'IN',
          'addressRegion': 'UP',
          'postalCodePrefix': ['221']
        }
      }
    },
    'aggregateRating': product.rating && product.rating > 0 ? {
      '@type': 'AggregateRating',
      '@id': `${BASE_URL}/product/${product.id}#aggregateRating`,
      'ratingValue': Math.min(5, Math.max(1, product.rating)),
      'reviewCount': product.reviewCount || 0,
      'bestRating': 5,
      'worstRating': 1
    } : undefined,
    'review': product.reviews?.map(r => ({
      '@type': 'Review',
      'author': { '@type': 'Person', 'name': r.userName || 'Verified Buyer' },
      'datePublished': r.createdAt,
      'reviewBody': r.comment,
      'reviewRating': {
        '@type': 'Rating',
        'ratingValue': r.rating,
        'bestRating': 5,
        'worstRating': 1
      }
    })) || undefined,
    'additionalProperty': product.variants?.map(v => ({
      '@type': 'PropertyValue',
      'name': 'Variant',
      'value': v.label,
      'propertyID': v.id
    })) || undefined
  };
}

export function generateBreadcrumbSchema(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const items = [
    {
      '@type': 'ListItem',
      'position': 1,
      'name': 'Home',
      'item': `${BASE_URL}/`
    }
  ];
  
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    let name = decodeURIComponent(segment).replace(/-/g, ' ');
    
    // Clean up known patterns
    name = name
      .replace(/_/g, ' ')
      .replace(/%20/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    
    items.push({
      '@type': 'ListItem',
      'position': index + 2,
      'name': name,
      'item': `${BASE_URL}${currentPath}`
    });
  });
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}${pathname}#breadcrumb`,
    'itemListElement': items
  };
}

export function generateCategorySchema(mainCategory, subCategory, products = []) {
  const mainLabel = CATEGORY_LABELS[mainCategory] || mainCategory;
  const subLabel = subCategory;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${BASE_URL}/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(subCategory)}#collection`,
    'name': `${subLabel} - ${mainLabel} | NEYOKART`,
    'description': `Browse ${subLabel} from ${mainLabel} category. Fresh products from local Varanasi stores. Free delivery above ₹199. 30-min delivery.`,
    'url': `${BASE_URL}/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(subCategory)}`,
    'mainEntity': {
      '@type': 'ItemList',
      '@id': `${BASE_URL}/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(subCategory)}#itemlist`,
      'name': `${subLabel} Products`,
      'description': `Available ${subLabel} products from local stores in Varanasi`,
      'numberOfItems': products.length,
      'itemListElement': products.slice(0, 50).map((product, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        'item': {
          '@type': 'Product',
          '@id': `${BASE_URL}/product/${product.id}#product`,
          'name': product.name,
          'url': `${BASE_URL}/product/${product.id}`,
          'image': product.images?.[0],
          'offers': {
            '@type': 'Offer',
            'price': parseFloat(String(product.price || 0).replace(/[₹,]/g, '')),
            'priceCurrency': 'INR',
            'availability': (product.stock ?? 0) > 0 
              ? 'https://schema.org/InStock' 
              : 'https://schema.org/OutOfStock'
          }
        }
      }))
    },
    'breadcrumb': generateBreadcrumbSchema(`/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(subCategory)}`),
    'publisher': {
      '@id': `${BASE_URL}#localbusiness`
    }
  };
}

export function generateParcelServiceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${BASE_URL}/pickup-drop#service`,
    'name': 'NEYOKART Pickup & Drop Service',
    'description': 'Parcel pickup and drop service in Varanasi. Documents, packages, food, medicines - anything delivered within the city.',
    'provider': {
      '@id': `${BASE_URL}#localbusiness`
    },
    'areaServed': {
      '@type': 'GeoCircle',
      'geoMidpoint': {
        '@type': 'GeoCoordinates',
        'latitude': 25.3176,
        'longitude': 82.9739
      },
      'geoRadius': '10000'
    },
    'serviceType': 'Courier & Delivery Service',
    'availableChannel': {
      '@type': 'ServiceChannel',
      'serviceUrl': `${BASE_URL}/pickup-drop`,
      'servicePhone': '+91-8378842740',
      'availableLanguage': ['English', 'Hindi']
    },
    'offers': {
      '@type': 'Offer',
      'name': 'Parcel Delivery',
      'priceCurrency': 'INR',
      'price': 50,
      'priceSpecification': {
        '@type': 'UnitPriceSpecification',
        'priceCurrency': 'INR',
        'price': 50,
        'billingIncrement': '1'
      }
    },
    'category': 'Delivery Service',
    'hasOfferCatalog': {
      '@type': 'OfferCatalog',
      'name': 'Parcel Categories',
      'itemListElement': [
        { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': 'Documents' } },
        { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': 'Electronics' } },
        { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': 'Food & Beverages' } },
        { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': 'Medicine & Health' } },
        { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': 'Clothing & Accessories' } },
        { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': 'Home & Kitchen' } },
        { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': 'Fragile Items' } }
      ]
    }
  };
}

export function generateLegalPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${BASE_URL}/legal#webpage`,
    'name': 'Legal Information - Terms, Privacy, Shipping & Refunds',
    'description': 'Read NEYOKART terms of service, privacy policy, shipping policy, cancellation & refund policy.',
    'url': `${BASE_URL}/legal`,
    'mainEntity': {
      '@type': 'FAQPage',
      '@id': `${BASE_URL}/legal#faq`,
      'mainEntity': [
        {
          '@type': 'Question',
          'name': 'What are NEYOKART Terms and Conditions?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'By accessing or using our website and mobile application, you agree to be bound by these Terms and Conditions. NEYOKART is a local delivery platform connecting you with neighborhood stores for groceries, custom products, and general parcel delivery services.'
          }
        },
        {
          '@type': 'Question',
          'name': 'What is NEYOKART Privacy Policy?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'We collect basic details such as your name, phone number, and delivery addresses to fulfill your requests. We use your information solely to process orders, provide customer support, and send delivery updates. We do not sell your personal information to third parties.'
          }
        },
        {
          '@type': 'Question',
          'name': 'What is the shipping policy?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'Free delivery on orders above ₹199. Standard delivery fee ₹30. Most orders delivered same day within Varanasi. Delivery within 10km radius of partner stores.'
          }
        },
        {
          '@type': 'Question',
          'name': 'What is the cancellation and refund policy?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'Orders can be cancelled immediately after placing. Prepaid orders refunded in 5-7 business days. COD orders cancelled require no refund. Damaged/missing items must be reported within 24 hours.'
          }
        }
      ]
    },
    'publisher': { '@id': `${BASE_URL}#localbusiness` }
  };
}

export function getRouteSEO(pathname, data = {}) {
  const { product, mainCategory, subCategory } = data;
  
  if (pathname === '/') {
    return {
      ...SEO_DEFAULTS,
      title: 'NEYOKART - Fresh Grocery Delivery in Varanasi | 30 Min Delivery',
      description: 'Order fresh vegetables, fruits, groceries & daily essentials from NEYOKART. Free delivery above ₹199. 30-min delivery in Varanasi. COD & Online payment.',
      canonical: BASE_URL,
      structuredData: null // Already in index.html
    };
  }
  
  if (pathname.startsWith('/product/') && product) {
    return {
      ...SEO_DEFAULTS,
      title: `${product.name} - Buy Online at NEYOKART Varanasi`,
      description: product.description 
        ? `${product.description.substring(0, 155)}...` 
        : `Buy ${product.name} at best price from local Varanasi stores. Fresh delivery in 30 mins. COD & online payment.`,
      canonical: `${BASE_URL}/product/${product.id}`,
      ogImage: product.images?.[0] || DEFAULT_OG_IMAGE,
      structuredData: generateProductSchema(product),
      breadcrumb: generateBreadcrumbSchema(`/product/${product.id}`)
    };
  }
  
  if (pathname.startsWith('/category/') && mainCategory && subCategory) {
    return {
      ...SEO_DEFAULTS,
      title: `${subCategory} - ${mainCategory} | NEYOKART Varanasi`,
      description: `Browse ${subCategory} from ${mainCategory} category. Fresh products from local Varanasi stores. Free delivery above ₹199. 30-min delivery.`,
      canonical: `${BASE_URL}/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(subCategory)}`,
      structuredData: null, // Injected via SEOProvider with products data
      breadcrumb: generateBreadcrumbSchema(`/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(subCategory)}`)
    };
  }
  
  if (pathname === '/legal') {
    return {
      ...SEO_DEFAULTS,
      title: 'Legal Information - Terms, Privacy, Shipping & Refunds | NEYOKART',
      description: 'Read NEYOKART terms of service, privacy policy, shipping policy, cancellation & refund policy. Contact us for support.',
      canonical: `${BASE_URL}/legal`,
      structuredData: generateLegalPageSchema(),
      breadcrumb: generateBreadcrumbSchema('/legal')
    };
  }
  
  if (pathname === '/pickup-drop') {
    return {
      ...SEO_DEFAULTS,
      title: 'Pickup & Drop Service - Parcel Delivery in Varanasi | NEYOKART',
      description: 'Book parcel pickup & drop service in Varanasi. Documents, packages, food delivery. Track your parcel in real-time.',
      canonical: `${BASE_URL}/pickup-drop`,
      structuredData: generateParcelServiceSchema(),
      breadcrumb: generateBreadcrumbSchema('/pickup-drop')
    };
  }
  
  // Default fallback
  return {
    ...SEO_DEFAULTS,
    canonical: `${BASE_URL}${pathname}`,
    breadcrumb: generateBreadcrumbSchema(pathname)
  };
}

export function updateMetaTag(name, content, attribute = 'property') {
  if (typeof document === 'undefined') return;
  
  let el = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function updateCanonical(href) {
  if (typeof document === 'undefined') return;
  
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function injectJSONLD(id, data) {
  if (typeof document === 'undefined' || !data) return;
  
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function removeJSONLD(id) {
  if (typeof document === 'undefined') return;
  
  const script = document.getElementById(id);
  if (script) script.remove();
}