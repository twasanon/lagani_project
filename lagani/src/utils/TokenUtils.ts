import { Asset } from 'expo-asset';
// Import the correct library and namespace it
import * as RNVWasm from 'react-native-webassembly'; // Use a different alias to avoid conflict

// Define the expected structure of the /prove response
interface ProveResponse {
    accessToken: string;
    refreshToken: string;
    salt1: number;
    salt2: number;
    salt3: number;
    salt4: number;
    salt5: number;
    serverTime: number;
    // ... other fields we might ignore
}

// Define the interface for the WASM module exports we need
interface WasmExports {
    cdx: (...args: number[]) => number;
    rdx: (...args: number[]) => number;
    bdx: (...args: number[]) => number;
    ndx: (...args: number[]) => number;
    mdx: (...args: number[]) => number;
    // Add other functions if the full Python code uses more
}

// Define a type for the result of the library's instantiate
type WasmInstantiateResult = Awaited<ReturnType<typeof RNVWasm.instantiate>>;

// Cache for the WASM instantiate result promise
let wasmInstantiatePromise: Promise<any> | null = null;

/**
 * Loads and instantiates the css.wasm module using react-native-webassembly.
 * Caches the promise to avoid reloading.
 * Returns the WASM Instance (as any).
 */
async function loadWasmInstance(): Promise<any> { 
    if (wasmInstantiatePromise) {
        console.log("[TokenUtils] Returning cached WASM result promise.");
        return wasmInstantiatePromise; // Return the promise for the result
    }

    console.log("[TokenUtils] Loading WASM module via react-native-webassembly...");
    // Store the promise that resolves to the WasmInstantiateResult
    const loadPromise = (async () => {
        try {
            const wasmAsset = Asset.fromModule(require('../../assets/wasm/css.wasm'));
            await wasmAsset.downloadAsync();

            if (!wasmAsset.uri) {
                throw new Error('WASM asset URI is missing after download.');
            }
            console.log(`[TokenUtils] WASM Asset URI: ${wasmAsset.uri}`);

            const response = await fetch(wasmAsset.uri);
            if (!response.ok) {
                throw new Error(`Failed to fetch WASM binary: ${response.statusText}`);
            }
            const wasmBytes = await response.arrayBuffer();
            console.log(`[TokenUtils] Fetched ${wasmBytes.byteLength} bytes of WASM data.`);

            // Instantiate using the namespaced RNVWasm.instantiate
            const wasmResult = await RNVWasm.instantiate(wasmBytes, {}); 
            if (!wasmResult?.instance?.exports) { // Check exports exist
                throw new Error('react-native-webassembly instantiate failed to return instance exports.');
            }
            console.log("[TokenUtils] WASM module instantiated successfully via react-native-webassembly.");
            return wasmResult; // Return the full result
        } catch (error: any) {
            console.error("[TokenUtils] Error loading/instantiating WASM:", error.message, error.stack);
            wasmInstantiatePromise = null; // Clear promise cache on error
            throw error;
        }
    })();

    wasmInstantiatePromise = loadPromise; // Cache the promise
    return wasmInstantiatePromise;
}

/**
 * Parses the response from /prove using WASM logic to get usable tokens.
 */
export async function parseTokenResponse(tokenResponse: ProveResponse): Promise<{ parsedAccessToken: string; parsedRefreshToken: string }> {
    console.log("[TokenUtils] Parsing token response...");
    try {
        // Get the WASM instantiate result
        const wasmResult = await loadWasmInstance(); 
        // Access exports directly, cast the exports object, not the instance
        const exports = wasmResult.instance.exports as unknown as WasmExports;

        // Ensure WASM functions exist (runtime check remains useful)
        if (!exports.cdx || !exports.rdx || !exports.bdx || !exports.ndx || !exports.mdx) {
             throw new Error('Required functions not found in WASM exports.');
        }

        console.log("[TokenUtils] Invoking WASM functions...");
        // Replicate the calls from Python's TokenParser
        const n = exports.cdx(tokenResponse.salt1, tokenResponse.salt2, tokenResponse.salt3, tokenResponse.salt4, tokenResponse.salt5);
        const l = exports.rdx(tokenResponse.salt1, tokenResponse.salt2, tokenResponse.salt4, tokenResponse.salt3, tokenResponse.salt5);
        const o = exports.bdx(tokenResponse.salt1, tokenResponse.salt2, tokenResponse.salt4, tokenResponse.salt3, tokenResponse.salt5);
        const p = exports.ndx(tokenResponse.salt1, tokenResponse.salt2, tokenResponse.salt4, tokenResponse.salt3, tokenResponse.salt5);
        const q = exports.mdx(tokenResponse.salt1, tokenResponse.salt2, tokenResponse.salt4, tokenResponse.salt3, tokenResponse.salt5);

        const a = exports.cdx(tokenResponse.salt2, tokenResponse.salt1, tokenResponse.salt3, tokenResponse.salt5, tokenResponse.salt4);
        const b = exports.rdx(tokenResponse.salt2, tokenResponse.salt1, tokenResponse.salt3, tokenResponse.salt4, tokenResponse.salt5);
        const c = exports.bdx(tokenResponse.salt2, tokenResponse.salt1, tokenResponse.salt4, tokenResponse.salt3, tokenResponse.salt5);
        const d = exports.ndx(tokenResponse.salt2, tokenResponse.salt1, tokenResponse.salt4, tokenResponse.salt3, tokenResponse.salt5);
        const e = exports.mdx(tokenResponse.salt2, tokenResponse.salt1, tokenResponse.salt4, tokenResponse.salt3, tokenResponse.salt5);

        console.log(`[TokenUtils] WASM indices calculated (n,l,o,p,q): ${n},${l},${o},${p},${q}`);
        console.log(`[TokenUtils] WASM indices calculated (a,b,c,d,e): ${a},${b},${c},${d},${e}`);

        const { accessToken, refreshToken } = tokenResponse;

        // Reconstruct tokens using JS string slicing (slice is end-exclusive)
        // Python s[x:y] corresponds to JS s.slice(x, y)
        // Python s[y+1:z] corresponds to JS s.slice(y+1, z)
        const parsedAccessToken = (
            accessToken.slice(0, n)
            + accessToken.slice(n + 1, l)
            + accessToken.slice(l + 1, o)
            + accessToken.slice(o + 1, p)
            + accessToken.slice(p + 1, q)
            + accessToken.slice(q + 1)
        );
        const parsedRefreshToken = (
            refreshToken.slice(0, a)
            + refreshToken.slice(a + 1, b)
            + refreshToken.slice(b + 1, c)
            + refreshToken.slice(c + 1, d)
            + refreshToken.slice(d + 1, e)
            + refreshToken.slice(e + 1)
        );

        console.log("[TokenUtils] Tokens reconstructed successfully.");
        // Log only lengths for security
        // console.log(`[TokenUtils] Parsed Access Token Length: ${parsedAccessToken.length}`);
        // console.log(`[TokenUtils] Parsed Refresh Token Length: ${parsedRefreshToken.length}`);

        return { parsedAccessToken, parsedRefreshToken };

    } catch (error: any) {
        console.error("[TokenUtils] Error during token parsing:", error.message, error.stack);
        throw new Error(`Failed to parse token using WASM: ${error.message}`);
    }
}

// Optional: Preload WASM on app start? Not strictly necessary with caching.
// loadWasm().catch(err => console.error("Failed to preload WASM on app start:", err)); 