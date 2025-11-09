import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMember, usePrimaryName, useProfile, useProfiles, useRoles, useSubspace, useSubspaceActions, useWanderTier } from "@/hooks/use-subspace";
import { useWallet } from "@/hooks/use-wallet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Avatar } from "./ui/avatar";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { FileDropzone } from "./ui/file-dropzone";
import { SubspaceValidation } from "@subspace-protocol/sdk";
import React, { useState, useRef, type HTMLAttributes } from "react";
import { cn, shortenAddress, uploadFileTurbo } from "@/lib/utils";
import alienGreen from "@/assets/subspace/alien-green.svg";
import LoginDialog from "./login-dialog";
import { ArrowLeftFromLineIcon, Edit2, Edit3, SettingsIcon, UserIcon, Save, X, Camera, Upload, Plus, Search, UserPlus2, UserCircle } from "lucide-react";
import { useGlobalState } from "@/hooks/use-global-state";
import type { PopoverContentProps } from "@radix-ui/react-popover";
import type { IMember, IRole } from "@subspace-protocol/sdk/types";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Link } from "react-router";
import { Constants } from "@/lib/constants";

export function ProfileAvatar(props: HTMLAttributes<HTMLDivElement> & { tx: string }) {
    // validate tx is a valid arweave transaction
    const valid = SubspaceValidation.isValidTxId(props.tx)

    return <Avatar {...props} className={cn("border border-primary/20 items-center justify-center !rounded w-10 h-10 p-0", props.className)} >
        {valid ? <img src={`https://arweave.net/${props.tx}`} alt={`${props.tx}`} /> : <img src={alienGreen} alt="alien" className="p-1 bg-primary/10 opacity-40" />}
    </Avatar>
}

