import { useWallet } from "@/hooks/use-wallet"
import { useGlobalState } from "@/hooks/use-global-state"
import { useServer, useChannel, useSubspaceActions, useProfile, useProfileServers, useMember, usePrimaryName } from "@/hooks/use-subspace"
import { Subspace } from "@subspace-protocol/sdk"
import Servers from "./components/servers"
import Profile, { MyProfileDialog } from "@/components/profile"
import Channels from "@/routes/app/components/channels"
import Welcome from "@/routes/app/components/welcome"
import Messages from "@/routes/app/components/messages"
import { useEffect, useState } from "react"
import { useParams, useNavigate, useLocation } from "react-router"
import { toast } from "sonner"
import SubspaceLoader from "@/components/subspace-loader"
import { useIsMobile } from "@/hooks/use-mobile"
import DM from "@/routes/app/components/dm"
import { useProfilePolling } from "@/hooks/use-profile-polling"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SubspaceValidation } from "@subspace-protocol/sdk"
import { Camera, UserCircle } from "lucide-react"

declare global {
    interface Window {
        fetchMessageTimeout: NodeJS.Timeout
        prevAddress: string
    }
}

export default function App() {
    const { activeServerId, activeChannelId, activeFriendId, lastChannelByServer, actions: globalStateActions } = useGlobalState()
    const activeServer = useServer(activeServerId)
    const subspaceActions = useSubspaceActions()
    const { serverId, channelId, friendId } = useParams()
    const navigate = useNavigate()
    const { address } = useWallet()
    const [showLoader, setShowLoader] = useState(true)
    const [loaderAnimating, setLoaderAnimating] = useState(false)
    const { connected } = useWallet()
    const userProfile = useProfile(address)
    const joinedServers = useProfileServers(address)
    const isMobile = useIsMobile()
    const [showProfilePicturePrompt, setShowProfilePicturePrompt] = useState(false)
    const [showProfileDialog, setShowProfileDialog] = useState(false)
    const [profilePromptAlreadyShown, setProfilePromptAlreadyShown] = useState(false)
    const [showNicknamePrompt, setShowNicknamePrompt] = useState(false)
    const [nicknameInput, setNicknameInput] = useState("")
    const [isSettingNickname, setIsSettingNickname] = useState(false)
    const [nicknamePromptShownForServer, setNicknamePromptShownForServer] = useState<string | null>(null)

    // Get member and primary name info for nickname prompt
    const currentMember = useMember(activeServerId, address)
    const primaryName = usePrimaryName(address)

    // Start profile polling when user is connected
    useProfilePolling()

    useEffect(() => {
        window.toast = toast
    }, [toast])

    // Check if user needs to set a profile picture
    useEffect(() => {
        if (!connected || !userProfile || !Subspace.initialized || profilePromptAlreadyShown) return

        // Check if profile picture is missing or invalid
        const hasValidPfp = userProfile.pfp && SubspaceValidation.isValidTxId(userProfile.pfp)

        if (!hasValidPfp) {
            // Show the prompt after a brief delay to avoid jarring experience
            const timer = setTimeout(() => {
                setShowProfilePicturePrompt(true)
                setProfilePromptAlreadyShown(true)
            }, 250)

            return () => clearTimeout(timer)
        }
    }, [connected, userProfile, address])

    // Check if user needs to set a server nickname when server becomes active
    useEffect(() => {
        // Reset the shown flag when server changes
        if (activeServerId !== nicknamePromptShownForServer) {
            setNicknamePromptShownForServer(null)
        }

        if (!connected || !activeServerId || !Subspace.initialized || !currentMember) return

        // Don't show if we already showed for this server in this session
        if (nicknamePromptShownForServer === activeServerId) return

        // Check if user has nickname or primary name
        const hasNickname = currentMember.nickname && currentMember.nickname.trim().length > 0
        const hasPrimaryName = primaryName && primaryName.trim().length > 0

        if (!hasNickname && !hasPrimaryName) {
            // Show the prompt after a brief delay
            const timer = setTimeout(() => {
                setShowNicknamePrompt(true)
                setNicknamePromptShownForServer(activeServerId)
            }, 250)

            return () => clearTimeout(timer)
        }
    }, [connected, activeServerId, currentMember, primaryName, nicknamePromptShownForServer])

    useEffect(() => {
        clearTimeout(window.fetchMessageTimeout)
        if (address !== window.prevAddress && window.prevAddress && window.prevAddress !== "") {
            navigate("/app")
        }
        window.prevAddress = address
    }, [address])

    // Sync URL parameters with global state on mount and URL changes
    // URL is the single source of truth
    useEffect(() => {
        const urlServerId = serverId || ""
        const urlChannelId = channelId || ""
        const urlFriendId = friendId || ""

        if (urlServerId !== activeServerId) {
            globalStateActions.setActiveServerId(urlServerId)
        }

        if (urlChannelId !== activeChannelId) {
            globalStateActions.setActiveChannelId(urlChannelId)
        }

        if (urlFriendId !== activeFriendId) {
            globalStateActions.setActiveFriendId(urlFriendId)
        }
    }, [serverId, channelId, friendId, activeServerId, activeChannelId, activeFriendId, globalStateActions])

    // Track the last opened channel for each server
    useEffect(() => {
        if (activeServerId && activeChannelId) {
            globalStateActions.setLastChannelForServer(activeServerId, activeChannelId)
        }
    }, [activeServerId, activeChannelId, globalStateActions])

    // Redirect to /app if server is active but not in user's joined servers
    // Only redirect if we have loaded the user's profile and confirmed the server doesn't exist
    useEffect(() => {
        // Only check if we have a profile loaded (meaning joinedServers data is ready)
        if (activeServerId && userProfile && joinedServers) {
            // Check if there are any servers at all (to ensure data is loaded)
            const hasLoadedServers = Object.keys(userProfile.servers || {}).length > 0 || Object.keys(joinedServers).length > 0

            // Only redirect if data is loaded AND server is not in the list
            if ((hasLoadedServers && !joinedServers[activeServerId]) ||
                (userProfile.servers && !userProfile.servers[activeServerId])) {
                console.log("Server not found in joined servers, redirecting to /app")
                navigate("/app")
            }
        }
    }, [activeServerId, joinedServers, userProfile, navigate])

    // Note: Friend validation is now handled by the DM component itself
    // which shows a "Not Friends" UI instead of redirecting

    useEffect(() => {
        if (!activeServerId || !Subspace.initialized) {
            // If no active server or Subspace not initialized, ensure any existing loop is stopped
            return () => {
                if (window.fetchMessageTimeout) {
                    clearTimeout(window.fetchMessageTimeout)
                }
            }
        }

        async function fetchMessages() {
            try {
                // Only fetch messages if Subspace is initialized
                if (Subspace.initialized) {
                    await subspaceActions.messages.getAll(activeServerId)
                }
            } catch (e) {
                console.error(e)
            }
            finally {
                window.fetchMessageTimeout = setTimeout(() => {
                    fetchMessages()
                }, 1000)
            }
        }

        fetchMessages()

        // Cleanup function to stop the polling loop when server changes or component unmounts
        return () => {
            if (window.fetchMessageTimeout) {
                clearTimeout(window.fetchMessageTimeout)
            }
        }
    }, [activeServerId, Subspace.initialized])

    // Handle loader transition when Subspace becomes initialized
    useEffect(() => {
        if (Subspace.initialized && showLoader && !loaderAnimating) {
            setLoaderAnimating(true)
            // Wait for blur-out animation to complete before hiding loader
            setTimeout(() => {
                setShowLoader(false)
                setLoaderAnimating(false)
            }, 400) // Match the blur-out animation duration
        }
    }, [Subspace.initialized, showLoader, loaderAnimating])

    // Reset loader state when Subspace becomes uninitialized
    useEffect(() => {
        if (!Subspace.initialized && !showLoader) {
            setShowLoader(true)
            setLoaderAnimating(false)
        }
    }, [Subspace.initialized, showLoader])

    const handleSetProfilePicture = () => {
        // Close the prompt and open the profile dialog
        setShowProfilePicturePrompt(false)
        setShowProfileDialog(true)
    }

    const handleDismissPrompt = () => {
        // Dismiss the prompt
        setShowProfilePicturePrompt(false)
    }

    const handleSetNickname = async () => {
        if (!nicknameInput.trim() || !activeServerId || !address) return

        setIsSettingNickname(true)
        try {
            await subspaceActions.servers.updateMember({
                serverId: activeServerId,
                userId: address,
                nickname: nicknameInput.trim()
            })

            // Refresh member data
            await subspaceActions.servers.getMember({
                serverId: activeServerId,
                userId: address
            })

            toast.success("Nickname set successfully!")
            setShowNicknamePrompt(false)
            setNicknameInput("")
        } catch (error) {
            console.error("Failed to set nickname:", error)
            toast.error("Failed to set nickname. Please try again.")
        } finally {
            setIsSettingNickname(false)
        }
    }

    const handleDismissNicknamePrompt = () => {
        setShowNicknamePrompt(false)
        setNicknameInput("")
    }

    if (isMobile) {
        return <div className="h-screen w-screen flex items-center justify-center">
            <div className="text-sm text-muted-foreground font-ocr">Works best on desktop</div>
        </div>
    }

    // if subspace is not initialized or loader is still showing, show the loader
    if (!Subspace.initialized && connected) {
        return <SubspaceLoader isAnimatingOut={loaderAnimating} />
    }

    return <>
        {/* Profile Picture Prompt Dialog */}
        <Dialog open={showProfilePicturePrompt} onOpenChange={setShowProfilePicturePrompt}>
            <DialogContent className="max-w-md border-border">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                        <Camera size={20} />
                        Set Your Profile Picture
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground pt-2">
                        Make your profile stand out! Add a profile picture so others can recognize you in the community.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-3 pt-4">
                    <Button
                        variant="ghost"
                        onClick={handleDismissPrompt}
                        className="bg-muted hover:bg-muted/80 text-muted-foreground"
                    >
                        Maybe Later
                    </Button>
                    <Button
                        onClick={handleSetProfilePicture}
                        className="bg-primary/70 hover:bg-primary/90 text-primary-foreground"
                    >
                        Set Profile Picture
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Profile Dialog - Controlled externally */}
        <MyProfileDialog open={showProfileDialog} onOpenChange={setShowProfileDialog} />

        {/* Server Nickname Prompt Dialog */}
        <Dialog open={showNicknamePrompt} onOpenChange={setShowNicknamePrompt}>
            <DialogContent className="max-w-md border-border">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                        <UserCircle size={20} />
                        Set Your Server Nickname
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground pt-2">
                        Help others identify you on this server! Set a nickname to personalize your presence.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <label htmlFor="nickname" className="text-sm font-medium text-muted-foreground">
                            Nickname
                        </label>
                        <Input
                            id="nickname"
                            placeholder="Enter your nickname..."
                            value={nicknameInput}
                            onChange={(e) => setNicknameInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && nicknameInput.trim()) {
                                    handleSetNickname()
                                }
                            }}
                            disabled={isSettingNickname}
                            className="bg-muted border-border"
                            maxLength={32}
                        />
                        <div className="text-xs text-muted-foreground">
                            {nicknameInput.length}/32 characters
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex gap-3 pt-4">
                    <Button
                        variant="ghost"
                        onClick={handleDismissNicknamePrompt}
                        disabled={isSettingNickname}
                        className="bg-muted hover:bg-muted/80 text-muted-foreground"
                    >
                        Maybe Later
                    </Button>
                    <Button
                        onClick={handleSetNickname}
                        disabled={isSettingNickname || !nicknameInput.trim()}
                        className="bg-primary/70 hover:bg-primary/90 text-primary-foreground"
                    >
                        {isSettingNickname ? "Setting..." : "Set Nickname"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <div className="h-screen w-screen flex">
            {/* Server list */}
            <div className="border-r max-h-screen w-[72px] shrink-0">
                <Servers />
            </div>

            {/* DMs list / channels list (if server active) */}
            <div className="w-[300px] shrink-0 flex flex-col">
                <div className="grow border-b border-r rounded-br">
                    <Channels />
                </div>
                <Profile />
            </div>

            {/* Friend section / messages list (if server active or no channel selected) */}
            {friendId ? <DM friendId={friendId} /> : (!activeServer || !activeChannelId) && <Welcome />}

            {/* messages list (if server active) */}
            {activeServer && activeChannelId && <Messages />}
        </div>
    </>
}