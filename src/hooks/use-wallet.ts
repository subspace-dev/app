import { create } from "zustand";
import "arweave"
import { WanderConnect } from "@wanderapp/connect";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/web/lib/wallet";
import { createJSONStorage, persist } from "zustand/middleware";
import { WAuth, WAuthProviders } from "@wauth/sdk";
import { createSigner } from "@permaweb/aoconnect";
import { QuickWallet } from "quick-wallet";

export enum ConnectionStrategies {
    ArWallet = "ar_wallet",
    WanderConnect = "wander_connect",
    ScannedJWK = "scanned_jwk",
    GuestUser = "guest_user",
    WAuth = "wauth",
    // UploadedJWK = "uploaded_jwk" // TODO: add later
}

const requiredWalletPermissions: string[] = ["SIGN_TRANSACTION", "ACCESS_ADDRESS", "ACCESS_PUBLIC_KEY", "ACCESS_ALL_ADDRESSES", "SIGNATURE"]

interface WalletState {
    address: string;
    originalAddress: string;
    connected: boolean;
    connectionStrategy: ConnectionStrategies | null;
    provider: WAuthProviders | null; // only exists if connectionStrategy is WAuth
    wanderInstance: WanderConnect | null // only exists if connectionStrategy is WanderConnect
    wauthInstance: WAuth | null // only exists if connectionStrategy is WAuth
    jwk?: JWKInterface // only exists if connectionStrategy is ScannedJWK
    actions: WalletActions
}

interface WalletActions {
    setWanderInstance: (instance: WanderConnect | null) => void
    updateAddress: (address: string) => void
    connect: ({ strategy, jwk, provider }: { strategy: ConnectionStrategies, jwk?: JWKInterface, provider?: WAuthProviders }) => Promise<void>
    disconnect: () => void
    getSigner: () => Promise<any | null>
    waitForWAuthInit: () => Promise<void>
    initializeAuthState: () => void
}

function triggerAuthenticatedEvent(address: string) {
    window.dispatchEvent(new CustomEvent("subspace-authenticated", { detail: { address } }))
}

// Helper function to wait for WAuth initialization
async function waitForWAuthInitialization(wauthInstance: WAuth): Promise<void> {
    // If already initialized (has sessionPassword or not logged in), return immediately
    if ((wauthInstance as any).sessionPassword !== null || !wauthInstance.isLoggedIn()) {
        return;
    }

    // Wait up to 3 seconds for initialization to complete
    const maxWaitTime = 3000;
    const checkInterval = 100;
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
        // Check if initialization is complete
        if ((wauthInstance as any).sessionPassword !== null || !wauthInstance.isLoggedIn()) {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
    }

    console.warn("WAuth initialization timeout - proceeding anyway");
}

