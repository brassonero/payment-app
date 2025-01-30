import React, { useState, useEffect } from 'react';
import { CreditCard, Check, MessageCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

// Document validation utilities
const isValidCPF = (cpf) => {
    cpf = cpf.replace(/[^\d]/g, '');

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
        sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;

    return true;
};

const isValidCNPJ = (cnpj) => {
    cnpj = cnpj.replace(/[^\d]/g, '');

    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
        return false;
    }

    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    let digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += numbers.charAt(size - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += numbers.charAt(size - i) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    return parseInt(digits.charAt(1)) === result;
};

const validateDocument = (doc, type) => {
    const cleanDoc = doc.replace(/[^\d]/g, '');
    if (type === 'cpf') {
        return isValidCPF(cleanDoc);
    }
    return isValidCNPJ(cleanDoc);
};

const formatDocument = (value, type) => {
    const numbers = value.replace(/\D/g, '');
    if (type === 'cpf') {
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const PackageCard = ({ pkg, selected, onSelect }) => (
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
                <span>{pkg.conversations.toLocaleString()} Conversações</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
                R${pkg.cost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </p>
        </div>
    </div>
);

const SuccessMessage = ({ transactionDetails }) => (
    <div className="bg-green-50 text-green-800 p-4 rounded-md mb-4 border border-green-200">
        <div className="flex items-center space-x-2 mb-2">
            <Check className="h-5 w-5"/>
            <span className="font-medium">Pagamento realizado com sucesso!</span>
        </div>
        <div className="text-sm">
            <p>ID da Transação: {transactionDetails.id}</p>
            <p>Valor: R${transactionDetails.amount}</p>
        </div>
    </div>
);

const LoadingSpinner = () => (
    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
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
    const [cardholderName, setCardholderName] = useState('');
    const [document, setDocument] = useState('');
    const [documentType, setDocumentType] = useState('cpf');

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const response = await fetch('https://management-dev.broadcasterbot.com/paymentsApi/packages/catalog');
                if (!response.ok) throw new Error('Falha ao carregar pacotes');
                const data = await response.json();
                setPackages(data);
            } catch (err) {
                setError('Falha ao carregar pacotes. Por favor, atualize a página.');
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
                    throw new Error('Chave do Stripe não configurada.');
                }

                const stripeInstance = await loadStripe(publishableKey);
                if (!stripeInstance) throw new Error('Falha ao inicializar Stripe');

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
                setError('Falha ao carregar sistema de pagamento. Tente novamente mais tarde.');
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

    const handleDocumentChange = (e) => {
        const formattedValue = formatDocument(e.target.value, documentType);
        setDocument(formattedValue);
    };

    const validateForm = () => {
        if (!cardholderName.trim()) {
            setError('Nome do titular do cartão é obrigatório');
            return false;
        }

        if (!validateDocument(document, documentType)) {
            setError(`${documentType.toUpperCase()} inválido`);
            return false;
        }

        return true;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!stripe || !card || !selectedPackage) return;

        if (!validateForm()) return;

        setLoading(true);
        setError(null);

        try {
            const { paymentMethod, error: paymentMethodError } = await stripe.createPaymentMethod({
                type: 'card',
                card: card,
                billing_details: {
                    name: cardholderName,
                    address: {
                        country: 'BR',
                    }
                }
            });

            if (paymentMethodError) {
                throw new Error(paymentMethodError.message);
            }

            const metadata = {
                tax_id_type: documentType.toUpperCase(),
                tax_id: document.replace(/\D/g, ''),
                document_type: documentType.toUpperCase()
            };

            const response = await fetch('http://localhost:8080/paymentsApi/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    paymentMethodId: paymentMethod.id,
                    amount: Math.round(selectedPackage.cost * 100),
                    document: document.replace(/\D/g, ''),
                    documentType: documentType,
                    cardholderName,
                    metadata
                })
            });

            const data = await response.json();
            if (!response.ok) {
                const errorMessage = data.message || 'Falha no pagamento';
                throw new Error(errorMessage);
            }

            if (data.status === 'requires_action') {
                const { error: confirmationError } = await stripe.confirmCardPayment(data.client_secret);
                if (confirmationError) {
                    throw new Error(confirmationError.message);
                }
            }

            setSuccess(true);
            setTransactionDetails({
                id: data.transactionId,
                amount: selectedPackage.cost.toFixed(2)
            });

            // Clear form
            card.clear();
            setSelectedPackage(null);
            setCardholderName('');
            setDocument('');

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
                    <span>Carregando pacotes...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center space-x-2 mb-6">
                <CreditCard className="h-6 w-6 text-gray-600"/>
                <h2 className="text-xl font-semibold text-gray-800">Selecione o Pacote</h2>
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
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de Documento
                            </label>
                            <div className="flex space-x-4">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="cpf"
                                        checked={documentType === 'cpf'}
                                        onChange={(e) => {
                                            setDocumentType(e.target.value);
                                            setDocument('');
                                        }}
                                        className="mr-2"
                                    />
                                    CPF
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="cnpj"
                                        checked={documentType === 'cnpj'}
                                        onChange={(e) => {
                                            setDocumentType(e.target.value);
                                            setDocument('');
                                        }}
                                        className="mr-2"
                                    />
                                    CNPJ
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {documentType.toUpperCase()}
                            </label>
                            <input
                                type="text"
                                value={document}
                                onChange={handleDocumentChange}
                                placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                maxLength={documentType === 'cpf' ? 14 : 18}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome do Titular do Cartão
                            </label>
                            <input
                                type="text"
                                value={cardholderName}
                                onChange={(e) => setCardholderName(e.target.value)}
                                placeholder="Nome como está no cartão"
                                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dados do Cartão
                            </label>
                            <div
                                id="card-element"
                                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
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
                                Processando...
                            </>
                        ) : (
                            `Pagar R${selectedPackage.cost.toLocaleString(undefined, {
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