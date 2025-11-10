import React, { useState, useRef, useEffect, useMemo } from "react";
import { useGlobalState } from "@/hooks/use-global-state";
import { useServer, useSubspaceActions, useMembers, useRoles, useProfile, usePrimaryName, useMember } from "@/hooks/use-subspace";
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet";
import { Subspace } from "@subspace-protocol/sdk";
import { ProfileAvatar } from "@/components/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, uploadFileTurbo, shortenAddress } from "@/lib/utils";
import { SubspaceValidation, EPermissions } from "@subspace-protocol/sdk";
import type { Inputs, IMember } from "@subspace-protocol/sdk/types";
import { Camera, Upload, Save, X, Settings, ArrowLeft, Users, Shield, Hash, Info, Palette, Plus, Search, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import alienGreen from "@/assets/subspace/alien-green.svg";
import { ArconnectSigner } from "@ardrive/turbo-sdk/web";
import { QuickWallet } from "quick-wallet";

// Helper function to check if a member has any of the specified permissions
function memberHasAnyPermission(member: IMember, server: any, permissions: number[]): boolean {
    if (!member || !server || !permissions || permissions.length === 0) {
        return false;
    }

    // Accumulate permissions from all roles
    let permInt = 0;
    for (const roleId of Object.keys(member.roles || {})) {
        const role = server.roles?.[roleId];
        if (role && typeof role.permissions === 'number') {
            permInt = permInt | role.permissions;
        }
    }

    // Check for owner
    if (member.id === server.profile?.owner) {
        return true;
    }

    // Check for administrator permission (administrator has all permissions)
    if ((permInt & EPermissions.ADMINISTRATOR) === EPermissions.ADMINISTRATOR) {
        return true;
    }

    // Check if member has any of the specified permissions
    for (const permission of permissions) {
        if ((permInt & permission) === permission) {
            return true;
        }
    }
    return false;
}

// Member Item Component
function MemberItem({ member, onMemberClick, onManageRoles, onKickMember, isSelected }: {
    member: IMember,
    onMemberClick: (memberId: string) => void,
    onManageRoles: (memberId: string) => void,
    onKickMember: (memberId: string) => void,
    isSelected?: boolean
}) {
    const profile = useProfile(member.id);
    const primaryName = usePrimaryName(member.id);

    return (
        <div
            className={cn(
                "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors",
                isSelected
                    ? "bg-primary/10 border-primary/30"
                    : "bg-muted border-border hover:bg-muted/80"
            )}
            onClick={() => onMemberClick(member.id)}
        >
            <div className="flex items-center gap-3">
                <ProfileAvatar tx={profile?.pfp} className="w-10 h-10" />
                <div>
                    <div className="font-medium text-foreground">
                        {member.nickname || primaryName || shortenAddress(member.id)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {member.nickname && primaryName ? primaryName :
                            primaryName ? shortenAddress(member.id) :
                                "No primary name"} • {Object.keys(member.roles || {}).length} roles
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* <Button variant="ghost" size="sm" onClick={() => onManageRoles(member.id)}>
                    Manage Roles
                </Button> */}
                {/* <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => onKickMember(member.id)}>
                    Kick
                </Button> */}
            </div>
        </div>
    );
}

// Member Profile Section Component
function MemberProfileSection({ member, serverId }: { member: IMember, serverId: string | undefined }) {
    const profile = useProfile(member.id);
    const primaryName = usePrimaryName(member.id);
    const { address } = useWallet();
    const subspaceActions = useSubspaceActions();
    const server = useServer(serverId);
    const currentUserMember = useMember(serverId, address);

    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const [nicknameValue, setNicknameValue] = useState(member.nickname || "");
    const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);

    // Update nickname value when member data changes
    useEffect(() => {
        setNicknameValue(member.nickname || "");
    }, [member.nickname]);

    // Check if current user can edit this member's nickname
    const canEditNickname = useMemo(() => {
        if (!address || !server || !currentUserMember) return false;

        // Users can always edit their own nickname
        if (address === member.id) return true;

        // Check if current user has permission to manage nicknames
        return memberHasAnyPermission(currentUserMember, server, [
            EPermissions.MANAGE_NICKNAMES,
            EPermissions.MANAGE_MEMBERS,
            EPermissions.MANAGE_SERVER,
            EPermissions.ADMINISTRATOR
        ]);
    }, [address, member.id, currentUserMember, server]);

    const handleSaveNickname = async () => {
        if (!serverId) return;

        setIsUpdatingNickname(true);
        try {
            // Explicitly handle empty string to unset nickname
            const trimmedNickname = nicknameValue.trim();
            const nicknameToSave = trimmedNickname === "" ? null : trimmedNickname;

            await subspaceActions.servers.updateMember({
                serverId: serverId,
                userId: member.id,
                nickname: nicknameToSave
            });

            // Refresh member data
            await subspaceActions.servers.getMember({
                serverId: serverId,
                userId: member.id
            });

            // Also refresh all members to ensure consistency
            subspaceActions.servers.getAllMembers(serverId);

            setIsEditingNickname(false);
        } catch (error) {
            console.error("Failed to update nickname:", error);
        } finally {
            setIsUpdatingNickname(false);
        }
    };

    const handleCancelNickname = () => {
        setNicknameValue(member.nickname || "");
        setIsEditingNickname(false);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Profile</h4>

            {/* Profile Header */}
            <div className="flex items-start gap-4">
                <ProfileAvatar tx={profile?.pfp} className="w-16 h-16" />
                <div className="flex-1 space-y-2">
                    <div>
                        <div className="font-semibold text-foreground text-lg">
                            {member.nickname ? `${member.nickname}${primaryName ? ` (${primaryName})` : ""}` : primaryName || "No nickname or primary name"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {member.id}
                        </div>
                    </div>

                    {/* Nickname Section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-foreground">Nickname</label>
                            {canEditNickname && !isEditingNickname && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditingNickname(true)}
                                    className="h-6 px-2 text-xs"
                                >
                                    Edit
                                </Button>
                            )}
                        </div>

                        {isEditingNickname ? (
                            <div className="space-y-2">
                                <Input
                                    value={nicknameValue}
                                    onChange={(e) => setNicknameValue(e.target.value)}
                                    placeholder="Enter nickname or leave empty to unset..."
                                    className="bg-background border-border"
                                    maxLength={32}
                                    disabled={isUpdatingNickname}
                                />
                                <div className="text-xs text-muted-foreground">
                                    Leave empty to remove the nickname
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        onClick={handleSaveNickname}
                                        disabled={isUpdatingNickname}
                                        className="h-7 px-3 text-xs bg-primary/70 hover:bg-primary/90"
                                    >
                                        <Save size={12} />
                                        {isUpdatingNickname ? "Saving..." : "Save"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCancelNickname}
                                        disabled={isUpdatingNickname}
                                        className="h-7 px-3 text-xs"
                                    >
                                        <X size={12} />
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border">
                                {member.nickname || "No nickname set"}
                            </div>
                        )}
                    </div>

                    {/* Bio */}
                    {profile?.bio && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border">
                            {profile.bio}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Member Roles Section Component
function MemberRolesSection({ member, serverId }: { member: IMember, serverId: string | undefined }) {
    const roles = useRoles(serverId);
    const subspaceActions = useSubspaceActions();
    const [roleSearchQuery, setRoleSearchQuery] = useState("");

    const memberRoles = Object.keys(member.roles || {})
        .map(roleId => roles?.[roleId])
        .filter(Boolean);

    const availableRoles = Object.values(roles || {})
        .filter(role => !Object.keys(member.roles || {}).includes(role.id))
        .filter(role => role.name.toLowerCase().includes(roleSearchQuery.toLowerCase()));

    const handleAssignRole = async (roleId: string) => {
        if (!serverId) return;
        await subspaceActions.servers.assignRole({
            serverId: serverId,
            roleId: roleId,
            userId: member.id
        });
        // Refresh member data
        await subspaceActions.servers.getMember({
            serverId: serverId,
            userId: member.id
        });
        // Also refresh all members to ensure consistency
        subspaceActions.servers.getAllMembers(serverId);
    };

    const handleUnassignRole = async (roleId: string) => {
        if (!serverId) return;
        await subspaceActions.servers.unassignRole({
            serverId: serverId,
            roleId: roleId,
            userId: member.id
        });
        // Refresh member data
        await subspaceActions.servers.getMember({
            serverId: serverId,
            userId: member.id
        });
        // Also refresh all members to ensure consistency
        subspaceActions.servers.getAllMembers(serverId);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Roles ({memberRoles.length})</h4>

            {/* Current Roles */}
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                    {memberRoles.map(role => (
                        <div key={role.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded border group hover:bg-muted/70 transition-colors">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: role.color || '#6b7280' }}
                            />
                            <span className="font-medium text-sm max-w-32 truncate">{role.name}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                onClick={() => handleUnassignRole(role.id)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}

                    {/* Add Role Button */}
                    {availableRoles.length > 0 && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="h-6 w-6 !cursor-pointer">
                                    <Plus className="h-3 w-3" strokeWidth={2} />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" className="w-64 p-2" align="center">
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search roles..."
                                            value={roleSearchQuery}
                                            onChange={(e) => setRoleSearchQuery(e.target.value)}
                                            className="pl-8 h-9 bg-background/50 border-primary/20"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {availableRoles.length > 0 ? (
                                            availableRoles.map(role => (
                                                <div
                                                    key={role.id}
                                                    className="flex items-center gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer transition-colors"
                                                    style={{ backgroundColor: `${role.color}20`, borderColor: `${role.color}20` }}
                                                    onClick={() => {
                                                        handleAssignRole(role.id);
                                                        setRoleSearchQuery(""); // Clear search after assignment
                                                    }}
                                                >
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: role.color }}
                                                    />
                                                    <span className="text-sm max-w-50 truncate">{role.name}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-muted-foreground text-center py-2">
                                                {roleSearchQuery ? "No roles found" : "No available roles"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>

                {memberRoles.length === 0 && (
                    <div className="text-sm text-muted-foreground italic p-3 bg-muted/30 rounded border text-center">
                        No roles assigned
                        {availableRoles.length > 0 && " - click the + button to assign roles"}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ServerSettings() {
    const navigate = useNavigate();
    // const { activeServerId } = useGlobalState();
    const { serverId } = useParams();
    const server = useServer(serverId);
    const members = useMembers(serverId);
    const roles = useRoles(serverId);
    const { address, connected, connectionStrategy } = useWallet();
    const { servers: serverActions } = useSubspaceActions();

    // Loading and status states
    const [isLoading, setIsLoading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string>("");
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [isUpdatingSource, setIsUpdatingSource] = useState(false);

    // File input refs
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [serverName, setServerName] = useState("");
    const [serverDescription, setServerDescription] = useState("");

    // Role creation dialog state
    const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false);
    const [roleFormData, setRoleFormData] = useState<Inputs.ICreateRole>({
        serverId: serverId || "",
        roleName: "",
        roleColor: "#6b7280",
        rolePermissions: 0,
        roleOrder: 0,
        mentionable: true,
        hoist: false,
    });
    const [isCreatingRole, setIsCreatingRole] = useState(false);

    // Role selection state for split view
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);

    // Member selection state for split view
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMember, setSelectedMember] = useState<IMember | null>(null);

    // Fetch server data if not already loaded
    useEffect(() => {
        // Load members data if not already loaded
        if (serverId && !members) {
            serverActions.getAllMembers(serverId);
        }
    }, [serverId, server, members, serverActions, fetchError]);

    // Fetch profiles for all members when members data is available
    const { profiles: profileActions } = useSubspaceActions();
    useEffect(() => {
        if (members) {
            Object.values(members).forEach(member => {
                profileActions.get(member.id);
            });
        }
    }, [members, profileActions]);

    // Sync selectedMember with updated member data from global state
    useEffect(() => {
        if (selectedMemberId && members?.[selectedMemberId]) {
            setSelectedMember(members[selectedMemberId]);
        }
    }, [selectedMemberId, members]);

    // Reset form when server data changes
    useEffect(() => {
        if (server?.profile) {
            setServerName(server.profile.name || "");
            setServerDescription(server.profile.description || "");
        }
    }, [server]);

    // File handling functions
    const handleBannerClick = () => {
        bannerInputRef.current?.click();
    };

    const handleIconClick = () => {
        iconInputRef.current?.click();
    };

    const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBannerFile(file);
        }
    };

    const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIconFile(file);
        }
    };

    // Get preview URLs for uploaded files
    const bannerPreviewUrl = bannerFile ? URL.createObjectURL(bannerFile) : null;
    const iconPreviewUrl = iconFile ? URL.createObjectURL(iconFile) : null;

    // Cleanup object URLs when component unmounts or files change
    useEffect(() => {
        return () => {
            if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
            if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
        };
    }, [bannerPreviewUrl, iconPreviewUrl]);

    const handleSave = async () => {
        if (!connected || !server?.profile) return;

        setIsLoading(true);
        setUploadStatus("");

        try {
            const updateData: any = {
                serverId: serverId
            };

            let signer = undefined;
            if (connectionStrategy === ConnectionStrategies.GuestUser) {
                signer = new ArconnectSigner(QuickWallet as any)
            }

            // Upload server icon if changed
            if (iconFile) {
                setUploadStatus("Uploading server icon...");
                console.log("Uploading server icon...");
                const iconTxId = await uploadFileTurbo(iconFile, undefined, signer ? signer : null);
                if (iconTxId) {
                    updateData.serverPfp = iconTxId;
                    console.log("Server icon uploaded:", iconTxId);
                } else {
                    throw new Error("Failed to upload server icon");
                }
            }

            // Upload banner if changed
            if (bannerFile) {
                setUploadStatus("Uploading banner image...");
                console.log("Uploading banner image...");
                const bannerTxId = await uploadFileTurbo(bannerFile, undefined, signer ? signer : null);
                if (bannerTxId) {
                    updateData.serverBanner = bannerTxId;
                    console.log("Banner uploaded:", bannerTxId);
                } else {
                    throw new Error("Failed to upload banner image");
                }
            }

            // Update name if changed
            if (serverName !== (server.profile.name || "")) {
                updateData.serverName = serverName;
            }

            // Update description if changed
            if (serverDescription !== (server.profile.description || "")) {
                updateData.serverDescription = serverDescription;
            }

            // Only update if there are changes
            if (Object.keys(updateData).length > 1) { // More than just serverId
                setUploadStatus("Updating server...");
                console.log("Updating server with data:", updateData);
                await serverActions.update(updateData);
                setUploadStatus("Server updated successfully!");

                // Brief success message before navigating back
                setTimeout(() => {
                    navigate(`/app/${serverId}`);
                }, 1000);
            } else {
                // No changes, just navigate back
                navigate(`/app/${serverId}`);
            }
        } catch (error) {
            console.error("Failed to update server:", error);
            setUploadStatus("Failed to update server. Please try again.");

            // Clear error message after 3 seconds
            setTimeout(() => {
                setUploadStatus("");
            }, 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        // Reset form to original values
        setServerName(server?.profile?.name || "");
        setServerDescription(server?.profile?.description || "");
        setIconFile(null);
        setBannerFile(null);
        setUploadStatus("");
        // Clear file inputs
        if (bannerInputRef.current) bannerInputRef.current.value = "";
        if (iconInputRef.current) iconInputRef.current.value = "";
        navigate(`/app/${serverId}`);
    };

    // Role management handlers
    const handleCreateRole = () => {
        setRoleFormData({
            serverId: serverId || "",
            roleName: "",
            roleColor: "#6b7280",
            rolePermissions: 0,
            roleOrder: roles ? Object.keys(roles).length : 0,
            mentionable: true,
            hoist: false,
        });
        setShowCreateRoleDialog(true);
    };

    const handleCreateRoleSubmit = async () => {
        if (!serverId || !roleFormData.roleName.trim()) return;

        setIsCreatingRole(true);
        try {
            const result = await serverActions.createRole(roleFormData);
            if (result) {
                setShowCreateRoleDialog(false);
                setUploadStatus("Role created successfully!");
                // Refresh server data to get updated roles
                await serverActions.get(serverId);
                setTimeout(() => setUploadStatus(""), 3000);
            } else {
                setUploadStatus("Failed to create role. Please try again.");
                setTimeout(() => setUploadStatus(""), 3000);
            }
        } catch (error) {
            console.error("Error creating role:", error);
            setUploadStatus("Failed to create role. Please try again.");
            setTimeout(() => setUploadStatus(""), 3000);
        } finally {
            setIsCreatingRole(false);
        }
    };

    const handleRoleClick = (roleId: string) => {
        const role = roles?.[roleId];
        if (role) {
            setSelectedRoleId(roleId);
            setEditingRole({
                id: role.id,
                name: role.name,
                color: role.color || "#6b7280",
                permissions: role.permissions || 0,
                mentionable: role.mentionable ?? true,
                hoist: role.hoist ?? false,
            });
        }
    };

    const handleUpdateRole = async () => {
        if (!serverId || !editingRole || !selectedRoleId) return;

        setIsUpdatingRole(true);
        try {
            const updateData = {
                serverId,
                roleId: selectedRoleId,
                roleName: editingRole.name,
                roleColor: editingRole.color,
                rolePermissions: editingRole.permissions,
                mentionable: editingRole.mentionable,
                hoist: editingRole.hoist,
            };

            const result = await serverActions.updateRole(updateData);
            if (result) {
                setUploadStatus("Role updated successfully!");
                // Refresh server data to get updated roles
                await serverActions.get(serverId);
                setTimeout(() => setUploadStatus(""), 3000);
            } else {
                setUploadStatus("Failed to update role. Please try again.");
                setTimeout(() => setUploadStatus(""), 3000);
            }
        } catch (error) {
            console.error("Error updating role:", error);
            setUploadStatus("Failed to update role. Please try again.");
            setTimeout(() => setUploadStatus(""), 3000);
        } finally {
            setIsUpdatingRole(false);
        }
    };

    const handleCancelRoleEdit = () => {
        setSelectedRoleId(null);
        setEditingRole(null);
    };

    const handleMemberClick = (memberId: string) => {
        const member = members?.[memberId];
        if (member) {
            setSelectedMemberId(memberId);
            setSelectedMember(member);
        }
    };

    const handleCancelMemberView = () => {
        setSelectedMemberId(null);
        setSelectedMember(null);
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!serverId) return;

        if (confirm("Are you sure you want to delete this role? This action cannot be undone.")) {
            try {
                const result = await serverActions.deleteRole({ serverId, roleId });
                if (result) {
                    setUploadStatus("Role deleted successfully!");
                    // Refresh server data to get updated roles
                    await serverActions.get(serverId);
                    setTimeout(() => setUploadStatus(""), 3000);
                } else {
                    setUploadStatus("Failed to delete role. Please try again.");
                    setTimeout(() => setUploadStatus(""), 3000);
                }
            } catch (error) {
                console.error("Error deleting role:", error);
                setUploadStatus("Failed to delete role. Please try again.");
                setTimeout(() => setUploadStatus(""), 3000);
            }
        }
    };

    // Member management handlers
    const handleInviteMembers = () => {
        // TODO: Implement member invitation dialog
        console.log("Invite members clicked");
    };

    const handleManageRoles = (memberId: string) => {
        // TODO: Implement member role management dialog
        console.log("Manage roles clicked for member:", memberId);
    };

    const handleKickMember = (memberId: string) => {
        // TODO: Implement member kick confirmation
        console.log("Kick member clicked:", memberId);
    };

    // Channel management handlers
    const handleCreateCategory = () => {
        // TODO: Implement category creation dialog
        console.log("Create category clicked");
    };

    const handleCreateChannel = () => {
        // TODO: Implement channel creation dialog
        console.log("Create channel clicked");
    };

    const handleEditCategory = (categoryId: string) => {
        // TODO: Implement category editing dialog
        console.log("Edit category clicked:", categoryId);
    };

    const handleDeleteCategory = (categoryId: string) => {
        // TODO: Implement category deletion confirmation
        console.log("Delete category clicked:", categoryId);
    };

    const handleEditChannel = (channelId: string) => {
        // TODO: Implement channel editing dialog
        console.log("Edit channel clicked:", channelId);
    };

    const handleDeleteChannel = (channelId: string) => {
        // TODO: Implement channel deletion confirmation
        console.log("Delete channel clicked:", channelId);
    };

    const handleUpdateServerSource = async () => {
        if (!connected || !serverId) return;

        setIsUpdatingSource(true);
        setUploadStatus("");

        try {
            setUploadStatus("Updating server source...");
            console.log("Updating server source for:", serverId);

            await serverActions.updateServerSource(serverId);

            setUploadStatus("Server source updated successfully!");
            console.log("Server source updated successfully");

            // Clear success message after 3 seconds
            setTimeout(() => {
                setUploadStatus("");
            }, 3000);
        } catch (error) {
            console.error("Failed to update server source:", error);
            setUploadStatus("Failed to update server source. Please try again.");

            // Clear error message after 3 seconds
            setTimeout(() => {
                setUploadStatus("");
            }, 3000);
        } finally {
            setIsUpdatingSource(false);
        }
    };

    // Show loading or error state if server not found
    if (!server) {
        if (fetchError) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4 max-w-md">
                        <div className="text-lg text-red-400">Error Loading Server</div>
                        <div className="text-sm text-muted-foreground">{fetchError}</div>
                        <div className="flex gap-3 justify-center">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFetchError(null);
                                    if (serverId) {
                                        serverActions.get(serverId);
                                    }
                                }}
                            >
                                Try Again
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => navigate("/app")}
                            >
                                Go Back
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                    <div className="loading-spinner mx-auto"></div>
                    <div className="text-lg text-muted-foreground">Loading server...</div>
                    {serverId && (
                        <div className="text-sm text-muted-foreground/70">
                            Server ID: {serverId.slice(0, 8)}...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center gap-3 p-6 border-b border-border">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancel}
                    className="h-8 w-8"
                >
                    <ArrowLeft size={16} />
                </Button>
                <div className="flex items-center gap-2">
                    <Settings size={20} className="text-primary" />
                    <h1 className="text-xl font-semibold text-primary font-ocr">Server Settings</h1>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    {/* Tab Navigation */}
                    <div className="px-6 pt-6 pb-4 border-b border-border">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="overview" className="flex items-center gap-2">
                                <Info size={16} />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="roles" className="flex items-center gap-2">
                                <Shield size={16} />
                                Roles
                            </TabsTrigger>
                            <TabsTrigger value="members" className="flex items-center gap-2">
                                <Users size={16} />
                                Members
                            </TabsTrigger>
                            <TabsTrigger value="channels" className="flex items-center gap-2">
                                <Hash size={16} />
                                Channels
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <TabsContent value="overview" className="mt-0">
                            <div className="max-w-2xl mx-auto space-y-8">
                                {/* Hidden file inputs */}
                                <input
                                    ref={bannerInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBannerFileChange}
                                    className="hidden"
                                />
                                <input
                                    ref={iconInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleIconFileChange}
                                    className="hidden"
                                />

                                {/* Server Appearance Section */}
                                <div className="space-y-4">
                                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                        Server Appearance
                                    </h2>

                                    {/* Banner and Icon Container */}
                                    <div className="relative">
                                        {/* Banner */}
                                        <div
                                            className="relative w-full h-40 bg-gradient-to-br from-primary/20 to-muted rounded-lg overflow-hidden cursor-pointer group"
                                            onClick={handleBannerClick}
                                        >
                                            {/* Banner Image */}
                                            {(bannerPreviewUrl || server.profile.banner) && (
                                                <img
                                                    src={bannerPreviewUrl || `https://arweave.net/${server.profile.banner}`}
                                                    alt="Server Banner"
                                                    className="w-full h-full object-cover"
                                                />
                                            )}

                                            {/* Banner Overlay */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-black/60 rounded-full p-3">
                                                    <Camera size={24} className="text-white" />
                                                </div>
                                            </div>

                                            {/* Banner Upload Hint */}
                                            {!bannerPreviewUrl && !server.profile.banner && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="text-center text-muted-foreground">
                                                        <Upload size={32} className="mx-auto mb-2" />
                                                        <div className="text-sm">Click to upload server banner</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Server Icon */}
                                        <div
                                            className="absolute -bottom-10 left-8 cursor-pointer group"
                                            onClick={handleIconClick}
                                        >
                                            <div className="relative">
                                                {/* Icon Container */}
                                                <div className="w-24 h-24 rounded-lg border-4 border-background overflow-hidden bg-muted">
                                                    {(iconPreviewUrl || server.profile.pfp) ? (
                                                        <img
                                                            src={iconPreviewUrl || `https://arweave.net/${server.profile.pfp}`}
                                                            alt="Server Icon"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <img src={alienGreen} alt="alien" className="w-16 h-16 opacity-40" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Icon Overlay */}
                                                <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <div className="bg-black/60 rounded-full p-2">
                                                        <Camera size={20} className="text-white" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Spacing for overlapping icon */}
                                    <div className="h-12"></div>
                                </div>

                                {/* Server Details Section */}
                                <div className="space-y-4">
                                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                        Server Details
                                    </h2>

                                    {/* Server Name */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Server Name</label>
                                        <Input
                                            value={serverName}
                                            onChange={(e) => setServerName(e.target.value)}
                                            placeholder="Enter server name..."
                                            className="bg-muted border-border"
                                            maxLength={50}
                                        />
                                        <div className="text-xs text-muted-foreground text-right">
                                            {serverName.length}/50 characters
                                        </div>
                                    </div>

                                    {/* Server Description */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Server Description</label>
                                        <Textarea
                                            value={serverDescription}
                                            onChange={(e) => setServerDescription(e.target.value)}
                                            placeholder="Tell others what this server is about..."
                                            className="min-h-24 max-h-32 resize-none bg-muted border-border"
                                            maxLength={200}
                                        />
                                        <div className="text-xs text-muted-foreground text-right">
                                            {serverDescription.length}/200 characters
                                        </div>
                                    </div>
                                </div>

                                {/* Upload Status */}
                                {uploadStatus && (
                                    <div className={cn(
                                        "p-4 rounded-lg text-sm font-medium text-center",
                                        uploadStatus.includes("Failed") || uploadStatus.includes("error")
                                            ? "bg-red-900/20 text-red-400 border border-red-900/30"
                                            : uploadStatus.includes("successfully")
                                                ? "bg-green-900/20 text-green-400 border border-green-900/30"
                                                : "bg-blue-900/20 text-blue-400 border border-blue-900/30"
                                    )}>
                                        {uploadStatus}
                                    </div>
                                )}

                                {/* Server Source Section */}
                                <div className="space-y-4">
                                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                        Server Source
                                    </h2>

                                    <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-foreground">Version Information</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Compare your server's current version with the latest available
                                                </div>
                                            </div>
                                        </div>

                                        {/* Version Comparison */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="text-sm font-medium text-muted-foreground">Live Version</div>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "px-2 py-1 rounded text-xs font-medium",
                                                        server?.version === Subspace.sources?.server?.version
                                                            ? "bg-green-900/20 text-green-400 border border-green-900/30"
                                                            : "bg-yellow-900/20 text-yellow-400 border border-yellow-900/30"
                                                    )}>
                                                        v{server?.version || "Unknown"}
                                                    </div>
                                                    {server?.version !== Subspace.sources?.server?.version && (
                                                        <div className="text-xs text-yellow-400">Outdated</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="text-sm font-medium text-muted-foreground">Available Version</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="px-2 py-1 bg-blue-900/20 text-blue-400 border border-blue-900/30 rounded text-xs font-medium">
                                                        v{Subspace.sources?.server?.version || "1.0.0"}
                                                    </div>
                                                    {server?.version === Subspace.sources?.server?.version && (
                                                        <div className="text-xs text-green-400">Up to date</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            <strong>Server Process ID:</strong> {serverId}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-border">
                                            <div className="text-sm text-muted-foreground">
                                                {server?.version === Subspace.sources?.server?.version
                                                    ? "Your server is up to date. You can still force an update to refresh the source."
                                                    : "Update server to use the latest source code and features"
                                                }
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                                disabled={isLoading || isUpdatingSource || !connected}
                                                onClick={handleUpdateServerSource}
                                            >
                                                <Upload size={14} />
                                                {isUpdatingSource ? "Updating..." :
                                                    server?.version === Subspace.sources?.server?.version ? "Force Update" : "Update Source"}
                                            </Button>
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
                                        disabled={isLoading || !connected}
                                        className="bg-primary/70 hover:bg-primary/90 text-primary-foreground"
                                    >
                                        <Save size={16} />
                                        {isLoading ? uploadStatus || "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Roles Tab */}
                        <TabsContent value="roles" className="mt-0">
                            <div className="max-w-6xl mx-auto space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-foreground">Server Roles</h2>
                                        <p className="text-sm text-muted-foreground">Manage roles and permissions for your server</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedRoleId && (
                                            <Button variant="outline" onClick={handleCancelRoleEdit}>
                                                <X size={16} />
                                                Close
                                            </Button>
                                        )}
                                        <Button onClick={handleCreateRole} className="bg-primary/70 hover:bg-primary/90">
                                            <Shield size={16} />
                                            Create Role
                                        </Button>
                                    </div>
                                </div>

                                {/* Split View Layout */}
                                <div className={cn(
                                    "grid gap-6",
                                    selectedRoleId ? "grid-cols-2" : "grid-cols-1"
                                )}>
                                    {/* Left Panel - Roles List */}
                                    <div className="space-y-3">
                                        {roles && Object.values(roles).length > 0 ? (
                                            Object.values(roles)
                                                .sort((a, b) => (b.order || 0) - (a.order || 0)) // Sort by order descending (highest first)
                                                .map((role) => (
                                                    <div
                                                        key={role.id}
                                                        className={cn(
                                                            "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors group hover:bg-muted/80",
                                                            selectedRoleId === role.id
                                                                ? "bg-primary/10 border-primary/30"
                                                                : "bg-muted border-border hover:bg-muted/80"
                                                        )}
                                                        onClick={() => handleRoleClick(role.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-4 h-4 rounded-full"
                                                                style={{ backgroundColor: role.color || '#6b7280' }}
                                                            />
                                                            <div>
                                                                <div className="font-medium text-foreground max-w-96 truncate">{role.name}</div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    Permissions: {role.permissions || 0}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleDeleteRole(role.id)}
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-12">
                                                <Shield size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                                                <h3 className="text-lg font-medium text-foreground mb-2">No roles yet</h3>
                                                <p className="text-muted-foreground mb-4">Create your first role to manage permissions</p>
                                                <Button onClick={handleCreateRole} className="bg-primary/70 hover:bg-primary/90">
                                                    <Shield size={16} />
                                                    Create First Role
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Panel - Role Details/Edit */}
                                    {selectedRoleId && editingRole && (
                                        <div className="space-y-6 p-6 bg-muted/30 rounded-lg border border-border">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold text-foreground">Edit Role</h3>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-6 h-6 rounded-full border-2 border-background"
                                                        style={{ backgroundColor: editingRole.color }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Role Name */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-foreground">Role Name</label>
                                                    <Input
                                                        value={editingRole.name}
                                                        onChange={(e) => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="Enter role name..."
                                                        className="bg-background border-border"
                                                        maxLength={50}
                                                    />
                                                </div>

                                                {/* Role Color */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-foreground">Role Color</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="color"
                                                            value={editingRole.color}
                                                            onChange={(e) => setEditingRole(prev => ({ ...prev, color: e.target.value }))}
                                                            className="w-12 h-10 rounded border border-border bg-background cursor-pointer"
                                                        />
                                                        <Input
                                                            value={editingRole.color}
                                                            onChange={(e) => setEditingRole(prev => ({ ...prev, color: e.target.value }))}
                                                            placeholder="#6b7280"
                                                            className="bg-background border-border flex-1"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Role Options */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-sm font-medium text-foreground">Display separately</div>
                                                            <div className="text-xs text-muted-foreground">Show members with this role separately in the member list</div>
                                                        </div>
                                                        <Switch
                                                            checked={editingRole.hoist}
                                                            onCheckedChange={(checked) => setEditingRole(prev => ({ ...prev, hoist: checked }))}
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-sm font-medium text-foreground">Allow anyone to mention</div>
                                                            <div className="text-xs text-muted-foreground">Allow all members to @mention this role</div>
                                                        </div>
                                                        <Switch
                                                            checked={editingRole.mentionable}
                                                            onCheckedChange={(checked) => setEditingRole(prev => ({ ...prev, mentionable: checked }))}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Permissions */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-foreground">Permissions</label>
                                                    <Input
                                                        type="number"
                                                        value={editingRole.permissions}
                                                        onChange={(e) => setEditingRole(prev => ({ ...prev, permissions: parseInt(e.target.value) || 0 }))}
                                                        placeholder="0"
                                                        className="bg-background border-border"
                                                        min="0"
                                                    />
                                                    <div className="text-xs text-muted-foreground">
                                                        Numeric permission value (0 = no permissions)
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                                <Button
                                                    variant="ghost"
                                                    onClick={handleCancelRoleEdit}
                                                    disabled={isUpdatingRole}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={handleUpdateRole}
                                                    disabled={isUpdatingRole || !editingRole.name.trim()}
                                                    className="bg-primary/70 hover:bg-primary/90"
                                                >
                                                    <Save size={16} />
                                                    {isUpdatingRole ? "Updating..." : "Save Changes"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Members Tab */}
                        <TabsContent value="members" className="mt-0">
                            <div className="max-w-6xl mx-auto space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-foreground">Server Members</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {members ? Object.keys(members).length : 0} members in this server
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedMemberId && (
                                            <Button variant="outline" onClick={handleCancelMemberView}>
                                                <X size={16} />
                                                Close
                                            </Button>
                                        )}
                                        <Button onClick={handleInviteMembers} className="bg-primary/70 hover:bg-primary/90">
                                            <Users size={16} />
                                            Invite Members
                                        </Button>
                                    </div>
                                </div>

                                {/* Split View Layout */}
                                <div className={cn(
                                    "grid gap-6",
                                    selectedMemberId ? "grid-cols-2" : "grid-cols-1"
                                )}>
                                    {/* Left Panel - Members List */}
                                    <div className="space-y-3">
                                        {members && Object.values(members).length > 0 ? (
                                            Object.values(members).map((member) => (
                                                <MemberItem
                                                    key={member.id}
                                                    member={member}
                                                    onMemberClick={handleMemberClick}
                                                    onManageRoles={handleManageRoles}
                                                    onKickMember={handleKickMember}
                                                    isSelected={selectedMemberId === member.id}
                                                />
                                            ))
                                        ) : (
                                            <div className="text-center py-12">
                                                <Users size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                                                <h3 className="text-lg font-medium text-foreground mb-2">No members yet</h3>
                                                <p className="text-muted-foreground mb-4">Invite people to join your server</p>
                                                <Button onClick={handleInviteMembers} className="bg-primary/70 hover:bg-primary/90">
                                                    <Users size={16} />
                                                    Invite First Member
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Panel - Member Details */}
                                    {selectedMemberId && selectedMember && (
                                        <div className="space-y-6 p-6 bg-muted/30 rounded-lg border border-border">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold text-foreground">Member Details</h3>
                                            </div>

                                            {/* Member Profile Section */}
                                            <div className="space-y-4">
                                                <MemberProfileSection member={selectedMember} serverId={serverId} />
                                            </div>

                                            {/* Member Roles Section */}
                                            <div className="space-y-4">
                                                <MemberRolesSection member={selectedMember} serverId={serverId} />
                                            </div>

                                            {/* Member Actions */}
                                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                                <Button
                                                    variant="ghost"
                                                    onClick={handleCancelMemberView}
                                                >
                                                    Close
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="text-red-400 hover:text-red-300"
                                                    onClick={() => handleKickMember(selectedMember.id)}
                                                >
                                                    Kick Member
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Channels Tab */}
                        <TabsContent value="channels" className="mt-0">
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-foreground">Server Channels</h2>
                                        <p className="text-sm text-muted-foreground">Organize your server with channels and categories</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="bg-muted hover:bg-muted/80" onClick={handleCreateCategory}>
                                            Create Category
                                        </Button>
                                        <Button className="bg-primary/70 hover:bg-primary/90" onClick={handleCreateChannel}>
                                            <Hash size={16} />
                                            Create Channel
                                        </Button>
                                    </div>
                                </div>

                                {/* Channels List */}
                                <div className="space-y-4">
                                    {server?.categories && Object.values(server.categories).length > 0 ? (
                                        Object.values(server.categories).map((category) => (
                                            <div key={category.id} className="space-y-2">
                                                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border group hover:bg-muted/80 transition-colors">
                                                    <div className="font-medium text-foreground uppercase text-sm tracking-wide">
                                                        {category.name}
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleDeleteCategory(category.id)}>
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Channels in this category */}
                                                <div className="ml-4 space-y-2">
                                                    {server.channels && Object.values(server.channels)
                                                        .filter(channel => channel.category_id === category.id)
                                                        .map((channel) => (
                                                            <div key={channel.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border group hover:bg-muted/80 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <Hash size={16} className="text-muted-foreground" />
                                                                    <div>
                                                                        <div className="font-medium text-foreground">{channel.name}</div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            Channel ID: {channel.id.slice(0, 8)}...
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleDeleteChannel(channel.id)}>
                                                                        <Trash2 size={16} />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12">
                                            <Hash size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                                            <h3 className="text-lg font-medium text-foreground mb-2">No channels yet</h3>
                                            <p className="text-muted-foreground mb-4">Create categories and channels to organize your server</p>
                                            <div className="flex gap-2 justify-center">
                                                <Button variant="outline" className="bg-muted hover:bg-muted/80" onClick={handleCreateCategory}>
                                                    Create Category
                                                </Button>
                                                <Button className="bg-primary/70 hover:bg-primary/90" onClick={handleCreateChannel}>
                                                    <Hash size={16} />
                                                    Create Channel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Create Role Dialog */}
            <Dialog open={showCreateRoleDialog} onOpenChange={setShowCreateRoleDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield size={20} className="text-primary" />
                            Create New Role
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Role Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Role Name</label>
                            <Input
                                value={roleFormData.roleName}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, roleName: e.target.value }))}
                                placeholder="Enter role name..."
                                className="bg-muted border-border"
                                maxLength={50}
                            />
                        </div>

                        {/* Role Color */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Role Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={roleFormData.roleColor}
                                    onChange={(e) => setRoleFormData(prev => ({ ...prev, roleColor: e.target.value }))}
                                    className="w-12 h-10 rounded border border-border bg-muted cursor-pointer"
                                />
                                <Input
                                    value={roleFormData.roleColor}
                                    onChange={(e) => setRoleFormData(prev => ({ ...prev, roleColor: e.target.value }))}
                                    placeholder="#6b7280"
                                    className="bg-muted border-border flex-1"
                                />
                            </div>
                        </div>

                        {/* Role Options */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-foreground">Display separately</div>
                                    <div className="text-xs text-muted-foreground">Show members with this role separately in the member list</div>
                                </div>
                                <Switch
                                    checked={roleFormData.hoist}
                                    onCheckedChange={(checked) => setRoleFormData(prev => ({ ...prev, hoist: checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-foreground">Allow anyone to mention</div>
                                    <div className="text-xs text-muted-foreground">Allow all members to @mention this role</div>
                                </div>
                                <Switch
                                    checked={roleFormData.mentionable}
                                    onCheckedChange={(checked) => setRoleFormData(prev => ({ ...prev, mentionable: checked }))}
                                />
                            </div>
                        </div>

                        {/* Permissions Note */}
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">
                                <strong>Note:</strong> Advanced permissions can be configured after creating the role.
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setShowCreateRoleDialog(false)}
                            disabled={isCreatingRole}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateRoleSubmit}
                            disabled={isCreatingRole || !roleFormData.roleName.trim()}
                            className="bg-primary/70 hover:bg-primary/90"
                        >
                            {isCreatingRole ? "Creating..." : "Create Role"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}