export const useWallet = create<WalletState>()(persist((set, get) => ({
    // state
    address: "",
    originalAddress: "",
    connected: false,
    connectionStrategy: null,
    provider: null,
    wanderInstance: null,
    wauthInstance: new WAuth({ dev: false }),
    jwk: undefined,



    actions: {
        setWanderInstance: (instance: WanderConnect | null) => set({ wanderInstance: instance }),
        updateAddress: (address: string) => set((state) => ({ address, originalAddress: state.address })),

        waitForWAuthInit: async () => {
            const state = get();
            if (state.wauthInstance) {
                await waitForWAuthInitialization(state.wauthInstance);
            }
        },

        initializeAuthState: () => {
            const state = get();
            if (state.connected && state.connectionStrategy === ConnectionStrategies.WAuth && state.wauthInstance) {
                // Check if WAuth is actually logged in
                if (!state.wauthInstance.isLoggedIn()) {
                    console.log("[useWallet] WAuth authentication state lost, disconnecting");
                    // Clear the persisted state since authentication is lost
                    set({
                        address: "",
                        connected: false,
                        connectionStrategy: null,
                        provider: null,
                        jwk: undefined,
                    });
                } else {
                    console.log("[useWallet] WAuth PocketBase authentication valid, checking session...");

                    // Don't try to get wallet immediately - let the connection flow handle it
                    // This prevents race conditions with session password loading

                    // Only validate if session loading is not in progress
                    if (!state.wauthInstance.isSessionPasswordLoading()) {
                        // Check if we have session data available
                        if (!(state.wauthInstance as any).hasSessionStorageData()) {
                            console.log("[useWallet] No session storage data found, will need fresh login");
                            // Don't clear state yet - let the connection attempt handle this
                            return;
                        }

                        // Try to get the wallet without showing modal to test session validity
                        state.wauthInstance.getWallet(false).then(wallet => {
                            if (wallet && wallet.address !== state.address) {
                                console.log("[useWallet] Updating address from restored wallet:", wallet.address);
                                set({ address: wallet.address });
                            } else if (!wallet) {
                                console.log("[useWallet] Session incomplete but PocketBase auth valid, will reconnect");
                            }
                        }).catch(error => {
                            console.log("[useWallet] Session validation failed:", error.message);
                            // Don't clear state for session-related errors - let connection flow handle it
                            if (error.message.includes("User record not available") ||
                                error.message.includes("not logged in")) {
                                // Only clear for serious auth failures
                                set({
                                    address: "",
                                    connected: false,
                                    connectionStrategy: null,
                                    provider: null,
                                    jwk: undefined
                                });
                            }
                        });
                    } else {
                        console.log("[useWallet] Session password still loading, will validate after connection");
                    }
                }
            }
        },

        getSigner: async () => {
            const connectionStrategy = get().connectionStrategy;
            if (!connectionStrategy) return null

            switch (connectionStrategy) {
                case ConnectionStrategies.ArWallet:
                case ConnectionStrategies.WanderConnect:
                    return createSigner(window.arweaveWallet) as any
                case ConnectionStrategies.ScannedJWK:
                    {
                        const jwk = get().jwk;
                        if (!jwk) {
                            throw new Error("ScannedJWK connection strategy requires a JWK, but none was found");
                        }
                        return createSigner(jwk) as any;
                    }
                case ConnectionStrategies.WAuth:
                    {
                        const wauthInstance = get().wauthInstance;
                        if (!wauthInstance) {
                            throw new Error("WAuth instance not found");
                        }

                        // Ensure user is logged in
                        if (!wauthInstance.isLoggedIn()) {
                            // If not logged in but we think we should be, clear the state
                            const state = get();
                            if (state.connected && state.connectionStrategy === ConnectionStrategies.WAuth) {
                                console.log("[getSigner] WAuth authentication lost, clearing state");
                                set({
                                    address: "",
                                    connected: false,
                                    connectionStrategy: null,
                                    provider: null,
                                    jwk: undefined
                                });
                            }
                            throw new Error("Not logged in to WAuth");
                        }

                        // Wait for session password loading to complete
                        while (wauthInstance.isSessionPasswordLoading()) {
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }

                        // Try to get the signer, but handle wallet loading gracefully
                        try {
                            return wauthInstance.getAoSigner() as any;
                        } catch (error) {
                            const errorMessage = `${error}`;

                            if (errorMessage.includes("No wallet found") ||
                                errorMessage.includes("session password not available")) {
                                // Try to get wallet first (this might prompt for password)
                                try {
                                    console.log("[getSigner] Wallet not available, attempting to load...");
                                    const wallet = await wauthInstance.getWallet(true);
                                    if (wallet) {
                                        return wauthInstance.getAoSigner() as any;
                                    } else {
                                        throw new Error("Could not load wallet after authentication");
                                    }
                                } catch (walletError) {
                                    const walletErrorMessage = `${walletError}`;
                                    if (walletErrorMessage.includes("cancelled") ||
                                        walletErrorMessage.includes("Password required")) {
                                        // User cancelled - this is not a permanent error
                                        throw new Error("Authentication cancelled by user");
                                    } else {
                                        console.error("[getSigner] Failed to load WAuth wallet:", walletError);
                                        throw new Error("WAuth wallet not available. Please try logging in again.");
                                    }
                                }
                            }

                            // Re-throw other errors as they might be temporary
                            throw error;
                        }
                    }
                case ConnectionStrategies.GuestUser:
                    {
                        return createSigner(QuickWallet)

                    }
                default:
                    throw new Error(`Connection Strategy ${get().connectionStrategy} does not have a signer implemented yet`)
            }
        },
        connect: async ({ strategy, jwk, provider }: { strategy: ConnectionStrategies, jwk?: JWKInterface, provider?: WAuthProviders }) => {

            // const state = get();
            // state.actions.disconnect();

            switch (strategy) {
                case ConnectionStrategies.ScannedJWK:
                    {
                        if (!jwk) throw new Error(`Connection Strategy ${strategy} requires a JWK to be passed to the connect function`)
                        const requiredKeys = ["kty", "e", "n", "d", "p", "q", "dp", "dq", "qi"];
                        const allKeysPresent = requiredKeys.every(key => jwk[key]);
                        if (!allKeysPresent) throw new Error("Missing required values in JWK");

                        const ar = new Arweave({});
                        const addr = await ar.wallets.getAddress(jwk);
                        if (!addr) throw new Error("Failed to get address");

                        set((state) => {
                            if (state.connected && state.connectionStrategy !== ConnectionStrategies.ScannedJWK) state.actions.disconnect();
                            return {
                                address: addr,
                                connected: true,
                                connectionStrategy: ConnectionStrategies.ScannedJWK,
                                wanderInstance: null,
                                jwk: jwk,
                                provider: null,
                            }
                        })
                        triggerAuthenticatedEvent(addr)
                        break;
                    }
                case ConnectionStrategies.WAuth: {
                    if (!provider) throw new Error("Connection Strategy: WAuth requires a provider to be passed to the connect function")

                    let state = get();
                    if (state.connected && state.connectionStrategy !== ConnectionStrategies.WAuth) state.actions.disconnect();

                    // Check if we have a WAuth instance that's already logged in
                    if (state.wauthInstance && state.wauthInstance.isLoggedIn()) {

                        // Quick check: if no session data, skip waiting and show password modal immediately
                        if (!state.wauthInstance.hasSessionStorageData()) {
                            try {
                                const wallet = await state.wauthInstance.getWallet(true);
                                if (wallet) {
                                    set((state) => {
                                        return {
                                            address: wallet.address,
                                            connected: true,
                                            connectionStrategy: ConnectionStrategies.WAuth,
                                            wanderInstance: null,
                                            wauthInstance: state.wauthInstance,
                                            jwk: null,
                                            provider: provider,

                                        }
                                    })
                                    triggerAuthenticatedEvent(wallet.address)
                                    return
                                }
                            } catch (error) {
                                if (error.message.includes("cancelled") || error.message.includes("Password required")) {
                                    throw error; // User cancelled
                                }
                            }
                        } else {
                            // Session data exists, try to restore it
                            // Wait for WAuth initialization to complete before trying to get wallet
                            await waitForWAuthInitialization(state.wauthInstance);

                            try {
                                // First try without showing modal to see if session is complete
                                let wallet = await state.wauthInstance.getWallet(false);

                                if (!wallet) {
                                    // Session incomplete but PocketBase auth is valid
                                    // Now try with modal to get the password
                                    wallet = await state.wauthInstance.getWallet(true);
                                }

                                if (wallet) {
                                    set((state) => {
                                        return {
                                            address: wallet.address,
                                            connected: true,
                                            connectionStrategy: ConnectionStrategies.WAuth,
                                            wanderInstance: null,
                                            wauthInstance: state.wauthInstance,
                                            jwk: null,
                                            provider: provider,
                                        }
                                    })
                                    triggerAuthenticatedEvent(wallet.address)
                                    return
                                }
                            } catch (error) {
                                // Check if it's a session-related error vs auth error
                                if (error.message.includes("Password required") ||
                                    error.message.includes("cancelled") ||
                                    error.message.includes("Session expired")) {
                                    // User cancelled or session issues - don't proceed with fresh login
                                    throw error;
                                }
                            }
                        }
                    }

                    // Clear any existing WAuth instance and start fresh
                    if (state.wauthInstance) {
                        state.wauthInstance.logout();
                    }
                    state.wauthInstance = new WAuth({ dev: false })

                    const data = await state.wauthInstance.connect({ provider })
                    if (!data) return

                    const wallet = await state.wauthInstance.getWallet()
                    if (!wallet) return

                    set((state) => {
                        return {
                            address: wallet.address,
                            connected: true,
                            connectionStrategy: ConnectionStrategies.WAuth,
                            wanderInstance: null,
                            wauthInstance: state.wauthInstance,
                            jwk: null,
                            provider: provider
                        }
                    })
                    triggerAuthenticatedEvent(wallet.address)
                    break;
                }
                case ConnectionStrategies.GuestUser: {
                    QuickWallet.connect()
                    const addy = await QuickWallet.getActiveAddress()
                    set((state) => {
                        return {
                            address: addy,
                            connected: true,
                            connectionStrategy: ConnectionStrategies.GuestUser,
                            wanderInstance: null,
                            jwk: null,
                            provider: null
                        }
                    })
                    break;
                }
                case ConnectionStrategies.ArWallet: {
                    if (window.arweaveWallet) {
                        if (window.arweaveWallet.walletName == "Wander Connect") {
                            set((state) => {
                                if (state.wanderInstance) state.wanderInstance.destroy();
                                return { wanderInstance: null, wauthInstance: null, jwk: null }
                            })
                        }
                        window.arweaveWallet.connect(requiredWalletPermissions as any).then(() => {
                            window.arweaveWallet.getActiveAddress().then((address) => {
                                set((state) => {
                                    if (state.connected && state.connectionStrategy !== ConnectionStrategies.ArWallet)
                                        state.actions.disconnect()
                                    window.addEventListener("walletSwitch", (e) => {
                                        set((state) => ({ address: e.detail.address }))
                                    })
                                    return {
                                        address: address,
                                        connected: true,
                                        connectionStrategy: ConnectionStrategies.ArWallet,
                                        wanderInstance: null,
                                        wauthInstance: null,
                                        jwk: null,
                                        provider: null,
                                    }
                                })
                                triggerAuthenticatedEvent(address)
                            })
                        })
                    } else {
                        throw new Error("Arweave Web Wallet not found");
                    }
                    break;
                }
                case ConnectionStrategies.WanderConnect: {
                    set((state) => {
                        if (state.connected && state.connectionStrategy !== ConnectionStrategies.WanderConnect)
                            state.actions.disconnect()
                        if (state.wanderInstance) {
                            state.wanderInstance.destroy()
                        }

                        const wander = new WanderConnect({
                            clientId: "FREE_TRIAL",
                            button: {
                                position: "static",
                                theme: "dark"
                            },
                            onAuth: (auth) => {
                                if (!!auth) {
                                    if (window.arweaveWallet) {
                                        window.arweaveWallet.connect(requiredWalletPermissions as any).then(() => {
                                            window.arweaveWallet.getActiveAddress().then((address) => {
                                                set((state) => {
                                                    return {
                                                        address: address,
                                                        connected: true,
                                                        connectionStrategy: ConnectionStrategies.WanderConnect,
                                                        wanderInstance: wander,
                                                        wauthInstance: null,
                                                        jwk: null,
                                                        provider: null,
                                                    }
                                                })
                                                wander.close();
                                                triggerAuthenticatedEvent(address)
                                            })
                                        })
                                    }
                                }
                            }
                        })
                        wander.open();
                        return { wanderInstance: wander }

                    })
                    break;
                }
            }



        },

        disconnect: (reload: boolean = false) => {
            // Trigger disconnect event before clearing wallet state
            window.dispatchEvent(new CustomEvent("subspace-wallet-disconnected"))

            set((state) => {
                if (state.wanderInstance) {
                    state.wanderInstance.destroy();
                }
                if (state.wauthInstance) {
                    state.wauthInstance.logout();
                    state.wauthInstance = null;
                }
                if (window.arweaveWallet) {
                    window.arweaveWallet.disconnect().then(() => {
                        window.removeEventListener("walletSwitch", (e) => { });
                    })
                }
                return {
                    address: "",
                    connected: false,
                    connectionStrategy: null,
                    wanderInstance: null,
                    wauthInstance: null,
                    jwk: undefined,
                    provider: null,
                }
            })
            if (reload) window.location.reload();
        }
    }
}), {
    name: "subspace-wallet-connection",
    storage: createJSONStorage(() => localStorage),
    partialize: (state: WalletState) => ({
        // address: state.connected ? state.address : "", // Only persist address if connected
        // connected: state.connected, // Persist connected state
        connectionStrategy: state.connectionStrategy,
        provider: state.provider,
        jwk: state.jwk,
    })
}));
