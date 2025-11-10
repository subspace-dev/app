import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, GitBranch, Package, Code2, Zap, Github, Box, ExternalLink, Cpu, AlertTriangle, Download } from "lucide-react"
import { Link } from "react-router"
import xLogo from "@/assets/logos/x.svg"
import { Subspace } from "@subspace-protocol/sdk"
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet"
import { downloadKeyfile } from "quick-wallet"

declare const __VERSION__: string
declare const __COMMIT_HASH__: string
declare const __SDK_VERSION__: string
declare const __SDK_COMMIT_HASH__: string

export default function AppSettings() {
    const { connectionStrategy, address } = useWallet()

    const versionPairs = [
        {
            left: {
                icon: <Package className="w-5 h-5" />,
                label: "App Version",
                value: __VERSION__,
            },
            right: {
                icon: <Box className="w-5 h-5" />,
                label: "SDK Version",
                value: __SDK_VERSION__,
            }
        },
        {
            left: {
                icon: <GitBranch className="w-5 h-5" />,
                label: "App Commit Hash",
                value: __COMMIT_HASH__,
                link: `https://github.com/subspace-dev/app/commit/${__COMMIT_HASH__}`
            },
            right: {
                icon: <GitBranch className="w-5 h-5" />,
                label: "SDK Commit Hash",
                value: __SDK_COMMIT_HASH__,
                link: `https://github.com/subspace-dev/sdk/commit/${__SDK_COMMIT_HASH__}`
            }
        }
    ]

    const otherInfo = [
        {
            icon: <Code2 className="w-5 h-5" />,
            label: "React Version",
            value: "19.1.0",
        },
        {
            icon: <Zap className="w-5 h-5" />,
            label: "Vite Version",
            value: "6.3.5",
        },
        {
            icon: <Cpu className="w-5 h-5" />,
            label: "Subspace Process",
            value: Subspace.subspaceProcess,
        },
    ]

    return (
        <div className="h-screen w-full flex flex-col bg-background">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center gap-4">
                <Link to="/app">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-secondary"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-semibold font-ocr text-primary">App Settings</h1>
                    <p className="text-sm text-muted-foreground">Build information and configuration</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Build Details Card */}
                    <Card className="border-border">
                        <CardHeader>
                            <CardTitle className="font-ocr">Build Details</CardTitle>
                            <CardDescription>
                                Information about the current build of Subspace
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Version and Commit Hash Pairs */}
                                {versionPairs.map((pair, index) => (
                                    <div key={index} className="grid grid-cols-2 gap-3">
                                        {/* Left Item */}
                                        <div
                                            className={`flex flex-col p-3 rounded-lg bg-muted/50 ${pair.left.link ? 'hover:bg-muted/70 cursor-pointer group' : ''} transition-colors`}
                                            onClick={() => pair.left.link && window.open(pair.left.link, '_blank')}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="text-primary/70">
                                                    {pair.left.icon}
                                                </div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    {pair.left.label}
                                                </span>
                                                {pair.left.link && (
                                                    <ExternalLink className="w-3 h-3 text-primary/40 ml-auto group-hover:text-primary/70 transition-colors" />
                                                )}
                                            </div>
                                            <code className="text-sm bg-background px-3 py-1.5 rounded border border-primary/10 font-mono text-primary">
                                                {pair.left.value}
                                            </code>
                                        </div>

                                        {/* Right Item */}
                                        <div
                                            className={`flex flex-col p-3 rounded-lg bg-muted/50 ${pair.right.link ? 'hover:bg-muted/70 cursor-pointer group' : ''} transition-colors`}
                                            onClick={() => pair.right.link && window.open(pair.right.link, '_blank')}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="text-primary/70">
                                                    {pair.right.icon}
                                                </div>
                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    {pair.right.label}
                                                </span>
                                                {pair.right.link && (
                                                    <ExternalLink className="w-3 h-3 text-primary/40 ml-auto group-hover:text-primary/70 transition-colors" />
                                                )}
                                            </div>
                                            <code className="text-sm bg-background px-3 py-1.5 rounded border border-primary/10 font-mono text-primary">
                                                {pair.right.value}
                                            </code>
                                        </div>
                                    </div>
                                ))}

                                {/* Other Build Info */}
                                <div className=" border-border/50">
                                    {otherInfo.map((info, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 mb-3 last:mb-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-primary/70">
                                                    {info.icon}
                                                </div>
                                                <span className="font-medium text-primary/90">
                                                    {info.label}
                                                </span>
                                            </div>
                                            <code className="text-sm bg-background px-3 py-1.5 rounded border border-primary/10 font-mono text-primary">
                                                {info.value}
                                            </code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Additional Info Card */}
                    <Card className="border-border">
                        <CardHeader>
                            <CardTitle className="font-ocr">About Subspace</CardTitle>
                            <CardDescription>
                                Built on the Permaweb for censorship-resistant communication
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Subspace is an intergalactic communication app built on Arweave's permanent,
                                decentralized network. Chat in online communities without fear of censorship
                                or data loss.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <a
                                    href="https://github.com/subspace-dev"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 hover:bg-secondary"
                                    >
                                        <Github className="w-4 h-4" />
                                        Follow on GitHub
                                    </Button>
                                </a>
                                <a
                                    href="https://x.com/use_subspace"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 hover:bg-secondary"
                                    >
                                        <img src={xLogo} alt="X" className="w-4 h-4" />
                                        Follow on X @use_subspace
                                    </Button>
                                </a>
                                <a
                                    href="https://x.com/aoTheComputer"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 hover:bg-secondary"
                                    >
                                        <img src={xLogo} alt="X" className="w-4 h-4" />
                                        Built on @aoTheComputer
                                    </Button>
                                </a>
                            </div>
                        </CardContent>
                    </Card>

                    {connectionStrategy === ConnectionStrategies.GuestUser && <>
                        <Card className="border-border relative">
                            <CardHeader>
                                <CardTitle className="font-ocr flex gap-2 items-center">
                                    Guest User<span className="rounded-full bg-yellow-100/20 flex items-center justify-center p-0.5 pb-1 aspect-square w-5 h-5"><AlertTriangle className="w-4 h-4 text-yellow-300" /></span></CardTitle>
                                <CardDescription>
                                    You are currently connected as a Guest User
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    In Guest User mode, your identity is temporary and stored only in this browser.
                                    If you clear your browser data or switch devices, you will lose access to your
                                    Subspace account and messages. For a permanent, secure identity, please connect
                                    using ArConnect or another supported wallet.
                                </p>
                            </CardContent>
                            <Button size="sm" className="absolute top-4 right-4" onClick={() => downloadKeyfile(`subspace_guest_user-${address}.json`)}><Download />Save Wallet</Button>
                        </Card>
                    </>}
                </div>
            </div>
        </div>
    )
}