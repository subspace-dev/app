import { create } from "zustand";
import "arweave"
import { WanderConnect } from "@wanderapp/connect";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/web/lib/wallet";
import { createJSONStorage, persist } from "zustand/middleware";
import { WAuth, WAuthProviders } from "@wauth/sdk";
import { createSigner } from "@permaweb/aoconnect";
import type { AoSigner } from "@subspace-protocol/sdk";

export enum ConnectionStrategies {
    ArWallet = "ar_wallet",
    WanderConnect = "wander_connect",
    ScannedJWK = "scanned_jwk",
    GuestUser = "guest_user",
    WAuth = "wauth",
    // UploadedJWK = "uploaded_jwk" // TODO: add later
}

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
    getSigner: () => AoSigner | null
}

function triggerAuthenticatedEvent(address: string) {
    window.dispatchEvent(new CustomEvent("subspace-authenticated", { detail: { address } }))
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
        getSigner: () => {
            const connectionStrategy = get().connectionStrategy;
            if (!connectionStrategy) return null

            switch (connectionStrategy) {
                case ConnectionStrategies.ArWallet:
                case ConnectionStrategies.WanderConnect:
                    return createSigner(window.arweaveWallet) as AoSigner
                case ConnectionStrategies.ScannedJWK:
                    {
                        const jwk = get().jwk;
                        if (!jwk) {
                            throw new Error("ScannedJWK connection strategy requires a JWK, but none was found");
                        }
                        return createSigner(jwk) as AoSigner;
                    }
                case ConnectionStrategies.WAuth:
                    {
                        return get().wauthInstance?.getAoSigner() as any;
                    }
                case ConnectionStrategies.GuestUser:
                    {
                        console.warn("Guest user mode doesn't support signing operations. Some features may be limited.");
                        return null;
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
                                provider: null
                            }
                        })
                        triggerAuthenticatedEvent(addr)
                        break;
                    }
                case ConnectionStrategies.WAuth: {
                    if (!provider) throw new Error("Connection Strategy: WAuth requires a provider to be passed to the connect function")

                    let state = get();
                    if (state.connected && state.connectionStrategy !== ConnectionStrategies.WAuth) state.actions.disconnect();

                    if (state.wauthInstance && state.wauthInstance.isLoggedIn()) {
                        const wallet = await state.wauthInstance.getWallet()
                        if (!wallet) return state.actions.disconnect();

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
                        return
                    }

                    if (state.wauthInstance) state.wauthInstance.logout();
                    else {
                        state.wauthInstance = new WAuth({ dev: false })
                    }


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
                    // generate jwk and connect
                    break;
                }
                case ConnectionStrategies.ArWallet: {
                    if (window.arweaveWallet) {
                        if (window.arweaveWallet.walletName == "Wander Connect") {
                            set((state) => {
                                if (state.wanderInstance) state.wanderInstance.destroy();
                                return { wanderInstance: null }
                            })
                        }
                        window.arweaveWallet.connect(["SIGN_TRANSACTION", "ACCESS_ADDRESS", "ACCESS_PUBLIC_KEY"]).then(() => {
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
                                        jwk: null,
                                        provider: null
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
                                    console.log("Wander Connect auth", auth)
                                    console.log("window.arweaveWallet", window.arweaveWallet)
                                    if (window.arweaveWallet) {
                                        window.arweaveWallet.connect(["ACCESS_ADDRESS", "SIGN_TRANSACTION", "ACCESS_PUBLIC_KEY", "ACCESS_ALL_ADDRESSES"]).then(() => {
                                            window.arweaveWallet.getActiveAddress().then((address) => {
                                                set((state) => {
                                                    return {
                                                        address: address,
                                                        connected: true,
                                                        connectionStrategy: ConnectionStrategies.WanderConnect,
                                                        wanderInstance: wander,
                                                        jwk: null,
                                                        provider: null
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
                        console.log("Wander Connect open")
                        wander.open();
                        return { wanderInstance: wander }

                    })
                    break;
                }
            }



        },

        disconnect: (reload: boolean = false) => {
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
                    provider: null
                }
            })
            if (reload) window.location.reload();
        }
    }
}), {
    name: "subspace-wallet-connection",
    storage: createJSONStorage(() => localStorage),
    partialize: (state: WalletState) => ({
        // address: state.address,
        // connected: state.connected,
        connectionStrategy: state.connectionStrategy,
        provider: state.provider,
        jwk: state.jwk,
    })
}));