export function MyProfileDialog({ children, open: externalOpen, onOpenChange: externalOnOpenChange }: { children?: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) {
    const [internalOpen, setInternalOpen] = useState(false)

    // Use external control if provided, otherwise use internal state
    const open = externalOpen !== undefined ? externalOpen : internalOpen
    const setOpen = externalOnOpenChange || setInternalOpen
    const [isLoading, setIsLoading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<string>("")
    const { address, connected } = useWallet()
    const profile = useProfile(address)
    const primaryName = usePrimaryName(address)
    const { actions } = useSubspace()

    // File input refs
    const bannerInputRef = useRef<HTMLInputElement>(null)
    const pfpInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [pfpFile, setPfpFile] = useState<File | null>(null)
    const [bannerFile, setBannerFile] = useState<File | null>(null)
    const [bio, setBio] = useState(profile?.bio || "")

    // Reset form when profile changes or dialog opens
    React.useEffect(() => {
        if (open && profile) {
            setBio(profile.bio || "")
        }
    }, [open, profile])

    // File handling functions
    const handleBannerClick = () => {
        bannerInputRef.current?.click()
    }

    const handlePfpClick = () => {
        pfpInputRef.current?.click()
    }

    const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setBannerFile(file)
        }
    }

    const handlePfpFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setPfpFile(file)
        }
    }

    // Get preview URLs for uploaded files
    const bannerPreviewUrl = bannerFile ? URL.createObjectURL(bannerFile) : null
    const pfpPreviewUrl = pfpFile ? URL.createObjectURL(pfpFile) : null

    // Cleanup object URLs when component unmounts or files change
    React.useEffect(() => {
        return () => {
            if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl)
            if (pfpPreviewUrl) URL.revokeObjectURL(pfpPreviewUrl)
        }
    }, [bannerPreviewUrl, pfpPreviewUrl])

    const handleSave = async () => {
        if (!connected) return

        setIsLoading(true)
        setUploadStatus("")

        try {
            const updateData: any = {}

            // Upload profile picture if changed
            if (pfpFile) {
                setUploadStatus("Uploading profile picture...")
                console.log("Uploading profile picture...")
                const pfpTxId = await uploadFileTurbo(pfpFile)
                if (pfpTxId) {
                    updateData.pfp = pfpTxId
                    console.log("Profile picture uploaded:", pfpTxId)
                } else {
                    throw new Error("Failed to upload profile picture")
                }
            }

            // Upload banner if changed
            if (bannerFile) {
                setUploadStatus("Uploading banner image...")
                console.log("Uploading banner image...")
                const bannerTxId = await uploadFileTurbo(bannerFile)
                if (bannerTxId) {
                    updateData.banner = bannerTxId
                    console.log("Banner uploaded:", bannerTxId)
                } else {
                    throw new Error("Failed to upload banner image")
                }
            }

            // Update bio if changed
            if (bio !== (profile?.bio || "")) {
                updateData.bio = bio
            }

            // Only update if there are changes
            if (Object.keys(updateData).length > 0) {
                setUploadStatus("Updating profile...")
                console.log("Updating profile with data:", updateData)
                await actions.profiles.update(updateData)
                setUploadStatus("Profile updated successfully!")

                // Brief success message before closing
                setTimeout(() => {
                    setOpen(false)
                    setUploadStatus("")
                    // Reset form
                    setPfpFile(null)
                    setBannerFile(null)
                    // Clear file inputs
                    if (bannerInputRef.current) bannerInputRef.current.value = ""
                    if (pfpInputRef.current) pfpInputRef.current.value = ""
                }, 1000)
            } else {
                // No changes, just close
                setOpen(false)
            }
        } catch (error) {
            console.error("Failed to update profile:", error)
            setUploadStatus("Failed to update profile. Please try again.")

            // Clear error message after 3 seconds
            setTimeout(() => {
                setUploadStatus("")
            }, 3000)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = () => {
        // Reset form to original values
        setBio(profile?.bio || "")
        setPfpFile(null)
        setBannerFile(null)
        setUploadStatus("")
        // Clear file inputs
        if (bannerInputRef.current) bannerInputRef.current.value = ""
        if (pfpInputRef.current) pfpInputRef.current.value = ""
        setOpen(false)
    }

    return <Dialog open={open} onOpenChange={setOpen}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border">
            <DialogHeader className="pb-4">
                <DialogTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                    <Edit2 size={20} />
                    Edit Profile
                </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
                {/* Hidden file inputs */}
                <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerFileChange}
                    className="hidden"
                />
                <input
                    ref={pfpInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePfpFileChange}
                    className="hidden"
                />

                {/* Integrated Banner and Profile Picture Section */}
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Profile</h3>

                    {/* Banner and PFP Container */}
                    <div className="relative">
                        {/* Banner */}
                        <div
                            className="relative w-full h-32 bg-gradient-to-br from-primary/20 to-muted rounded-lg overflow-hidden cursor-pointer group"
                            onClick={handleBannerClick}
                        >
                            {/* Banner Image */}
                            {(bannerPreviewUrl || profile?.banner) && (
                                <img
                                    src={bannerPreviewUrl || `https://arweave.net/${profile?.banner}`}
                                    alt="Banner"
                                    className="w-full h-full object-cover"
                                />
                            )}

                            {/* Banner Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="bg-black/60 rounded-full p-2">
                                    <Camera size={20} className="text-white" />
                                </div>
                            </div>

                            {/* Banner Upload Hint */}
                            {!bannerPreviewUrl && !profile?.banner && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center text-muted-foreground">
                                        <Upload size={24} className="mx-auto mb-1" />
                                        <div className="text-xs">Click to upload banner</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile Picture */}
                        <div
                            className="absolute -bottom-8 left-6 cursor-pointer group"
                            onClick={handlePfpClick}
                        >
                            <div className="relative">
                                {/* PFP Container */}
                                <div className="w-20 h-20 rounded border-4 border-background overflow-hidden bg-muted">
                                    {(pfpPreviewUrl || profile?.pfp) ? (
                                        <img
                                            src={pfpPreviewUrl || `https://arweave.net/${profile?.pfp}`}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <img src={alienGreen} alt="alien" className="w-12 h-12 opacity-40" />
                                        </div>
                                    )}
                                </div>

                                {/* PFP Overlay */}
                                <div className="absolute inset-0 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <div className="bg-black/60 rounded-full p-1.5">
                                        <Camera size={16} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Spacing for overlapping PFP */}
                    <div className="h-8"></div>
                </div>

                {/* Bio Section */}
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Bio</h3>
                    <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        className="min-h-24 max-h-32 resize-none bg-muted border-border"
                        maxLength={300}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                        {bio.length}/300 characters
                    </div>
                </div>
            </div>

            {/* Upload Status */}
            {uploadStatus && (
                <div className={cn(
                    "p-3 rounded-lg text-sm font-medium text-center",
                    uploadStatus.includes("Failed") || uploadStatus.includes("error")
                        ? "bg-red-900/20 text-red-400 border border-red-900/30"
                        : uploadStatus.includes("successfully")
                            ? "bg-green-900/20 text-green-400 border border-green-900/30"
                            : "bg-blue-900/20 text-blue-400 border border-blue-900/30"
                )}>
                    {uploadStatus}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <Button
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                    <X size={16} />
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isLoading || !connected}
                    className="bg-primary/70 hover:bg-primary/90 text-primary-foreground"
                >
                    <Save size={16} />
                    {isLoading ? uploadStatus || "Saving..." : "Save Changes"}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
}

