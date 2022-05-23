import React from 'react';

const FirebaseContext = React.createContext({
    user: undefined,
    userDoc: undefined,
    firestore: undefined,
    setToken: undefined,
    isAuthenticated: undefined,
});
export default FirebaseContext;