import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, Check } from 'lucide-react';

const PaymentForm = () => {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [transactionDetails, setTransactionDetails] = useState(null);
    const [card, setCard] = useState(null);
    const [stripe, setStripe] = useState(null);

    useEffect(() => {
        const initStripe = async () => {
            const stripeInstance = await loadStripe('pk_test_51QeiWQQL0OOvl0KQAw1j5Zr3nMhjtucDb2a7jYfStu32V1L4P2AwpIDDwBnrDmG1i9WtH9kt3DIA5GZ8XrzRo2jR00l553LfDe');
            const cardElement = stripeInstance.elements().create('card');
            cardElement.mount('#card-element');
            setCard(cardElement);
            setStripe(stripeInstance);
        };

        initStripe();
        return () => card?.destroy();
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { token, error: stripeError } = await stripe.createToken(card);
            if (stripeError) throw new Error(stripeError.message);

            const response = await fetch('http://localhost:8080/api/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stripeToken: token.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Payment failed');
            }

            setSuccess(true);
            setTransactionDetails({
                id: data.transactionId,
                amount: (data.amount / 100).toFixed(2)
            });
            card.clear();

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center space-x-2 mb-6">
                <CreditCard className="h-6 w-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-800">Pay $20.00</h2>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4 border border-red-200">
                    {error}
                </div>
            )}

            {success && transactionDetails && (
                <div className="bg-green-50 text-green-800 p-4 rounded-md mb-4 border border-green-200">
                    <div className="flex items-center space-x-2 mb-2">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">Payment successful!</span>
                    </div>
                    <div className="text-sm">
                        <p>Transaction ID: {transactionDetails.id}</p>
                        <p>Amount: ${transactionDetails.amount}</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className={`space-y-4 ${success ? 'opacity-50' : ''}`}>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Credit or debit card
                    </label>
                    <div
                        id="card-element"
                        className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[36px]"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !stripe || success}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                   flex items-center justify-center"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Processing...
                        </>
                    ) : (
                        'Pay Now'
                    )}
                </button>
            </form>
        </div>
    );
};

export default PaymentForm;