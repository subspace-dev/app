import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import wander from "@/assets/logos/wander.png"
import quickwallet from "@/assets/logos/quickwallet.svg"
import arweave from "@/assets/logos/arweave.svg"
import metamask from "@/assets/logos/metamask.svg"
import discord from "@/assets/logos/discord.svg"
import github from "@/assets/logos/github.svg"
import google from "@/assets/logos/google.svg"
import x from "@/assets/logos/x.svg"
import alien from "@/assets/subspace/alien-green.svg"

import { Button } from "@/components/ui/button"
import { Mail, QrCode, User2 } from "lucide-react"
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet"
import { useState, useEffect } from "react"
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import type { JWKInterface } from "arweave/web/lib/wallet";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useIsMobileDevice } from "@/hooks/use-mobile"
import { WAuthProviders } from "@wauth/sdk"
import { Link } from "react-router"
import { QuickWallet } from "quick-wallet"

const totalScanSteps = 7;

export default function LoginDialog({ children }: { children: React.ReactNode }) {
    const [scanning, setScanning] = useState(false)
    const [scannedJWK, setScannedJWK] = useState<Record<string, any>>({})
    const [scanProgress, setScanProgress] = useState(0)
    const { address, actions: walletActions, connected, connectionStrategy, wanderInstance } = useWallet()
    const isMobileDevice = useIsMobileDevice()

    function handleScan(detectedCodes: IDetectedBarcode[]) {
        const raw = detectedCodes[0]?.rawValue
        if (raw) {
            try {
                const data = JSON.parse(raw) as Record<string, any>
                const key = Object.keys(data)[0]
                const value = data[key]

                setScannedJWK(prev => {
                    const newJWK = { ...prev, [key]: value }
                    const newProgress = Object.keys(newJWK).length
                    setScanProgress(newProgress)
                    return newJWK
                })
            } catch (error) {
                console.error("Failed to parse QR code data:", error)
            }
        }
    }

    useEffect(() => {
        if (scanProgress === totalScanSteps) {
            // Add required JWK properties
            const completeJWK = {
                ...scannedJWK,
                kty: "RSA",
                e: "AQAB"
            } as JWKInterface

            // Check if all required keys are present
            const requiredKeys = ["kty", "e", "n", "d", "p", "q", "dp", "dq", "qi"]
            const allKeysPresent = requiredKeys.every(key => completeJWK[key])

            if (allKeysPresent) {
                try {
                    walletActions.connect({ strategy: ConnectionStrategies.ScannedJWK, jwk: completeJWK })
                    toast.success("Wallet connected successfully!")
                    // Reset state after successful connection
                    setScanning(false)
                    setScannedJWK({})
                    setScanProgress(0)
                } catch (error) {
                    console.error("Failed to connect with scanned JWK:", error)
                    toast.error("Failed to connect with scanned wallet")
                    // Reset scanning state on error
                    setScanning(false)
                    setScannedJWK({})
                    setScanProgress(0)
                }
            } else {
                console.error("Missing required JWK keys:", requiredKeys.filter(key => !completeJWK[key]))
                toast.error("Incomplete wallet data scanned")
                // Reset scanning state
                setScanning(false)
                setScannedJWK({})
                setScanProgress(0)
            }
        }
    }, [scanProgress, scannedJWK, walletActions.connect])

    function clickClose() {
        const closeButton = document.getElementById("close-button")
        if (closeButton) {
            closeButton.click()
        }
    }

    function handleLoginOptionClicked(strategy: ConnectionStrategies, provider?: WAuthProviders) {
        clickClose()
        if (strategy === ConnectionStrategies.ScannedJWK) {
            // walletActions.connect({ strategy: ConnectionStrategies.ScannedJWK, jwk: scannedJWK})
        } else if (strategy === ConnectionStrategies.WAuth) {
            walletActions.connect({ strategy: ConnectionStrategies.WAuth, provider: provider })
        } else if (strategy === ConnectionStrategies.ArWallet) {
            walletActions.connect({ strategy: ConnectionStrategies.ArWallet })
        } else if (strategy === ConnectionStrategies.WanderConnect) {
            walletActions.connect({ strategy: ConnectionStrategies.WanderConnect })
        } else if (strategy === ConnectionStrategies.GuestUser) {
            walletActions.connect({ strategy: ConnectionStrategies.GuestUser })
        }
    }

    return (
        <Dialog onOpenChange={(open) => {
            if (!open) {
                setScanning(false)
                setScannedJWK({})
                setScanProgress(0)
            }
        }}>
            <DialogTrigger>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-md w-[95vw] p-6 bg-gradient-to-br from-background via-background/95 to-background/90 border-2 border-primary/20 shadow-2xl backdrop-blur-sm">
                <DialogHeader className="text-center space-y-6">
                    {/* Alien Logo */}
                    <div className="flex justify-center">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/30">
                            <img src={alien} alt="alien" className="w-10 h-10 opacity-80" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <DialogTitle className="text-2xl font-freecam text-primary">
                            Connect to Subspace
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm font-ocr">
                            Choose your preferred method to join the network
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex flex-col gap-6 mt-6">
                    {scanning ? (
                        <div className="space-y-6">
                            <div className="relative">
                                <Scanner
                                    constraints={{ facingMode: "environment" }}
                                    classNames={{
                                        container: "w-full max-w-sm md:!max-w-md mx-auto flex items-center justify-center rounded-lg overflow-hidden border-2 border-primary/30"
                                    }}
                                    onScan={handleScan}
                                    formats={["qr_code"]}
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-ocr">
                                    <span className="text-primary/80">Scanning progress</span>
                                    <span className="text-primary">{scanProgress}/{totalScanSteps}</span>
                                </div>
                                <Progress value={(scanProgress / totalScanSteps) * 100} className="w-full" />
                                <div className="text-center text-xs text-primary/60 font-ocr">
                                    Scan all {totalScanSteps} QR codes from subspace on desktop
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setScanning(false)}
                                className="w-full font-ocr border-primary/30 text-primary/80 hover:bg-primary/10"
                            >
                                Cancel Scanning
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Social Login Options */}
                            {/* <div className="space-y-4">
                                <h3 className="text-sm font-ocr text-primary/80 text-center">Social Login</h3>
                                <div className="flex items-center justify-evenly gap-2">
                                    <Button
                                        variant="ghost"
                                        className="h-12 w-12 p-2 border border-primary/20 hover:border-primary/40 hover:bg-primary/10 transition-all"
                                        onClick={() => handleLoginOptionClicked(ConnectionStrategies.WAuth, WAuthProviders.Discord)}
                                    >
                                        <img src={discord} className="w-6 h-6 object-contain" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-12 w-12 p-2 border border-primary/20 hover:border-primary/40 hover:bg-primary/10 transition-all"
                                        onClick={() => handleLoginOptionClicked(ConnectionStrategies.WAuth, WAuthProviders.Github)}
                                    >
                                        <img src={github} className="w-6 h-6 object-contain invert dark:invert-0" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-12 w-12 p-2 border border-primary/20 hover:border-primary/40 hover:bg-primary/10 transition-all"
                                        onClick={() => handleLoginOptionClicked(ConnectionStrategies.WAuth, WAuthProviders.Google)}
                                    >
                                        <img src={google} className="w-6 h-6 object-contain" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-12 w-12 p-2 border border-primary/20 hover:border-primary/40 hover:bg-primary/10 transition-all"
                                        onClick={() => handleLoginOptionClicked(ConnectionStrategies.WAuth, WAuthProviders.X)}
                                    >
                                        <img src={x} className="w-6 h-6 object-contain rounded" />
                                    </Button>
                                </div>
                            </div> */}

                            {/* Separator */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-primary/20" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    {/* <span className="bg-background px-3 text-primary/60 font-ocr">or use wallet</span> */}
                                    <span className="bg-background px-3 text-primary/60 font-ocr">use wallet</span>
                                </div>
                            </div>

                            {/* Wallet Options */}
                            <div className="space-y-3">
                                {window && window.arweaveWallet && window.arweaveWallet.walletName == "ArConnect" ? (
                                    <Button
                                        variant="outline"
                                        className="w-full h-12 justify-between font-ocr border-primary/30 text-primary/80 hover:bg-primary/10 hover:border-primary/40"
                                        onClick={() => handleLoginOptionClicked(ConnectionStrategies.ArWallet)}
                                    >
                                        <span>Arweave Wallet</span>
                                        <img src={arweave} className="w-6 h-6 opacity-60 invert dark:invert-0" />
                                    </Button>
                                ) : <Link to="https://www.wander.app/download?tab=download-browser" target="_blank">
                                    <Button
                                        variant="outline"
                                        className="w-full h-12 justify-between font-ocr border-primary/30 text-primary/80 hover:bg-primary/10 hover:border-primary/40"

                                    >
                                        <span>Get Wander Wallet</span>
                                        <img src={arweave} className="w-6 h-6 opacity-60 invert dark:invert-0" />
                                    </Button>
                                </Link>}

                                <Button
                                    variant="outline"
                                    className="w-full h-12 justify-between font-ocr border-primary/30 text-primary/80 hover:bg-primary/10 hover:border-primary/40"
                                    onClick={() => {
                                        handleLoginOptionClicked(ConnectionStrategies.GuestUser)
                                    }}
                                >
                                    <span>Guest Login</span>
                                    <img src={quickwallet} className="w-6 h-6 object-contain" />
                                </Button>
                            </div>

                            {/* Development Options */}
                            {process.env.NODE_ENV === "development" && (
                                <>
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-primary/10" />
                                        </div>
                                        <div className="relative flex justify-center text-xs">
                                            <span className="bg-background px-3 text-primary/40 font-ocr">dev tools</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">

                                        <Button
                                            variant="ghost"
                                            className="w-full h-10 justify-between text-xs font-ocr border border-destructive/20 hover:bg-destructive/5 text-destructive/80"
                                            onClick={() => {
                                                walletActions.disconnect()
                                            }}
                                        >
                                            <span>Clear login</span>
                                            <span className="text-destructive/40">dev only</span>
                                        </Button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}