export function EditServerProfileDialog({ serverId, userId, children, open: externalOpen, onOpenChange: externalOnOpenChange }: { serverId: string, userId: string, children?: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) {
    const [internalOpen, setInternalOpen] = useState(false)

    // Use external control if provided, otherwise use internal state
    const open = externalOpen !== undefined ? externalOpen : internalOpen
    const setOpen = externalOnOpenChange || setInternalOpen
    const [isLoading, setIsLoading] = useState(false)
    const subspaceActions = useSubspaceActions()
    const member = useMember(serverId, userId)
    const primaryName = usePrimaryName(userId)

    // Form state
    const [nicknameInput, setNicknameInput] = useState(member?.nickname || "")

    // Reset form when dialog opens or member changes
    React.useEffect(() => {
        if (open && member) {
            setNicknameInput(member.nickname || "")
        }
    }, [open, member])

    const handleSave = async () => {
        if (!serverId || !userId) return

        setIsLoading(true)
        try {
            // Explicitly handle empty string to unset nickname
            const trimmedNickname = nicknameInput.trim()
            const nicknameToSave = trimmedNickname === "" ? null : trimmedNickname

            await subspaceActions.servers.updateMember({
                serverId: serverId,
                userId: userId,
                nickname: nicknameToSave
            })

            // Refresh member data
            await subspaceActions.servers.getMember({
                serverId: serverId,
                userId: userId
            })

            window.toast?.success("Nickname updated successfully!")
            setOpen(false)
        } catch (error) {
            console.error("Failed to update nickname:", error)
            window.toast?.error("Failed to update nickname. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = () => {
        // Reset form to original value
        setNicknameInput(member?.nickname || "")
        setOpen(false)
    }

    return <Dialog open={open} onOpenChange={setOpen}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent className="max-w-md border-border">
            <DialogHeader className="pb-4">
                <DialogTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                    <UserCircle size={20} />
                    Edit Server Profile
                </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
                {/* Nickname Section */}
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Nickname</h3>
                    <label htmlFor="nickname-edit" className="text-sm font-medium text-muted-foreground sr-only">
                        Nickname
                    </label>
                    <Input
                        id="nickname-edit"
                        placeholder={primaryName || "Enter your nickname..."}
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSave()
                            }
                        }}
                        disabled={isLoading}
                        className="bg-muted border-border"
                        maxLength={32}
                    />
                    <div className="text-xs text-muted-foreground">
                        {nicknameInput.length}/32 characters {nicknameInput.trim() === "" && "(Empty will use primary name)"}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <Button
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="bg-muted hover:bg-muted/80 text-muted-foreground"
                >
                    <X size={16} />
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="bg-primary/70 hover:bg-primary/90 text-primary-foreground"
                >
                    <Save size={16} />
                    {isLoading ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
}

export default function Profile() {
    const { address, connected, actions: walletActions } = useWallet()
    const profile = useProfile(address)
    const primaryName = usePrimaryName(address)

    if (!connected) {
        return <LoginDialog>
            <div className="p-2 m-2 cursor-pointer hover:bg-secondary rounded flex items-center gap-2 font-ocr">
                <ProfileAvatar tx={profile?.pfp} />
                <div className="mx-auto text-center text-primary">Login to Subspace</div>
            </div>
        </LoginDialog>
    }

    if (!profile) {
        return <div className="p-2 m-2 cursor-pointer hover:bg-secondary rounded flex items-center gap-2 font-ocr animate-smooth-pulse">
            <ProfileAvatar tx={null} />
            <div className="flex flex-col gap-0.5 text-sm items-start text-primary/90">
                <div>Materializing...</div>
            </div>
        </div>
    }

    return <Popover>
        <PopoverTrigger className="p-2 m-2 cursor-pointer hover:bg-secondary rounded flex items-center gap-2 font-ocr">
            <ProfileAvatar tx={profile?.pfp} />
            <div className="flex flex-col gap-0.5 text-sm items-start text-primary/90">
                <div>{primaryName ? primaryName : shortenAddress(address)}</div>
                <div className="text-xs">{primaryName ? shortenAddress(address) : <div className="text-xs text-primary/50">You need a primary name</div>}</div>
            </div>
        </PopoverTrigger>
        <PopoverContent sideOffset={7} className="w-74 overflow-clip bg-gradient-to-br from-background/95 via-background/90 to-background/85 backdrop-blur-md border-2 border-primary/20 shadow-2xl">
            <div className="-m-2">
                <div>
                    {
                        profile?.banner ? <img src={`https://arweave.net/${profile?.banner}`} alt={`${profile?.banner}`} className="w-full h-24 object-cover" /> :
                            <div className="w-full h-24 bg-primary/10" />
                    }
                </div>
                <div className="bg-background rounded absolute left-3 top-14">
                    <ProfileAvatar tx={profile?.pfp} className="w-16 h-16" />
                </div>
                <div className="min-h-24 py-8 px-3 ">
                    <div className="font-semibold font-ocr text-primary truncate">{primaryName ? primaryName : shortenAddress(address)}</div>
                    <div className="text-xs text-primary/50 font-mono truncate">{primaryName ? shortenAddress(address) : <div className="text-xs text-primary/50">You need a primary name</div>}</div>
                    {/* badges */}
                    <div className="mt-2 text-sm">{profile?.bio}</div>
                </div>
            </div>

            {/* Discord-style menu items */}
            <div className="flex flex-col gap-1">
                <MyProfileDialog>
                    <Button
                        variant="ghost"
                        className="discord-menu-item justify-start gap-3 h-8 px-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#4752c4] rounded-sm transition-colors"
                        disabled={!connected}
                    >
                        <Edit2 size={16} /> Edit Profile
                    </Button>
                </MyProfileDialog>

                <div className="discord-separator" />

                <Link to="/app/settings">
                    <Button
                        variant="ghost"
                        className="discord-menu-item justify-start gap-3 h-8 px-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#2b2d31] rounded-sm transition-colors"
                        disabled={!connected}
                    >
                        <SettingsIcon size={16} /> Settings
                    </Button>
                </Link>

                <div className="discord-separator" />

                <Button
                    variant="ghost"
                    className="discord-menu-item justify-start gap-3 h-8 px-2 text-sm font-medium text-red-400 hover:text-white hover:bg-red-600 rounded-sm transition-colors"
                    disabled={!connected}
                    onClick={() => walletActions.disconnect()}
                >
                    <ArrowLeftFromLineIcon size={16} /> Logout
                </Button>
            </div>
        </PopoverContent>
    </Popover>
}

function RoleBadge({ role, serverId, member }: { role: IRole, serverId: string, member: IMember }) {
    const subspaceActions = useSubspaceActions()


    async function handleUnassignRole() {
        await subspaceActions.servers.unassignRole({
            serverId: serverId,
            roleId: role.id,
            userId: member.id
        })
        subspaceActions.servers.getMember({
            serverId: serverId,
            userId: member.id
        })
    }

    return <Badge variant="secondary" style={{ backgroundColor: `${role.color}20`, borderColor: `${role.color}20` }}
        className="text-xs text-primary/50 border cursor-default p-0 px-0.5 overflow-clip truncate relative group transition-all duration-300 hover:pr-3.5"
    >
        <div className="backdrop-blur px-0.5 rounded z-20 truncate max-w-64">
            {role.name}
        </div>
        <Button variant="ghost" size="icon" onClick={handleUnassignRole}
            className="absolute right-0.5 rounded-full z-0 !cursor-pointer w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out ml-1">
            <Plus className="rotate-45 p-0.5" />
        </Button>
    </Badge>
}

type ProfileBadge = {
    iconTx: string
    label: string
    url: string
    hoverText: string
}

function ProfileBadge({ badge }: { badge: ProfileBadge }) {
    return <Tooltip>
        <TooltipTrigger asChild>
            <a
                href={badge.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative cursor-pointer hover:opacity-80 transition-opacity"
            >
                <img src={`https://arweave.net/${badge.iconTx}`} alt={badge.label} className="w-5 h-5 rounded-full" />
            </a>
        </TooltipTrigger>
        <TooltipContent>
            <p>{badge.hoverText}</p>
        </TooltipContent>
    </Tooltip>
}


export function ProfilePopover(props: PopoverContentProps & { userId: string }) {
    const { userId, ...rest } = props
    const { address } = useWallet()
    const { activeServerId } = useGlobalState()
    const subspaceActions = useSubspaceActions()
    const profile = useProfile(userId)
    const myProfile = useProfile(address)
    const primaryName = usePrimaryName(userId)
    const wanderTier = useWanderTier(userId)
    const member = useMember(activeServerId, userId)
    const roles = useRoles(activeServerId)
    const memberRoles: IRole[] = Object.keys(roles || {}).filter(roleId => Object.keys(member?.roles || {}).includes(roleId)).map(roleId => roles[roleId])
    const profileBadges: ProfileBadge[] = []
    const isOwnProfile = userId === address
    const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false)

    // Check if user is already a friend or has pending request
    const friends = myProfile ? myProfile.friends : { accepted: {}, sent: {}, received: {} }
    const isFriendOrPending = userId in friends.accepted || userId in friends.sent || userId in friends.received

    if (primaryName) {
        const item: ProfileBadge = {
            iconTx: Constants.Icons.ArnsLogo,
            label: "ARNS",
            url: "https://arns.ar.io",
            hoverText: "Primary Name"
        }
        profileBadges.push(item)
    }
    if (wanderTier && wanderTier.tier) {
        const item: ProfileBadge = {
            iconTx: Constants.WanderTiers[wanderTier.tier].Icon,
            label: Constants.WanderTiers[wanderTier.tier].Label,
            url: "https://wander.app/wndr",
            hoverText: Constants.WanderTiers[wanderTier.tier].Label + " Tier User"
        }
        profileBadges.push(item)
    }

    // Refetch profile and member data when popover opens
    const handleOpenChange = (open: boolean) => {
        if (open) {
            // Refetch user profile
            subspaceActions.profiles.get(userId)

            // Refetch server member data if user is in a server
            if (activeServerId) {
                subspaceActions.servers.getMember({
                    serverId: activeServerId,
                    userId: userId
                })
            }
        }
    }

    async function handleAssignRole(roleId: string) {
        await subspaceActions.servers.assignRole({
            serverId: activeServerId,
            roleId: roleId,
            userId: userId
        })
        subspaceActions.servers.getMember({
            serverId: activeServerId,
            userId: userId
        })
    }

    async function handleSendFriendRequest() {
        console.log("Sending friend request to", userId)
        setIsSendingFriendRequest(true)
        try {
            await subspaceActions.profiles.addFriend(userId)
            await subspaceActions.profiles.get(userId)
            await subspaceActions.profiles.get(address)
            window.toast?.success("Friend request sent!")
        } catch (error) {
            console.error("Failed to send friend request:", error)
            window.toast?.error("Failed to send friend request. Please try again.")
        } finally {
            setIsSendingFriendRequest(false)
        }
    }

    return <Popover onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild className="cursor-pointer">
            {props.children}
        </PopoverTrigger>
        <PopoverContent sideOffset={7} className="w-74 overflow-clip bg-gradient-to-br from-background/95 via-background/90 to-background/85 backdrop-blur-md border-2 border-primary/20 shadow-2xl" {...rest}>
            {/* Action buttons in top right corner */}
            {isOwnProfile ? (
                <div className="absolute top-2 right-1.5 flex items-center gap-1 z-50">
                    <EditServerProfileDialog serverId={activeServerId} userId={userId}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 bg-background/20 hover:!bg-background/50 backdrop-blur pl-0.5"
                        >
                            <Edit2 size={20} className="!w-3.5 !h-3.5" />
                        </Button>
                    </EditServerProfileDialog>
                </div>
            ) : !isFriendOrPending && (
                <div className="absolute top-2 right-1.5 flex items-center gap-1 z-50">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 bg-background/20 hover:!bg-background/50 backdrop-blur pl-0.5"
                        onClick={handleSendFriendRequest}
                        disabled={isSendingFriendRequest}
                    >
                        {isSendingFriendRequest ? (
                            <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
                        ) : (
                            <UserPlus2 size={20} className="!w-3.5 !h-3.5" />
                        )}
                    </Button>
                </div>
            )}
            <div className="-m-2">
                <div>
                    {
                        profile?.banner ? <img src={`https://arweave.net/${profile?.banner}`} alt={`${profile?.banner}`} className="w-full h-24 object-cover" /> :
                            <div className="w-full h-24 bg-primary/10" />
                    }
                </div>
                <div className="absolute left-20 py-1 -translate-y-full gap-0.5 flex flex-wrap">
                    {profileBadges.map(badge => <ProfileBadge key={badge.label} badge={badge} />)}
                </div>
                <div className="bg-background rounded absolute left-3 top-14">
                    <ProfileAvatar tx={profile?.pfp} className="w-16 h-16" />
                </div>
                <div className="min-h-24 py-8 px-3 ">
                    <div className="font-semibold font-ocr text-primary truncate">{member?.nickname || primaryName || shortenAddress(userId)}</div>
                    <div className="text-xs text-primary/50 font-mono truncate">{member?.nickname && primaryName ? `${primaryName} (${shortenAddress(userId)})` : (member?.nickname || primaryName) ? shortenAddress(userId) : <div className="text-xs text-primary/50">This guy needs a primary name</div>}</div>
                    {/* badges */}
                    <div className="mt-2 text-xs">{profile?.bio}</div>
                    {/* roles */}
                    {member && <>
                        {<div className="mt-2 text-[10px] font-medium tracking-wide text-primary/50 truncate">ROLES</div>}
                        <div className="mt-0.5 text-sm flex flex-wrap gap-1 items-center">
                            {memberRoles.map(role => <RoleBadge key={role.id} role={role} serverId={activeServerId} member={member} />)}
                            {/* add role button */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="icon"
                                        className="h-4 w-4 !cursor-pointer ">
                                        <Plus className="p-0.5" strokeWidth={2} />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent side="top" className="w-64 p-2" align="center">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Role"
                                                className="pl-8 h-9 bg-background/50 border-primary/20"
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto space-y-1">
                                            {Object.values(roles || {})
                                                .filter(role => !Object.keys(member?.roles || {}).includes(role.id))
                                                .map(role => (
                                                    <div
                                                        key={role.id}
                                                        className="flex items-center gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                                                        style={{ backgroundColor: `${role.color}20`, borderColor: `${role.color}20` }}
                                                        onClick={() => {
                                                            // Handle role assignment here
                                                            handleAssignRole(role.id)
                                                        }}
                                                    >
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: role.color }}
                                                        />
                                                        <span className="text-sm">{role.name}</span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </>}
                </div>
            </div>
        </PopoverContent>
    </Popover>

}