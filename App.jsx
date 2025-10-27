import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, FlaskConical, X, Info, Plus, Upload, Download, Trash2, Edit2, Scan, Loader, AlertTriangle } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'gitDrugReferenceDataV2';
// NOTE: API Key must be kept empty; the execution environment provides it.
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";

// --- INITIAL DRUG DATA (Fallback if local storage is empty) ---
const INITIAL_DRUGS = [
  // ANTIACID
  { code: '01.01.01', name: 'Aluminium/Magnesium Hydroxide', form: 'Tablets', remarks: 'Also used in some vaccines. Used to control phosphate in kidney failure.', category: 'Antacid' },
  { code: '01.01.02', name: 'Aluminium/Magnesium Hydroxide', form: 'Suspension', remarks: '180ml/bottle. Used to control phosphate in kidney failure.', category: 'Antacid' },

  // ANTISPASMODIC
  { code: '01.02.01', name: 'Hyoscine Butylbromide', form: 'Tablets', remarks: '10mg/tab. Prevents cramps & Blurred vision. Peripheral anticholinergic.', category: 'Antispasmodic' },
  { code: '01.02.02', name: 'Hyoscine Butylbromide', form: 'Suppository', remarks: '10mg/supp', category: 'Antispasmodic' },
  { code: '01.02.04', name: 'Mebeverine Hcl', form: 'Tablets', remarks: '135-200mg. Take 20 min before meals. GIT spasms.', category: 'Antispasmodic' },

  // MOTILITY STIMULANTS
  { code: '01.03.01', name: 'Cisapride', form: 'Tablets', remarks: '10mg/tab. Long QT Syndrome Risk (Withdraw). 5HT4 agonist.', category: 'Motility Stimulant' },
  { code: '01.03.02', name: 'Cisapride', form: 'Suspension', remarks: '5mg/5ml bottle', category: 'Motility Stimulant' },

  // ULCER - HEALING DRUGS
  { code: '01.04.02', name: 'Ranitidine, Famotidine, or Nizatidine (H2 Antagonist)', form: 'Tablets', remarks: '150mg/20mg/150mg/tab. Inhibits stomach acid production & secretion.', category: 'Ulcer Healing' },
  { code: '01.04.05', name: 'Sucralfate (Chelate)', form: 'Tablets', remarks: '1g/tab. GIVE 1HR BEFORE MEALS. Bed Time meal.', category: 'Ulcer Healing' },
  { code: '01.04.06', name: 'Omeprazole or Lansoprazole (PPI)', form: 'Capsule', remarks: '20mg or 30mg/cap. Give before meals.', category: 'Ulcer Healing' },
  { code: '01.04.07', name: 'Omeprazole/Pantoprazole Sodium (PPI)', form: 'Injection', remarks: '40mg vial. Reglinpine/Nateglinide 120mg/tab.', category: 'Ulcer Healing' },
];

// Helper to convert file to Base64
const base64EncodeFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // Get the base64 part
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};


