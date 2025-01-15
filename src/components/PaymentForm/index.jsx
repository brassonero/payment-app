import React, {useState, useEffect} from 'react';
import {CreditCard, Check, MessageCircle} from 'lucide-react';
import {loadStripe} from '@stripe/stripe-js';

const PackageCard = ({pkg, selected, onSelect}) => (
    <div
        onClick={() => onSelect(pkg)}
        className={`p-6 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
            selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500' : 'border-gray-200 hover:border-blue-300'
        }`}
    >
        <h3 className="text-lg font-semibold text-gray-800">{pkg.packageName}</h3>
        <div className="mt-4 space-y-3">
            <div className="flex items-center text-gray-600">
                <MessageCircle className="h-5 w-5 mr-2"/>
                <span>{pkg.conversations.toLocaleString()} Conversations</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
                ${pkg.cost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </p>
        </div>
    </div>
);

const SuccessMessage = ({transactionDetails}) => (
    <div className="bg-green-50 text-green-800 p-4 rounded-md mb-4 border border-green-200">
        <div className="flex items-center space-x-2 mb-2">
            <Check className="h-5 w-5"/>
            <span className="font-medium">Payment successful!</span>
        </div>
        <div className="text-sm">
            <p>Transaction ID: {transactionDetails.id}</p>
            <p>Amount: ${transactionDetails.amount}</p>
        </div>
    </div>
);

const LoadingSpinner = () => (
    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
        <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
        />
        <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
    </svg>
);

const PaymentForm = () => {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [transactionDetails, setTransactionDetails] = useState(null);
    const [card, setCard] = useState(null);
    const [stripe, setStripe] = useState(null);
    const [packages, setPackages] = useState([]);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [loadingPackages, setLoadingPackages] = useState(true);

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const response = await fetch('http://localhost:8080/v1/packages/catalog');
                if (!response.ok) throw new Error('Failed to fetch packages');
                const data = await response.json();
                setPackages(data);
            } catch (err) {
                setError('Failed to load packages. Please refresh the page.');
                console.error('Error fetching packages:', err);
            } finally {
                setLoadingPackages(false);
            }
        };

        fetchPackages();
    }, []);

    useEffect(() => {
        const initStripe = async () => {
            if (!selectedPackage) return;

            try {
                const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
                if (!publishableKey) {
                    throw new Error('Stripe publishable key is not configured.');
                }

                const stripeInstance = await loadStripe(publishableKey);
                if (!stripeInstance) throw new Error('Failed to initialize Stripe');

                const elements = stripeInstance.elements();
                const cardElement = elements.create('card', {
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#32325d',
                            fontFamily: 'Arial, sans-serif',
                            '::placeholder': {
                                color: '#aab7c4'
                            }
                        },
                        invalid: {
                            color: '#fa755a',
                            iconColor: '#fa755a'
                        }
                    }
                });

                cardElement.mount('#card-element');
                setCard(cardElement);
                setStripe(stripeInstance);
                setError(null);
            } catch (err) {
                console.error('Stripe initialization error:', err);
                setError('Failed to load payment system. Please try again later.');
            }
        };

        initStripe();

        return () => {
            if (card) {
                card.destroy();
                setCard(null);
            }
        };
    }, [selectedPackage]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!stripe || !card || !selectedPackage) return;

        setLoading(true);
        setError(null);

        try {
            const {token, error: stripeError} = await stripe.createToken(card);
            if (stripeError) throw new Error(stripeError.message);

            const response = await fetch('http://localhost:8080/api/payments', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    stripeToken: token.id,
                    amount: Math.round(selectedPackage.cost * 100)
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Payment failed');

            setSuccess(true);
            setTransactionDetails({
                id: data.transactionId,
                amount: selectedPackage.cost.toFixed(2)
            });
            card.clear();
            setSelectedPackage(null);

        } catch (err) {
            console.error('Payment error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loadingPackages) {
        return (
            <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
                <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner/>
                    <span>Loading packages...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center space-x-2 mb-6">
                <CreditCard className="h-6 w-6 text-gray-600"/>
                <h2 className="text-xl font-semibold text-gray-800">Select Package</h2>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4 border border-red-200">
                    {error}
                </div>
            )}

            {success && transactionDetails && (
                <SuccessMessage transactionDetails={transactionDetails}/>
            )}

            <form onSubmit={handleSubmit} className={`space-y-4 ${success ? 'opacity-50' : ''}`}>
                <div className="grid gap-4">
                    {packages.map((pkg) => (
                        <PackageCard
                            key={pkg.packageName}
                            pkg={pkg}
                            selected={selectedPackage?.packageName === pkg.packageName}
                            onSelect={setSelectedPackage}
                        />
                    ))}
                </div>

                {selectedPackage && (
                    <div className="mt-6 space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Credit or debit card
                        </label>
                        <div
                            id="card-element"
                            className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                )}

                {selectedPackage && (
                    <button
                        type="submit"
                        disabled={loading || !stripe || success}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center justify-center"
                    >
                        {loading ? (
                            <>
                                <LoadingSpinner/>
                                Processing...
                            </>
                        ) : (
                            `Pay $${selectedPackage.cost.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}`
                        )}
                    </button>
                )}
            </form>
        </div>
    );
};

export default PaymentForm;
