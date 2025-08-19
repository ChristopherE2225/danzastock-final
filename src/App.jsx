import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

// Main application component
export default function App() {
    // State variables for application logic
    const [currentView, setCurrentView] = useState('materials');
    const [items, setItems] = useState({ materials: [], costumes: [] });
    const [editingItem, setEditingItem] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);

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
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : localFirebaseConfig;
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    // useEffect hook to initialize Firebase and set up authentication
    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                const app = initializeApp(firebaseConfig);
                const authInstance = getAuth(app);
                const dbInstance = getFirestore(app);

                setAuth(authInstance);
                setDb(dbInstance);

                // Listen for authentication state changes
                onAuthStateChanged(authInstance, (user) => {
                    if (user) {
                        setUserId(user.uid);
                        console.log("User authenticated with UID:", user.uid);
                    } else {
                        // Sign in with the provided token if available
                        if (initialAuthToken) {
                            signInWithCustomToken(authInstance, initialAuthToken).catch(e => {
                                console.error("Custom token sign-in failed:", e);
                                // Fallback to anonymous sign-in if custom token fails
                                signInAnonymously(authInstance).catch(anonErr => console.error("Anonymous sign-in failed:", anonErr));
                            });
                        } else {
                            // If no token, sign in anonymously
                            signInAnonymously(authInstance).catch(e => console.error("Anonymous sign-in failed:", e));
                        }
                    }
                });
            } catch (e) {
                console.error("Error initializing Firebase:", e);
                showMessage("Error al inicializar la base de datos.", 'error');
            }
        };

        initializeFirebase();
    }, []);

    // useEffect hook to set up Firestore listeners once authenticated
    useEffect(() => {
        if (!db || !userId) return;

        // Function to set up listeners for both collections
        const setupListeners = () => {
            // Materials listener
            const materialsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/materials`);
            const unsubscribeMaterials = onSnapshot(materialsCollectionRef, (querySnapshot) => {
                const materials = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setItems(prevItems => ({ ...prevItems, materials }));
            }, (error) => {
                console.error("Error fetching materials:", error);
                showMessage("Error al cargar materiales.", 'error');
            });

            // Costumes listener
            const costumesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/costumes`);
            const unsubscribeCostumes = onSnapshot(costumesCollectionRef, (querySnapshot) => {
                const costumes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setItems(prevItems => ({ ...prevItems, costumes }));
            }, (error) => {
                console.error("Error fetching costumes:", error);
                showMessage("Error al cargar vestuarios.", 'error');
            });

            // Return cleanup function to unsubscribe from listeners
            return () => {
                unsubscribeMaterials();
                unsubscribeCostumes();
            };
        };

        // Call the setup function and clean up on unmount
        const unsubscribe = setupListeners();
        return () => unsubscribe();
    }, [db, userId, appId]);

    // Function to display temporary messages
    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    // Function to handle form submission
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
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
            const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${currentView}`);
            if (editingItem) {
                await setDoc(doc(collectionRef, editingItem.id), itemData);
                showMessage('Artículo editado correctamente.', 'success');
            } else {
                await addDoc(collectionRef, itemData);
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
        if (!db || !userId) {
            showMessage('Error de conexión con la base de datos.', 'error');
            return;
        }
        try {
            const itemDocRef = doc(db, `artifacts/${appId}/users/${userId}/${currentView}`, id);
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
        document.getElementById('search-input').value = '';
    };

    // Filter items based on search query
    const filteredItems = items[currentView].filter(item =>
        item.name.toLowerCase().includes(document.getElementById('search-input')?.value.toLowerCase() || '')
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
                    <div className="md:col-span-1 bg-white p-6 rounded-3xl shadow-lg h-fit sticky top-4">
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
                            <div className={`${document.getElementById('status')?.value === 'Prestado' ? '' : 'hidden'}`}>
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
                                className="w-full p-3 border border-gray-300 rounded-full shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-400 transition-shadow text-lg"
                                onInput={(e) => { /* State management for search input can be added here if needed */ }}
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
