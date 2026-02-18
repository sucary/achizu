import { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';

export const BackendStatus = () => {
    const [status, setStatus] = useState<string>('Checking connection...');

    useEffect(() => {
        let mounted = true;

        const verifyConnection = async () => {
            try {
                const data = await checkHealth();
                if (mounted) {
                    setStatus(data.message);
                }
            } catch {
                if (mounted) {
                    setStatus('Connection failed. Is the backend running?');
                }
            }
        };

        verifyConnection();

        return () => {
            mounted = false;
        };
    }, []);

    const isConnected = status.includes('running') && !status.includes('failed');
    const isChecking = status.includes('Checking');

    return (
        <div 
            className="absolute top-2 left-2 z-[1000] bg-white p-2 rounded-md shadow-md"   
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <div className="text-xs flex items-center gap-2">
                <span 
                    className={`font-bold ${isChecking ? 'text-black' : isConnected ? 'text-cyan-600' : 'text-primary'}`}
                    aria-label={`Connection status: ${status}`}
                >
                    {status}
                </span>
                {status.includes('failed') && (
                    <button
                        onClick={() => window.location.reload()}
                        className="px-2 py-0.5 bg-primary text-white text-xs rounded hover:bg-primary/90"
                        aria-label="Connection failed. Click to reload the page"
                        type="button"
                    >
                        Reload
                    </button>
                )}
            </div>
        </div>
    );
};
