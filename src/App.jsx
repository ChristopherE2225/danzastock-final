import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';

// Main application component
export default function App() {
    // State variables for application logic
    const [currentView, setCurrentView] = useState('materials');
    const [items, setItems] = useState({ materials: [], costumes: [] });
    const [editingItem, setEditingItem] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [db, setDb] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Debugging block: Firebase config for local testing
    // If you are not using Canvas, you can paste your Firebase config here.
    const localFirebaseConfig = {
        apiKey: "AIzaSyALk8eY3cyM0yfIWCvHKTouos0bK0eIMMo",
        authDomain: "danzastock-app.firebaseapp.com",
        projectId: "danzastock-app",
        storageBucket: "danzastock-app.firebasestorage.app",
        messagingSenderId: "34990121437",
        appId: "1:34990121437:web:ec80cb15b63294db645634",
        measurementId: "G-8NWQSRN9VD"
    };

    // Firebase-related variables from the environment (provided by the Canvas platform)
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : localFirebaseConfig;

    // useEffect hook to initialize Firebase and set up the database
    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                const app = initializeApp(firebaseConfig);
                const dbInstance = getFirestore(app);
                setDb(dbInstance);

                console.log("Firebase inicializado y conectado a Firestore.");
            } catch (e) {
                console.error("Error al inicializar Firebase:", e);
                showMessage("Error al inicializar la base de datos.", 'error');
            }
        };

        initializeFirebase();
    }, []);

    // useEffect hook to set up Firestore listener
    useEffect(() => {
        if (!db) return;

        // The collection path now points to a single collection accessible by all
        const collectionRef = collection(db, 'danzastock_inventario');
        
        // Listen for real-time updates to the single collection
        const unsubscribe = onSnapshot(collectionRef, (querySnapshot) => {
            // Process the single list of documents to separate into materials and costumes
            // based on the existence of a 'quantity' field.
            const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const materials = allItems.filter(item => item.quantity !== undefined);
            const costumes = allItems.filter(item => item.quantity === undefined);
            
            setItems({ materials, costumes });
            
        }, (error) => {
            console.error("Error fetching documents:", error);
            showMessage("Error al cargar los datos.", 'error');
        });

        // Return cleanup function to unsubscribe from listener
        return () => unsubscribe();
    }, [db]);

    // Function to display temporary messages
    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    // Function to handle form submission
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!db) {
            showMessage('Error de conexión con la base de datos.', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const itemData = {
            name: formData.get('name'),
            status: formData.get('status'),
            loanedTo: formData.get('loanedTo') || '',
        };

        if (currentView === 'materials') {
            itemData.quantity = parseInt(formData.get('quantity'), 10);
        }

        try {
            // All operations now use the 'danzastock_inventario' collection
            const inventoryCollectionRef = collection(db, 'danzastock_inventario');
            if (editingItem) {
                await setDoc(doc(inventoryCollectionRef, editingItem.id), itemData);
                showMessage('Artículo editado correctamente.', 'success');
            } else {
                await addDoc(inventoryCollectionRef, itemData);
                showMessage('Artículo agregado correctamente.', 'success');
            }
        } catch (error) {
            console.error("Error adding/editing document: ", error);
            showMessage('Error al guardar el artículo.', 'error');
        }

        // Reset form and editing state
        e.target.reset();
        setEditingItem(null);
    };

    // Function to handle edit button click
    const handleEdit = (item) => {
        setEditingItem(item);
    };

    // Function to handle delete button click
    const handleDelete = async (id) => {
        if (!db) {
            showMessage('Error de conexión con la base de datos.', 'error');
            return;
        }
        try {
            // The path for deleting items also uses 'danzastock_inventario'
            const itemDocRef = doc(db, 'danzastock_inventario', id);
            await deleteDoc(itemDocRef);
            showMessage('Artículo eliminado correctamente.', 'success');
        } catch (e) {
            console.error("Error deleting document: ", e);
            showMessage('Error al eliminar el artículo.', 'error');
        }
    };

    // Function to handle view change
    const handleViewChange = (view) => {
        setCurrentView(view);
        setEditingItem(null);
        // Clear search input on view change
        setSearchQuery('');
    };

    // Filter items based on search query
    const filteredItems = items[currentView].filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="bg-gray-100 min-h-screen p-4 md:p-8 text-gray-800 font-inter">
            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out;
                }
                body {
                    font-family: 'Inter', sans-serif;
                }
                .h-fit {
                    height: fit-content;
                }
                .sticky {
                    position: sticky;
                    top: 2rem;
                }
                `}
            </style>
            <div className="container mx-auto">
                <header className="bg-white p-6 rounded-3xl shadow-lg mb-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-blue-900 mb-2 drop-shadow-md">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-600">Danzastock</span>
                    </h1>
                    <p className="text-xl text-gray-500">Gestión de Inventario de Danza</p>
                    <div className="mt-4 flex flex-wrap justify-center space-x-2 md:space-x-4">
                        <button
                            id="materials-btn"
                            className={`view-btn py-2 px-6 rounded-full font-bold transition-colors duration-300 text-lg shadow-lg transform hover:scale-105 ${currentView === 'materials' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-indigo-200'}`}
                            onClick={() => handleViewChange('materials')}
                        >
                            Materiales
                        </button>
                        <button
                            id="costumes-btn"
                            className={`view-btn py-2 px-6 rounded-full font-bold transition-colors duration-300 text-lg shadow-lg transform hover:scale-105 ${currentView === 'costumes' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-indigo-200'}`}
                            onClick={() => handleViewChange('costumes')}
                        >
                            Vestuarios
                        </button>
                    </div>
                </header>

                <main className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 bg-white p-6 rounded-3xl shadow-lg h-fit sticky">
                        <h2 id="form-title" className="text-3xl font-bold text-gray-800 mb-4 text-center">
                            {editingItem ? `Editar ${currentView === 'materials' ? 'Material' : 'Vestuario'}` : `Añadir ${currentView === 'materials' ? 'Material' : 'Vestuario'}`}
                        </h2>
                        <form id="item-form" onSubmit={handleFormSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-gray-700 font-semibold mb-1">Nombre</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    placeholder="Nombre del artículo"
                                    required
                                    defaultValue={editingItem?.name || ''}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
                                />
                            </div>
                            {currentView === 'materials' && (
                                <div id="quantity-field">
                                    <label htmlFor="quantity" className="block text-gray-700 font-semibold mb-1">Cantidad</label>
                                    <input
                                        type="number"
                                        id="quantity"
                                        name="quantity"
                                        placeholder="Cantidad de piezas"
                                        required
                                        defaultValue={editingItem?.quantity || ''}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
                                    />
                                </div>
                            )}
                            <div>
                                <label htmlFor="status" className="block text-gray-700 font-semibold mb-1">Estado</label>
                                <select
                                    id="status"
                                    name="status"
                                    defaultValue={editingItem?.status || 'Almacén'}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
                                >
                                    <option value="Almacén">Almacén</option>
                                    <option value="Prestado">Prestado</option>
                                    <option value="Reparación" disabled={currentView === 'costumes'}>Reparación</option>
                                    <option value="Perdido">Perdido</option>
                                </select>
                            </div>
                            <div className={`${(editingItem?.status === 'Prestado' || (document.getElementById('status')?.value === 'Prestado' && !editingItem)) ? '' : 'hidden'}`}>
                                <label htmlFor="loanedTo" className="block text-gray-700 font-semibold mb-1">Prestado a</label>
                                <input
                                    type="text"
                                    id="loanedTo"
                                    name="loanedTo"
                                    placeholder="Nombre de la persona"
                                    defaultValue={editingItem?.loanedTo || ''}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl text-lg shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:ring-opacity-75"
                            >
                                {editingItem ? 'Guardar Cambios' : 'Añadir a Inventario'}
                            </button>
                        </form>
                        {editingItem && (
                            <button
                                id="cancel-btn"
                                onClick={() => setEditingItem(null)}
                                className="mt-2 w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 rounded-xl text-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        <div className="mb-6">
                            <input
                                type="text"
                                id="search-input"
                                placeholder={`Buscar ${currentView === 'materials' ? 'materiales' : 'vestuarios'}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-full shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow text-lg"
                            />
                        </div>
                        {message.text && (
                            <div className={`p-4 mb-4 rounded-xl shadow-lg text-center font-bold animate-fadeIn ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {message.text}
                            </div>
                        )}
                        <div id="item-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {items[currentView].length === 0 ? (
                                <p className="col-span-full text-center text-gray-500 text-lg">
                                    Cargando...
                                </p>
                            ) : filteredItems.length === 0 ? (
                                <p className="col-span-full text-center text-gray-500 text-lg">
                                    No se encontraron {currentView}. ¡Intenta agregar uno!
                                </p>
                            ) : (
                                filteredItems.map(item => (
                                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-lg border-2 border-slate-200 hover:shadow-xl transition-shadow duration-300 transform hover:scale-105">
                                        <h3 className="font-bold text-lg text-indigo-800 break-words">{item.name}</h3>
                                        {currentView === 'materials' && <p className="text-gray-600">Cantidad: {item.quantity}</p>}
                                        <p className="text-gray-600">
                                            Estado: <span className={`font-semibold ${item.status === 'Almacén' ? 'text-green-600' : item.status === 'Prestado' ? 'text-orange-600' : item.status === 'Reparación' ? 'text-yellow-600' : 'text-red-600'}`}>{item.status}</span>
                                        </p>
                                        {item.status === 'Prestado' && <p className="text-gray-600">Prestado a: <span className="font-semibold text-blue-600">{item.loanedTo}</span></p>}
                                        <div className="mt-4 flex justify-end space-x-2">
                                            <button
                                                className="edit-btn bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75"
                                                onClick={() => handleEdit(item)}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="delete-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}