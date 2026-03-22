import { useNavigate } from 'react-router-dom';

const sections = [
  {
    id: 'terms',
    title: '1. Terms and Conditions',
    content: [
      {
        heading: 'Welcome to NEYOKART.',
        body: 'By accessing or using our website and mobile application, you agree to be bound by these Terms and Conditions.',
      },
      {
        heading: 'About Us',
        body: 'NEYOKART is a local delivery platform connecting you with neighborhood stores for groceries, custom products, and general parcel delivery services.',
      },
      {
        heading: 'Your Account',
        body: 'To use our services, you must register using a valid mobile number. You are responsible for all activities that occur under your account. Please ensure your contact details and delivery addresses are accurate.',
      },
      {
        heading: 'Pricing and Availability',
        body: 'All product prices and availability are determined by the respective local stores and are subject to change. If an item becomes unavailable after you place an order, we will notify you and adjust your bill or issue a refund accordingly.',
      },
      {
        heading: 'Parcel Delivery Rules',
        body: 'If you use our parcel pickup and drop service, you strictly agree not to send any illegal, hazardous, fragile, or restricted items. NEYOKART and our delivery partners reserve the right to refuse any package.',
      },
    ],
  },
  {
    id: 'privacy',
    title: '2. Privacy Policy',
    content: [
      {
        heading: 'Your privacy is important to us.',
        body: 'This policy explains how we handle your personal information.',
      },
      {
        heading: 'Information We Collect',
        body: 'When you create an account or place an order, we collect basic details such as your name, phone number, and delivery addresses to fulfill your requests.',
      },
      {
        heading: 'How We Use Your Data',
        body: 'We use your information solely to process your orders, provide customer support, and send you important updates regarding your delivery status.',
      },
      {
        heading: 'Payment Security',
        body: 'We do not store your credit card, debit card, or bank account details on our servers. All online transactions are processed through secure, globally recognized and encrypted payment gateways.',
      },
      {
        heading: 'Data Sharing',
        body: 'We only share your necessary delivery details (like your name, address, and phone number) with the specific store processing your order and the delivery executive assigned to bring it to your door. We do not sell your personal information to third parties.',
      },
    ],
  },
  {
    id: 'shipping',
    title: '3. Shipping and Delivery Policy',
    content: [
      {
        heading: 'Fast and reliable delivery right to your doorstep.',
        body: '',
      },
      {
        heading: 'Delivery Areas',
        body: 'We currently operate within specific local service areas. You will be notified at checkout if your address falls within our active delivery zones.',
      },
      {
        heading: 'Delivery Charges',
        body: 'A flat delivery charge of ₹40 applies to standard orders. Enjoy Free Delivery on all orders with a total value of ₹500 or more.',
      },
      {
        heading: 'Delivery Timeframes',
        body: 'Because we partner with stores in your neighborhood, most everyday orders are delivered rapidly on the same day. Custom orders (like personalized prints) or scheduled parcel pickups will be completed according to the timelines provided at checkout.',
      },
    ],
  },
  {
    id: 'refunds',
    title: '4. Cancellation and Refunds',
    content: [
      {
        heading: 'We want you to have a hassle-free shopping experience.',
        body: '',
      },
      {
        heading: 'Order Cancellations',
        body: 'You can cancel your order immediately after placing it through the app. However, once the store has started packing your items or the delivery executive has been dispatched, the order cannot be cancelled.',
      },
      {
        heading: 'Parcel Cancellations',
        body: 'Parcel pickup bookings can be cancelled any time before a delivery executive has been assigned to pick up the package.',
      },
      {
        heading: 'Refund Process',
        body: 'If you successfully cancel a prepaid order, or if an item is out of stock, we will initiate a refund immediately. Please allow 5–7 business days for the refunded amount to reflect in your original bank account or payment method. For Cash on Delivery (COD) orders that are cancelled, no refund processing is required.',
      },
      {
        heading: 'Damaged or Missing Items',
        body: 'If you receive a damaged item or something is missing from your delivery, please contact our support team within 24 hours for a quick resolution or refund.',
      },
    ],
  },
  {
    id: 'contact',
    title: '5. Contact Us',
    content: [
      {
        heading: 'We are always here to help!',
        body: 'If you have any questions, concerns, or need assistance with a recent order, please reach out to us.',
      },
    ],
    contact: {
      email: 'neyokart@gmail.com',
      phone: '+91-8378842740  +91-8808660084. +91-9651339273',
      address: ['NEYOKART', '[O, RAMCHANDIPUR, OLD SHIV MANDIR, RAMCHANDIPUR, JALHUPUR]', 'Varanasi, Uttar Pradesh, 221104', 'India'],
      hours: 'Monday to Sunday, 8:00 AM – 6:00 PM',
    },
  },
];

const LegalPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Legal Information</h1>
            <p className="text-xs text-gray-500">NEYOKART</p>
          </div>
        </div>

        {/* In-page anchor nav */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-3 overflow-x-auto no-scrollbar text-xs">
          {sections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap px-3 py-1 rounded-full bg-gray-100 hover:bg-ud-primary hover:text-white transition-colors text-gray-600 font-medium"
            >
              {s.title.replace(/^\d+\.\s/, '')}
            </a>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        <p className="text-xs text-gray-400 -mt-4">Last updated: March 2026</p>

        {sections.map(section => (
          <section key={section.id} id={section.id} className="scroll-mt-28">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              {section.title}
            </h2>

            <div className="space-y-4">
              {section.content.map((item, i) => (
                <div key={i}>
                  {item.heading && (
                    <p className="font-semibold text-gray-800 text-sm mb-1">
                      {item.heading}
                    </p>
                  )}
                  {item.body && (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.body}
                    </p>
                  )}
                </div>
              ))}

              {/* Contact details block */}
              {section.contact && (
                <div className="mt-4 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 text-ud-primary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email</p>
                      <a href={`mailto:${section.contact.email}`} className="text-sm font-medium text-ud-primary">
                        {section.contact.email}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 text-ud-primary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Phone</p>
                      <a href={`tel:${section.contact.phone}`} className="text-sm font-medium text-ud-primary">
                        {section.contact.phone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 text-ud-primary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Address</p>
                      {section.contact.address.map((line, i) => (
                        <p key={i} className="text-sm text-gray-700">{line}</p>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 text-ud-primary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Support Hours</p>
                      <p className="text-sm text-gray-700">{section.contact.hours}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}

        <div className="pt-4 pb-8 text-center text-xs text-gray-400">
          © 2026 NEYOKART. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
