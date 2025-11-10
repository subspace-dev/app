import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

interface GlobalState {
    activeServerId: string
    activeChannelId: string
    activeFriendId: string
    lastChannelByServer: Record<string, string> // serverId -> channelId
    subspaceFailed: boolean
    actions: {
        setActiveServerId: (serverId: string) => void
        setActiveChannelId: (channelId: string) => void
        setActiveFriendId: (friendId: string) => void
        setLastChannelForServer: (serverId: string, channelId: string) => void
        setSubspaceFailed: (failed: boolean) => void
        clear: () => void
        getLastChannelForServer: (serverId: string) => string | undefined
    }
}

export const useGlobalState = create<GlobalState>()(persist((set, get) => ({
    activeServerId: "",
    activeChannelId: "",
    activeFriendId: "",
    lastChannelByServer: {},
    subspaceFailed: false,
    actions: {
        setActiveServerId: (serverId: string) => set({ activeServerId: serverId }),
        setActiveChannelId: (channelId: string) => set({ activeChannelId: channelId }),
        setActiveFriendId: (friendId: string) => set({ activeFriendId: friendId }),
        setLastChannelForServer: (serverId: string, channelId: string) => {
            set((state) => ({
                lastChannelByServer: {
                    ...state.lastChannelByServer,
                    [serverId]: channelId
                }
            }))
        },
        setSubspaceFailed: (failed: boolean) => set({ subspaceFailed: failed }),
        clear: () => {
            console.log("🧹 Clearing global state due to wallet disconnection")
            set({
                activeServerId: "",
                activeChannelId: "",
                activeFriendId: ""
            })
        },
        getLastChannelForServer: (serverId: string) => {
            return get().lastChannelByServer[serverId]
        }
    }
}), {
    name: "subspace-global-state",
    storage: createJSONStorage(() => localStorage),
    partialize: state => ({
        activeServerId: state.activeServerId,
        activeChannelId: state.activeChannelId,
        activeFriendId: state.activeFriendId,
        lastChannelByServer: state.lastChannelByServer
    })
}))