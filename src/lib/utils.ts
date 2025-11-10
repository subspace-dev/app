import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ANT, AoANTReadable, ARIO } from "@ar.io/sdk"
import { Constants } from "@/lib/constants"
import type { JWKInterface } from "arweave/web/lib/wallet"
import Arweave from "arweave"
import { ArconnectSigner, ArweaveSigner, TurboFactory } from '@ardrive/turbo-sdk/web';
import { TIER_ID_TO_NAME, type IWanderTier } from "./types"
import imageCompression from 'browser-image-compression';
import { ca } from "date-fns/locale"


export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getRelativeTimeString(timestamp: number) {
    const now = new Date()
    // Convert timestamp to milliseconds if it's in seconds
    const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
    const messageDate = new Date(timestampMs)
    const diff = now.getTime() - timestampMs
    const diffInSeconds = Math.floor(diff / 1000)

    // Handle future timestamps or very recent messages (within 5 seconds)
    if (diffInSeconds < -5) {
        // Use user's local timezone and locale for future dates
        return new Date(timestampMs).toLocaleString()
    }

    // Treat messages within 5 seconds (past or future) as "now"
    if (diffInSeconds <= 5) {
        return "now"
    }

    // Check if message is from today (in user's local timezone)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Reset time to start of day for comparison (in user's local timezone)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    const messageDateStart = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())

    if (messageDateStart.getTime() === todayStart.getTime()) {
        // Same day - show relative time
        if (diffInSeconds < 60) {
            return "now"
        } else if (diffInSeconds < 3600) {
            return `${Math.floor(diffInSeconds / 60)}m`
        } else {
            return `${Math.floor(diffInSeconds / 3600)}h`
        }
    } else if (messageDateStart.getTime() === yesterdayStart.getTime()) {
        // Yesterday
        return "Yesterday"
    } else {
        // Different date - show absolute date using user's local timezone and locale
        return messageDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }
}

export function getDateKey(timestamp: number): string {
    // Convert timestamp to milliseconds if it's in seconds
    const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
    const date = new Date(timestampMs)

    // Return date in YYYY-MM-DD format for grouping using user's local timezone
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

export function getDateLabel(timestamp: number): string {
    // Convert timestamp to milliseconds if it's in seconds
    const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
    const messageDate = new Date(timestampMs)
    const now = new Date()

    // Reset time to start of day for comparison (in user's local timezone)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const messageDateStart = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())

    // Calculate the difference in days
    const diffInMs = todayStart.getTime() - messageDateStart.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
        return "Today"
    } else if (diffInDays === 1) {
        return "Yesterday"
    } else if (diffInDays > 1) {
        // Format using user's local timezone and locale
        return messageDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    } else {
        // Future date - format using user's local timezone and locale
        return messageDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }
}


export function shortenAddress(address?: string | null) {
    if (!address || typeof address !== "string") return "";
    const safe = String(address);
    if (safe.length <= 10) return safe;
    return safe.slice(0, 5) + "..." + safe.slice(-5);
}

export async function runGQLQuery(query: string) {
    const response = await fetch("https://arnode.asia/graphql", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/json",
        },
        "body": JSON.stringify({ query }),
        "method": "POST",
    });
    return response.json()
}

export function fileToUint8Array(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}


export async function uploadFileAR(file: File, jwk?: JWKInterface) {
    const ar = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
    });

    const data = await fileToUint8Array(file);
    const tx = await ar.createTransaction({ data }, jwk ?? "use_wallet");

    tx.addTag("Content-Type", file.type);
    tx.addTag("Name", file.name);
    tx.addTag(Constants.TagNames.AppName, Constants.TagValues.AppName);
    tx.addTag(Constants.TagNames.AppVersion, Constants.TagValues.AppVersion);
    tx.addTag(Constants.TagNames.SubspaceFunction, Constants.TagValues.UploadFileAR);

    await ar.transactions.sign(tx, jwk ? jwk : "use_wallet");
    const res = await ar.transactions.post(tx);

    if (res.status == 200) {
        return tx.id;
    } else {
        console.error("Failed to upload file to AR:", res)
        return undefined
    }
}

const compressionOptions = {
    maxSizeMB: 0.1, // Hard limit of 100KB
    maxWidthOrHeight: 1200, // Balanced resolution for quality vs size
    useWebWorker: true,
    initialQuality: 0.9, // High quality starting point
    maxIteration: 30, // More iterations to find optimal balance
    fileType: 'image/jpeg', // JPEG for better compression
    alwaysKeepResolution: false, // Allow smart resolution adjustment
    preserveExif: false, // Remove EXIF data to save space
}


export async function uploadFileTurbo(file: File, jwk?: JWKInterface, customSigner?: any, retry = false): Promise<string | undefined> {
    const signer = customSigner ? customSigner : jwk ? new ArweaveSigner(jwk) : new ArconnectSigner(window.arweaveWallet)
    try {
        const turbo = TurboFactory.authenticated({ signer, cuUrl: "https://cu.ardrive.io" })
        const res = await turbo.uploadFile({
            fileStreamFactory: () => file.stream(),
            fileSizeFactory: () => file.size,
            dataItemOpts: {
                tags: [
                    { name: Constants.TagNames.AppName, value: Constants.TagValues.AppName },
                    { name: Constants.TagNames.AppVersion, value: Constants.TagValues.AppVersion },
                    { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UploadFileTurbo },
                    { name: "Content-Type", value: file.type ?? "application/octet-stream" },
                    { name: "Name", value: file.name ?? "unknown" },
                ],
            }
        })
        return res.id;
    } catch (error) {
        console.error("Failed to upload file to Turbo:", error)
        if (retry) return undefined

        if (file.size > 100 * 1024) {
            console.warn("Retrying upload with image compression...")
            // retry upload with image Compression
            try {
                const finalFile = await imageCompression(file, compressionOptions);
                return uploadFileTurbo(finalFile, jwk, customSigner, true)
            } catch (error) {
                console.error("Image compression failed:", error)
                return undefined
            }
        } else {
            return undefined
        }

    }
}

export async function getPrimaryName(address: string) {
    const ario = ARIO.mainnet({
        // @ts-expect-error
        dryRun: false,
        cu: "https://cu.ardrive.io"
    })
    try {
        const { name } = await ario.getPrimaryName({ address })
        return name
    } catch (error) {
        console.error("No primary name found:", error)
        return null
    }
}

export async function getWanderTier(address: string): Promise<IWanderTier> {
    const url = `https://cache.wander.app/api/tier-info?address=${address}`
    const response = await fetch(url)
    const data = await response.json()
    const tier: IWanderTier = {
        balance: data.balance,
        rank: data.rank,
        tier: data.tier,
        progress: data.progress,
        snapshotTimestamp: data.snapshotTimestamp,
        totalHolders: data.totalHolders,
        tierString: TIER_ID_TO_NAME[data.tier as keyof typeof TIER_ID_TO_NAME],
    }
    return tier
}


export async function fetchSubspaceProcessId(): Promise<string> {
    const response = await fetch("https://arweave.tech/api/subspace/process")
    const data = await response.text()
    return data.trim()
}

export async function respawnSubspaceProcess() {
    const response = await fetch("https://arweave.tech/api/subspace/respawn", {
        method: "POST"
    })
    const data = await response.text()
    return data.trim()
}