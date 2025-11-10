// Override console methods to filter out React hydration warnings BEFORE any imports
const skipErrors = [
    "no wallets added",
    "profile already exists",
    "user cancelled the authrequest",
    "profile not found",
    "session password not available - please reconnect",
    "removeChild",
    "WebAssembly"
];

import { createRoot } from 'react-dom/client'
import './index.css'
import { HashRouter, Route, Routes, useParams } from "react-router";
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import SubspaceLanding from './routes/landing';
import { ConnectionStrategies, useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { useGlobalState } from '@/hooks/use-global-state';
import { useSubspace } from '@/hooks/use-subspace';
import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { PostHogProvider } from 'posthog-js/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import alien from '@/assets/subspace/alien-green.svg';
import { Toaster } from 'sonner';
import { Utils } from "@subspace-protocol/sdk"
import Dev from '@/routes/dev';
import { Subspace } from '@subspace-protocol/sdk';
import App from '@/routes/app/app';
import ServerSettings from '@/routes/app/server-settings';
import AppSettings from '@/routes/app/app-settings';
import Invite from '@/routes/invite';
import { fetchSubspaceProcessId, respawnSubspaceProcess } from './lib/utils';
import { QuickWallet } from 'quick-wallet';
import { createSigner } from '@permaweb/aoconnect';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    showDetails: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode; onError?: (error: Error) => void }, ErrorBoundaryState> {
    constructor(props: { children: ReactNode; onError?: (error: Error) => void }) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Check if this is a hydration error or other React-specific error
        const isHydrationError = error.message.includes("hydration") ||
            error.message.includes("In HTML") ||
            error.message.includes("cannot be a descendant") ||
            error.message.includes("validateDOMNesting");

        // Check if this error should be skipped
        const shouldSkip = skipErrors.some(skipError =>
            error.message.toLowerCase().includes(skipError.toLowerCase())
        );

        if (shouldSkip) {
            // Don't log anything for skipped errors
            return;
        }

        // For hydration errors, we might want to handle them differently
        if (isHydrationError) {
            console.warn('Hydration error caught by Error Boundary:', error.message);
            // You could choose to handle hydration errors differently here
            // For now, we'll treat them like other errors but log them as warnings
        }

        this.setState({
            error,
            errorInfo
        });

        // Log error to console for debugging
        console.error('Error Boundary caught an error:', error, errorInfo);

        // Call the onError callback if provided
        if (this.props.onError) {
            this.props.onError(error);
        }
    }

    // Public method to set errors from outside the component tree
    setError = (error: Error) => {
        this.setState({
            hasError: true,
            error,
            errorInfo: null
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    toggleDetails = () => {
        this.setState(prev => ({ showDetails: !prev.showDetails }));
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
                    {/* Background effects */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(var(--primary)/0.03)_0%,transparent_50%)] pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(var(--primary)/0.03)_0%,transparent_50%)] pointer-events-none" />

                    <Card className="w-full max-w-2xl bg-card border-primary/30 shadow-2xl backdrop-blur-sm relative">
                        {/* Card glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 rounded-xl pointer-events-none" />

                        <div className="relative z-10 p-8 space-y-6">
                            {/* Header */}
                            <div className="text-center space-y-4">
                                <div className="flex items-center justify-center">
                                    <div className="relative">
                                        <div className="flex items-center justify-center w-16 h-16 bg-destructive/20 rounded-full border border-destructive/30">
                                            <img src={alien} alt="alien" className="w-8 h-8 opacity-80 filter" />
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-destructive/80 rounded-full flex items-center justify-center">
                                            <AlertTriangle className="w-3 h-3 text-white" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h1 className="text-2xl font-freecam text-destructive tracking-wide">
                                        SYSTEM MALFUNCTION
                                    </h1>
                                    <p className="text-primary/80 font-ocr text-sm leading-relaxed max-w-lg mx-auto">
                                        The subspace communication array has encountered an unexpected error.
                                        Our alien technicians are standing by to assist with diagnostics.
                                    </p>
                                </div>
                            </div>

                            {/* Error Message */}
                            <div className="p-4 bg-destructive/10 rounded-sm border border-destructive/30">
                                <p className="text-destructive font-ocr text-sm break-words">
                                    <strong>Error:</strong> {this.state.error?.message || 'Unknown error occurred'}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button
                                    onClick={this.handleReload}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-ocr gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    RESTART SYSTEM
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={this.toggleDetails}
                                    className="border-primary/30 text-primary hover:bg-primary/10 font-ocr gap-2"
                                >
                                    {this.state.showDetails ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                    DIAGNOSTIC DATA
                                </Button>
                            </div>

                            {/* Expandable Error Details */}
                            {this.state.showDetails && (
                                <div className="space-y-4 border-t border-primary/20 pt-6">
                                    <h3 className="text-primary font-freecam text-sm tracking-wide">
                                        TECHNICAL ANALYSIS
                                    </h3>

                                    <div className="space-y-3">
                                        {this.state.error && (
                                            <div className="p-3 bg-background border border-primary/20 rounded-sm">
                                                <h4 className="text-xs font-ocr text-primary/80 mb-2">Error Stack:</h4>
                                                <pre className="text-xs font-mono text-primary/70 whitespace-pre-wrap break-words overflow-auto max-h-40 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                                                    {this.state.error.stack}
                                                </pre>
                                            </div>
                                        )}

                                        {this.state.errorInfo && (
                                            <div className="p-3 bg-background border border-primary/20 rounded-sm">
                                                <h4 className="text-xs font-ocr text-primary/80 mb-2">Component Stack:</h4>
                                                <pre className="text-xs font-mono text-primary/70 whitespace-pre-wrap break-words overflow-auto max-h-40 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                                                    {this.state.errorInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3 bg-primary/5 rounded-sm border border-primary/20">
                                        <p className="text-xs text-primary/80 font-ocr leading-relaxed">
                                            <strong className="text-primary">Mission Control:</strong> Please report this error to the development team
                                            with the diagnostic data above for faster resolution.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

// Create a ref to the ErrorBoundary so we can call setError from async code
let errorBoundaryRef: ErrorBoundary | null = null;

// Global error handler for uncaught async errors
const handleAsyncError = (error: Error) => {
    // Check if this error should be skipped
    const shouldSkip = skipErrors.some(skipError =>
        error.message.toLowerCase().includes(skipError.toLowerCase())
    );

    if (shouldSkip) {
        // Don't log anything for skipped errors
        return;
    }

    // Check if this is a hydration error
    const isHydrationError = error.message.includes("hydration") ||
        error.message.includes("In HTML") ||
        error.message.includes("cannot be a descendant") ||
        error.message.includes("validateDOMNesting");

    if (isHydrationError) {
        console.warn('Hydration error caught globally:', error.message);
        // For hydration errors, we might want to handle them differently
        // You could choose to reload the page or show a specific message
        return;
    }

    console.error('Async error caught:', error);
    if (`${error}`.includes("password not available")) {
        // localStorage.removeItem("pocketbase_auth")
        // sessionStorage.removeItem("wauth_encrypted_password")
        // sessionStorage.removeItem("wauth_session_key")
    }

    if (errorBoundaryRef) {
        errorBoundaryRef.setError(error);
    }
};

// Set up global error handlers for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason || 'Unhandled promise rejection';

    // Check if this error should be skipped
    const shouldSkip = skipErrors.some(skipError =>
        errorMessage.toLowerCase().includes(skipError.toLowerCase())
    );

    if (shouldSkip) {
        // Don't log anything for skipped errors
        event.preventDefault();
        return;
    }

    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevent the default browser error handling
    handleAsyncError(new Error(errorMessage));
});



// Set up global error handler for uncaught errors
window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);

    // Check if this error should be skipped
    const shouldSkip = skipErrors.some(skipError =>
        error.message.toLowerCase().includes(skipError.toLowerCase())
    );

    if (shouldSkip) {
        // Don't log anything for skipped errors
        return;
    }

    console.error('Uncaught error:', error);
    handleAsyncError(error);
});

// Component to render the themed toaster inside the theme provider
function ThemedToaster() {
    const { theme } = useTheme();

    return (
        <Toaster
            theme={theme === "system" ? undefined : theme as "light" | "dark"}
            // richColors
            style={{
                "--normal-bg": "var(--background)",
                "--normal-text": "var(--foreground)",
                "--normal-border": "var(--border)",
            } as React.CSSProperties}
        />
    );
}

function Main() {
    const { actions: subspaceActions } = useSubspace()
    const { jwk, address, connected, connectionStrategy, provider, actions: walletActions } = useWallet()
    const { actions: globalStateActions, subspaceFailed } = useGlobalState()
    const [errorBoundary, setErrorBoundary] = useState<ErrorBoundary | null>(null);
    const [appReady, setAppReady] = useState(false);
    const [previousAddress, setPreviousAddress] = useState<string | undefined>(undefined);

    // Set the global error boundary reference
    useEffect(() => {
        errorBoundaryRef = errorBoundary;
        return () => {
            errorBoundaryRef = null;
        };
    }, [errorBoundary]);

    const handleConnection = async function () {
        if (!connectionStrategy) return

        try {
            // For WAuth strategy, wait for initialization to complete first
            if (connectionStrategy === ConnectionStrategies.WAuth) {
                await walletActions.connect({ strategy: connectionStrategy, provider })

                // await walletActions.waitForWAuthInit();

                // // Additional check: ensure WAuth session is fully restored
                // const { wauthInstance } = useWallet.getState();
                // if (wauthInstance && wauthInstance.isLoggedIn()) {
                //     // Quick check: if no session data exists, skip the waiting
                //     if (!wauthInstance.hasSessionStorageData()) {
                //         console.log("[Main] No session data found, will prompt for password immediately");
                //         return; // Skip additional validation, go straight to connection
                //     }

                //     // Wait for session password loading to complete (but not too long)
                //     let waitTime = 0;
                //     const maxWait = 1000; // Max 1 second wait
                //     while (wauthInstance.isSessionPasswordLoading() && waitTime < maxWait) {
                //         await new Promise(resolve => setTimeout(resolve, 50));
                //         waitTime += 50;
                //     }

                //     // Quick verification if session loading completed
                //     if (!wauthInstance.isSessionPasswordLoading()) {
                //         try {
                //             const wallet = await wauthInstance.getWallet(false); // Don't show modal
                //             if (!wallet) {
                //                 console.log("[Main] Session restoration incomplete, will need password");
                //             }
                //         } catch (error) {
                //             console.log("[Main] Session validation failed:", error.message);
                //         }
                //     } else {
                //         console.log("[Main] Session loading taking too long, proceeding with connection");
                //     }
                // }
            }

            if (connectionStrategy === ConnectionStrategies.ScannedJWK) {
                await walletActions.connect({ strategy: connectionStrategy, jwk })
            } else if (connectionStrategy === ConnectionStrategies.WAuth) {
                await walletActions.connect({ strategy: connectionStrategy, provider })
            }
            else {
                await walletActions.connect({ strategy: connectionStrategy })
            }
        } catch (error) {
            console.error("Connection failed:", error)
            handleAsyncError(error as Error)
        }
    }

    useEffect(() => {
        // Initialize authentication state first
        walletActions.initializeAuthState();

        // For WAuth, check if we can reduce the delay based on session availability
        let initDelay = 100;
        if (connectionStrategy === ConnectionStrategies.WAuth) {
            const { wauthInstance } = useWallet.getState();
            if (wauthInstance && wauthInstance.isLoggedIn()) {
                // If no session data exists, we can start immediately
                if (!(wauthInstance as any).hasSessionStorageData()) {
                    initDelay = 50; // Minimal delay for immediate password prompt
                } else {
                    initDelay = 300; // Reduced delay when session data exists
                }
            } else {
                initDelay = 100; // Standard delay for fresh login
            }
        }

        setTimeout(() => {
            handleConnection().catch((error) => {
                console.error("Connection effect failed:", error);
                handleAsyncError(error);
            });
        }, initDelay);
    }, [])

    // Set up wallet disconnection listener
    useEffect(() => {
        const handleWalletDisconnected = () => {
            console.log("🔌 Wallet disconnected")
            globalStateActions.clear()
        }

        window.addEventListener("subspace-wallet-disconnected", handleWalletDisconnected)

        return () => {
            window.removeEventListener("subspace-wallet-disconnected", handleWalletDisconnected)
        }
    }, [])

    // Refresh page when wallet address changes from one address to another
    useEffect(() => {
        // If both previous and current address exist and are different, refresh
        if (previousAddress && address && previousAddress !== address) {
            console.log("🔄 Wallet address changed, refreshing page...")
            window.location.reload()
        }

        // Update the previous address whenever address changes
        if (address) {
            setPreviousAddress(address)
        }
    }, [address])

    useEffect(() => {
        async function init() {
            const signer = await walletActions.getSigner()
            const latestSubspaceProcess = await fetchSubspaceProcessId()
            console.log("🔍 Latest Subspace Process:", latestSubspaceProcess)
            try {
                // Wait for Subspace initialization to complete
                await Subspace.init({ address, signer, PROCESS: latestSubspaceProcess?.trim() || undefined })

                // Only proceed with operations after initialization is confirmed
                if (Subspace.initialized) {
                    globalStateActions.setSubspaceFailed(false)
                    const profile = await subspaceActions.profiles.get(address)
                    if (!profile) {
                        await subspaceActions.profiles.create({
                            bio: "Alien Tech"
                        })
                    }
                } else {
                    globalStateActions.setSubspaceFailed(true)
                }
            } catch (error) {
                globalStateActions.setSubspaceFailed(true)
                try {
                    await Subspace.getSources()
                } catch {
                    const newProcess = await respawnSubspaceProcess()
                    console.log("🔍 New Subspace Process:", newProcess)
                    await Subspace.init({ PROCESS: newProcess?.trim() || undefined })
                }
                handleAsyncError(error as Error)
            }
        }
        if (connected && address) {
            init()
        } else if (!connected && !address) {
            // Clear state when wallet becomes disconnected
            Subspace.clear()
            globalStateActions.clear()
        }
    }, [connected, address])

    // Complete page loading when app is ready
    useEffect(() => {
        // Check if app is ready (connected and subspace initialized or failed)
        const isReady = connected && (address || subspaceFailed !== null);

        if (isReady && !appReady) {
            setAppReady(true);
            // Small delay to ensure UI is rendered
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.completePageLoading) {
                    window.completePageLoading();
                }
            }, 500);
        }
    }, [connected, address, subspaceFailed, appReady]);

    // Also complete loading after a reasonable timeout even if not fully ready
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!appReady && typeof window !== 'undefined' && window.completePageLoading) {
                setAppReady(true);
                window.completePageLoading();
            }
        }, 5000); // 5 second timeout

        return () => clearTimeout(timeout);
    }, [appReady]);

    return (
        <ErrorBoundary
            ref={setErrorBoundary}
            onError={handleAsyncError}
        >
            <div className={`absolute left-1/2 -translate-x-1/2 z-50 max-w-md w-fit transition-all duration-500 ease-out ${subspaceFailed ? 'top-10 opacity-100 translate-y-0' : '-top-20 opacity-0 -translate-y-4'
                }`}>
                <div className='bg-destructive/10 border border-destructive/20 rounded-lg p-4 shadow-lg backdrop-blur-sm'>
                    <div className='flex items-center gap-3'>
                        <div className='flex-shrink-0'>
                            <AlertTriangle className='h-5 w-5 text-destructive' />
                        </div>
                        <div className='flex-1'>
                            <h3 className='text-sm font-medium text-destructive'>Connection Failed</h3>
                            <p className='text-xs text-muted-foreground mt-1'>Unable to connect to Subspace process, please try again later</p>
                            <p className='text-xs text-muted-foreground mt-1'>If problem persists, check network tab and report to the developers</p>
                        </div>
                    </div>
                </div>
            </div>
            <ThemeProvider defaultTheme="dark">
                <ThemedToaster />
                <HashRouter>
                    <Routes>
                        <Route path="/" element={<SubspaceLanding />} />
                        <Route path="/app" element={<App />} />
                        <Route path="/app/dm/:friendId" element={<App />} />
                        <Route path="/app/:serverId" element={<App />} />
                        <Route path="/app/:serverId/:channelId" element={<App />} />

                        <Route path="/invite/:inviteCode" element={<Invite />} />
                        <Route path="/app/settings" element={<AppSettings />} />
                        <Route path="/app/:serverId/settings" element={<ServerSettings />} />

                        {/* <Route path="/developer" element={<Developer />} /> */}
                        {/* <Route path="/developer/bots" element={<Bots />} /> */}
                        {/* <Route path="/developer/bots/:botId" element={<BotSettings />} /> */}
                        {/* <Route path="/addbot/:botId" element={<AddBot />} /> */}

                        <Route path="/dev" element={<Dev />} />
                    </Routes>
                </HashRouter>
            </ThemeProvider>
        </ErrorBoundary>
    )
}

createRoot(document.getElementById('root')!).render(
    <>{import.meta.env.MODE === "development" ? <Main /> : <PostHogProvider
        apiKey="phc_SqWBgq3YjrOdX1UmcMh3OtYlxoSfjA5cqJbq0IGrCz1"
        options={{
            api_host: "https://eu.i.posthog.com",
            defaults: '2025-05-24',
            capture_exceptions: true,
            debug: import.meta.env.MODE === "development",
        }}
    >
        <Main />
    </PostHogProvider>}</>
)