// --- DRUG ANALYSIS MODAL COMPONENT ---
const DrugAnalysisModal = ({ drug, onClose }) => {
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const handleDrugAnalysis = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const apiKey = "AIzaSyDnEXbl4H664dLyY6SXlRH4IFwHX0EdVew" // Runtime injection
            const userQuery = `For the drug ${drug.name}, provide details on its Black Box Warning, major drug-drug interactions to watch out for, and critical contraindications (excluding common ones like hypersensitivity).`;
            
            const systemPrompt = "You are a highly specialized pharmaceutical expert and data extraction agent. Provide an analysis for the specified drug, focusing only on critical safety information: black box warnings, major drug-drug interactions, and critical patient contraindications (like specific diseases or patient groups). Exclude general warnings or common contraindications (like hypersensitivity). The output MUST be a structured JSON object. Do not include any text outside the JSON block. If a warning category is not applicable, use an empty array or 'N/A' as appropriate.";

            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }], // Use search grounding for up-to-date data
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            "blackBoxWarning": { "type": "STRING", "description": "The black box warning text, or 'N/A' if none." },
                            "majorInteractions": { "type": "ARRAY", "items": { "type": "STRING" }, "description": "List of major, serious drug-drug interactions." },
                            "criticalContraindications": { "type": "ARRAY", "items": { "type": "STRING" }, "description": "List of critical patient contraindications (e.g., specific heart condition, severe liver failure)." }
                        },
                        propertyOrdering: ["blackBoxWarning", "majorInteractions", "criticalContraindications"]
                    }
                }
            };

            const maxRetries = 3;
            let responseJson;

            for (let i = 0; i < maxRetries; i++) {
                try {
                    const response = await fetch(API_URL + apiKey, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    responseJson = await response.json();
                    break;
                } catch (err) {
                    console.warn(`Analysis attempt ${i + 1} failed. Retrying...`, err);
                    if (i === maxRetries - 1) throw err;
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }

            const resultText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resultText) throw new Error("API returned an empty response.");

            const parsedResult = JSON.parse(resultText);
            setAnalysisResult(parsedResult);

        } catch (err) {
            console.error("Analysis Error:", err);
            setError("Could not retrieve analysis. Please try again or check the console for details.");
        } finally {
            setIsLoading(false);
        }
    }, [drug]);

    useEffect(() => {
        handleDrugAnalysis();
    }, [handleDrugAnalysis]);

    return (
        <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative text-gray-800 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-blue-600 mb-4 border-b pb-2">
                    Safety Analysis: {drug.name}
                </h2>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full">
                    <X className="w-5 h-5" />
                </button>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10">
                        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="mt-4 text-gray-600">Checking current drug safety information...</p>
                    </div>
                ) : error ? (
                    <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                        <p className="font-semibold">Analysis Failed:</p>
                        <p>{error}</p>
                    </div>
                ) : analysisResult ? (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center">
                                <AlertTriangle className='w-5 h-5 mr-2'/> Black Box Warning
                            </h3>
                            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                <p className="text-sm italic font-medium">{analysisResult.blackBoxWarning || 'N/A: No Black Box Warning found.'}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-yellow-700 mb-2">
                                Important Drug Interactions
                            </h3>
                            {Array.isArray(analysisResult.majorInteractions) && analysisResult.majorInteractions.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                                    {analysisResult.majorInteractions.map((item, index) => (
                                        <li key={index} className="text-gray-700">{item}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No specific major interactions highlighted.</p>
                            )}
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-purple-700 mb-2">
                                Critical Contraindications
                            </h3>
                            {Array.isArray(analysisResult.criticalContraindications) && analysisResult.criticalContraindications.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                                    {analysisResult.criticalContraindications.map((item, index) => (
                                        <li key={index} className="text-gray-700">{item}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No specific critical contraindications found.</p>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};


// Inline Component for Adding/Editing Drugs
const DrugForm = ({ drugToEdit, onSave, onClose }) => {
    const [formData, setFormData] = useState(drugToEdit || { code: '', name: '', form: '', remarks: '', category: '' });
    const isEdit = !!drugToEdit;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const categories = ['Antacid', 'Antispasmodic', 'Motility Stimulant', 'Ulcer Healing', 'Antidiarrheal', 'Other'];

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{isEdit ? 'Edit Drug Entry' : 'Add New Drug'}</h2>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full">
                    <X className="w-5 h-5" />
                </button>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        name="code"
                        placeholder="Code Number (e.g., 01.99.01)"
                        value={formData.code}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        disabled={isEdit} // Code should not be editable after creation
                    />
                    <input
                        type="text"
                        name="name"
                        placeholder="Generic Name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                        <option value="" disabled>Select Category</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <input
                        type="text"
                        name="form"
                        placeholder="Dosage Form (e.g., Tablets, Suspension)"
                        value={formData.form}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <textarea
                        name="remarks"
                        placeholder="Remarks / Key Instructions"
                        value={formData.remarks}
                        onChange={handleChange}
                        rows="3"
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <button
                        type="submit"
                        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200"
                    >
                        {isEdit ? 'Update Drug' : 'Add Drug'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// Helper component for category buttons
const CategoryButton = ({ category, currentFilter, setFilter }) => {
    const isActive = category === currentFilter;
    return (
        <button
            onClick={() => setFilter(category)}
            className={`
                px-4 py-2 text-sm font-medium transition-all duration-200 rounded-full shadow-md
                ${isActive
                    ? 'bg-blue-600 text-white shadow-blue-400/50 scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }
            `}
        >
            {category}
        </button>
    );
};

// Main App Component
const App = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedDrug, setSelectedDrug] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentEditDrug, setCurrentEditDrug] = useState(null);
    const [message, setMessage] = useState(null); // For user feedback
    const [isOCRLoading, setIsOCRLoading] = useState(false);
    const [confirmDeleteCode, setConfirmDeleteCode] = useState(null);
    const [analysisDrug, setAnalysisDrug] = useState(null); // New state for safety analysis modal

    // --- State and Local Storage Synchronization ---
    const [drugs, setDrugs] = useState(() => {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            return storedData ? JSON.parse(storedData) : INITIAL_DRUGS;
        } catch (e) {
            console.error("Could not load from localStorage:", e);
            return INITIAL_DRUGS;
        }
    });

    // Effect to save state to local storage whenever 'drugs' changes
    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(drugs));
        } catch (e) {
            console.error("Could not save to localStorage:", e);
        }
        // Recalculate categories dynamically when drugs change
        setCategories(
            ['All', ...new Set(drugs.map(d => d.category))]
        );
    }, [drugs]);

    const [categories, setCategories] = useState(
        ['All', ...new Set(drugs.map(d => d.category))]
    );
    // --- End Local Storage Setup ---

    // --- CRUD Operations ---
    const handleSave = useCallback((drugData) => {
        setDrugs(prevDrugs => {
            const index = prevDrugs.findIndex(d => d.code === drugData.code);
            if (index !== -1) {
                // Update existing drug
                setMessage(`Drug ${drugData.code} updated successfully.`);
                return prevDrugs.map((d, i) => i === index ? drugData : d);
            } else {
                // Add new drug
                if (prevDrugs.some(d => d.code === drugData.code)) {
                    setMessage('Error: Drug code already exists.');
                    return prevDrugs;
                }
                setMessage(`Drug ${drugData.code} added successfully.`);
                return [...prevDrugs, drugData];
            }
        });
        setSelectedDrug(null);
    }, []);

    const handleDelete = useCallback((code) => {
        setDrugs(prevDrugs => {
            setMessage(`Drug ${code} deleted.`);
            return prevDrugs.filter(d => d.code !== code);
        });
        setSelectedDrug(null);
        setConfirmDeleteCode(null);
    }, []);

    // --- CSV Export (JSON Import removed) ---
    const handleExport = () => {
        const headers = ['Code', 'Generic Name', 'Form', 'Remarks', 'Category'];
        const rows = drugs.map(d => [
            `"${d.code.replace(/"/g, '""')}"`,
            `"${d.name.replace(/"/g, '""')}"`,
            `"${d.form.replace(/"/g, '""')}"`,
            `"${d.remarks.replace(/"/g, '""')}"`,
            `"${d.category.replace(/"/g, '""')}"`,
        ].join(','));

        const csvContent = [
            headers.join(','),
            ...rows
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `git_drug_reference_export_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage('Data exported successfully as CSV!');
    };

    // --- OCR Logic ---
    const handleOCRUpload = async (event) => {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            setMessage('Please select a valid image file (PNG, JPG, etc.).');
            return;
        }

        setIsOCRLoading(true);
        setMessage('Analyzing image and running OCR...');

        try {
            const base64Data = await base64EncodeFile(file);
            const apiKey = "AIzaSyDnEXbl4H664dLyY6SXlRH4IFwHX0EdVew"

            const systemPrompt = "You are a data extraction specialist. Analyze the attached image, which is a handwritten and typed list of drugs, codes, forms, and remarks. Convert this information into a structured JSON array. Each object in the array must contain the following keys: 'code' (string, e.g., 01.01.01), 'name' (string, Generic Name), 'form' (string, Dosage Form, e.g., Tablets), 'remarks' (string, all handwritten and typed notes), and 'category' (string, infer the major category like Antacid, Antispasmodic, etc. Must be one of: Antacid, Antispasmodic, Motility Stimulant, Ulcer Healing, Antidiarrheal, or Other). Do not include any text outside the JSON block.";

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: "Extract the data from this scanned document into the specified JSON format." },
                            {
                                inlineData: {
                                    mimeType: file.type,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "code": { "type": "STRING" },
                                "name": { "type": "STRING" },
                                "form": { "type": "STRING" },
                                "remarks": { "type": "STRING" },
                                "category": { "type": "STRING" }
                            },
                            propertyOrdering: ["code", "name", "form", "remarks", "category"]
                        }
                    }
                }
            };

            const maxRetries = 3;
            let responseJson;

            for (let i = 0; i < maxRetries; i++) {
                try {
                    const response = await fetch(API_URL + apiKey, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    responseJson = await response.json();
                    break;
                } catch (error) {
                    console.warn(`Attempt ${i + 1} failed. Retrying...`, error);
                    if (i === maxRetries - 1) throw error;
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }

            const resultText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!resultText) {
                setMessage('OCR extraction failed. Could not parse model response.');
                return;
            }

            const importedData = JSON.parse(resultText);

            if (Array.isArray(importedData)) {
                let newDrugs = 0;
                let updatedDrugs = 0;

                const newDrugsList = importedData.reduce((acc, drug) => {
                    if (drug.code && drug.name && drug.form) {
                        const existingIndex = acc.findIndex(d => d.code === drug.code);
                        if (existingIndex !== -1) {
                            // Update existing drug
                            acc[existingIndex] = drug;
                            updatedDrugs++;
                        } else {
                            // Add new drug
                            acc.push(drug);
                            newDrugs++;
                        }
                    }
                    return acc;
                }, [...drugs]);

                setDrugs(newDrugsList);
                setMessage(`OCR successful! Added ${newDrugs} new drugs and updated ${updatedDrugs} existing entries.`);
                setSelectedDrug(null);
            } else {
                setMessage('OCR failed: Model did not return a valid JSON array structure.');
            }

        } catch (error) {
            setMessage('OCR failed. Please ensure the image is clear and try again.');
            console.error('OCR Process Error:', error);
        } finally {
            setIsOCRLoading(false);
        }
    };
    // --- End OCR Logic ---

    // --- Filtering Logic ---
    const filteredDrugs = useMemo(() => {
        let currentDrugs = drugs;

        if (selectedCategory !== 'All') {
            currentDrugs = currentDrugs.filter(drug => drug.category === selectedCategory);
        }

        if (searchTerm.trim()) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            currentDrugs = currentDrugs.filter(drug =>
                drug.name.toLowerCase().includes(lowerSearchTerm) ||
                drug.code.toLowerCase().includes(lowerSearchTerm) ||
                drug.remarks.toLowerCase().includes(lowerSearchTerm)
            );
        }

        return currentDrugs.sort((a, b) => a.code.localeCompare(b.code));
    }, [selectedCategory, searchTerm, drugs]);

    // Handles row click to show details
    const handleDrugSelect = (drug) => {
        setSelectedDrug(drug.code === selectedDrug?.code ? null : drug);
        setCurrentEditDrug(null);
        setConfirmDeleteCode(null); // Clear confirmation state
        setAnalysisDrug(null); // Close analysis if open
    };

    const handleOpenEdit = (drug) => {
        setCurrentEditDrug(drug);
        setIsFormOpen(true);
    };

    const handleOpenAdd = () => {
        setCurrentEditDrug(null);
        setSelectedDrug(null);
        setAnalysisDrug(null);
        setIsFormOpen(true);
    }

    // Temporary component to show and hide messages
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <style>
                {/* Custom styling for scrollbar in filter */}
                {`.scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}
                {/* Custom animation for messages */}
                {`@keyframes fadeInOut {
                    0% { opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { opacity: 0; }
                }
                .animate-fadeInOut { animation: fadeInOut 5s ease-in-out forwards; }`}
            </style>

            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center">
                        <FlaskConical className="w-8 h-8 mr-3 text-blue-600" />
                        Interactive GIT Drug Reference (Local Data)
                    </h1>
                    <p className="mt-2 text-lg text-gray-500">
                        Searchable reference with local data persistence, CSV export, and **Gemini Safety Analysis**. Total Drugs: {drugs.length}
                    </p>
                </header>

                {/* Control Panel (Search and Import/Export) */}
                <div className="mb-6 space-y-4">
                    {/* Search Bar */}
                    <div className="shadow-xl rounded-xl bg-white p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, code, or instruction..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setSelectedDrug(null);
                                }}
                                className="w-full py-3 pl-10 pr-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800 rounded-full"
                                    aria-label="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Export/OCR Buttons (JSON Import removed) */}
                    <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                        <button
                            onClick={handleExport}
                            className="flex items-center px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition"
                        >
                            <Download className="w-4 h-4 mr-2" /> Export Data (CSV)
                        </button>

                        {/* OCR Scan Button */}
                        <label className={`flex items-center px-4 py-2 text-white font-semibold rounded-lg shadow-md transition cursor-pointer ${isOCRLoading ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'}`}>
                            {isOCRLoading ? (
                                <>
                                    <Loader className="w-4 h-4 mr-2 animate-spin" /> Analyzing Image...
                                </>
                            ) : (
                                <>
                                    <Scan className="w-4 h-4 mr-2" /> OCR Scan New Page
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleOCRUpload}
                                className="hidden"
                                disabled={isOCRLoading}
                                onClick={(e) => e.target.value = null} // Allows selecting the same file again
                            />
                        </label>
                    </div>
                </div>

                {/* Category Filters */}
                <div className="mb-8 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
                    <div className="flex space-x-3">
                        {categories.map(category => (
                            <CategoryButton
                                key={category}
                                category={category}
                                currentFilter={selectedCategory}
                                setFilter={(cat) => {
                                    setSelectedCategory(cat);
                                    setSelectedDrug(null);
                                    setConfirmDeleteCode(null);
                                    setAnalysisDrug(null);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Drug List Table */}
                <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-3/6">Generic Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">Form</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredDrugs.length > 0 ? (
                                    filteredDrugs.map((drug) => (
                                        <tr
                                            key={drug.code}
                                            onClick={() => handleDrugSelect(drug)}
                                            className={`
                                                cursor-pointer transition-all duration-150 hover:bg-blue-50
                                                ${selectedDrug?.code === drug.code ? 'bg-blue-100 shadow-inner' : ''}
                                            `}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{drug.code}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-800">{drug.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{drug.form}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="text-center py-8 text-gray-500 text-base">
                                            No drugs found matching your criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Selected Drug Details / Interactive PANEL (Modal) */}
                {selectedDrug && (
                    // Backdrop: Closes modal when clicked outside the inner content
                    <div
                        className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
                        onClick={() => setSelectedDrug(null)}
                    >
                        <div
                            className="bg-blue-700 text-white p-6 rounded-xl shadow-2xl w-full max-w-xl transition-transform duration-300 transform scale-100"
                            // Crucial: Stop propagation so clicks inside the panel don't close the modal
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xl font-bold flex items-center">
                                    <Info className="w-5 h-5 mr-2" />
                                    Details for {selectedDrug.name}
                                </h3>
                                <div className="flex space-x-2 items-center">
                                    <button
                                        onClick={() => setAnalysisDrug(selectedDrug)}
                                        className="flex items-center px-3 py-1 bg-yellow-500 text-blue-900 font-semibold rounded-lg shadow-md hover:bg-yellow-400 transition text-sm"
                                        title="Analyze Drug Safety"
                                    >
                                        <AlertTriangle className='w-4 h-4 mr-1'/> Analyze Safety
                                    </button>
                                    
                                    {confirmDeleteCode === selectedDrug.code ? (
                                        <>
                                            <span className="text-red-200 text-sm font-medium">Confirm Delete?</span>
                                            <button
                                                onClick={() => handleDelete(selectedDrug.code)}
                                                className="px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition text-sm font-medium"
                                                aria-label="Confirm delete"
                                                title="Confirm Delete"
                                            >
                                                Yes
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteCode(null)}
                                                className="px-3 py-1 rounded-lg text-blue-200 hover:bg-blue-600 transition text-sm font-medium"
                                                aria-label="Cancel delete"
                                                title="Cancel Delete"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleOpenEdit(selectedDrug)}
                                                className="p-2 rounded-full text-blue-200 hover:bg-blue-600 transition"
                                                aria-label="Edit drug"
                                                title="Edit Drug"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteCode(selectedDrug.code)}
                                                className="p-2 rounded-full text-red-300 hover:bg-red-700 transition"
                                                aria-label="Delete drug"
                                                title="Delete Drug"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setSelectedDrug(null)}
                                        className="p-2 rounded-full text-blue-200 hover:bg-blue-800 transition ml-2"
                                        aria-label="Close details"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="border-t border-blue-600 pt-4 space-y-2 text-blue-100">
                                <p className="text-sm">
                                    <span className="font-semibold text-white">Code:</span> {selectedDrug.code}
                                </p>
                                <p className="text-sm">
                                    <span className="font-semibold text-white">Category:</span> {selectedDrug.category}
                                </p>
                                <p className="text-sm">
                                    <span className="font-semibold text-white">Dosage Form:</span> {selectedDrug.form}
                                </p>
                                <div className="mt-4 p-4 bg-blue-800 rounded-lg max-h-48 overflow-y-auto">
                                    <p className="font-semibold text-white mb-2 text-lg">Key Instructions / Remarks (Pop-up):</p>
                                    <p className="text-base leading-relaxed">{selectedDrug.remarks}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* User Feedback Message */}
                {message && (
                    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-lg shadow-xl z-50 transition-opacity duration-300 animate-fadeInOut">
                        {message}
                    </div>
                )}
            </div>

            {/* Floating Add Button */}
            <button
                onClick={handleOpenAdd}
                className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition duration-300 transform hover:scale-105 z-40"
                title="Add New Drug"
            >
                <Plus className="w-6 h-6" />
            </button>

            {/* Drug Add/Edit Modal */}
            {isFormOpen && (
                <DrugForm
                    drugToEdit={currentEditDrug}
                    onSave={handleSave}
                    onClose={() => { setIsFormOpen(false); setCurrentEditDrug(null); }}
                />
            )}

            {/* Drug Analysis Modal */}
            {analysisDrug && (
                <DrugAnalysisModal
                    drug={analysisDrug}
                    onClose={() => setAnalysisDrug(null)}
                />
            )}
        </div>
    );
};

export default App;
