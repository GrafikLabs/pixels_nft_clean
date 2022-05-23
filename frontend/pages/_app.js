import Web3Provider from '../components/Web3Provider'
import AppContextProvider from '../components/AppContextProvider';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.css'
import FirebaseProvider from '../components/FirebaseProvider';

function MyApp({ Component, pageProps }) {
    return <>
        <FirebaseProvider>
            <Web3Provider>
                <AppContextProvider {...pageProps}>
                    <Component {...pageProps} />
                </AppContextProvider>
            </Web3Provider>
        </FirebaseProvider>
    </>;
}

export default MyApp
