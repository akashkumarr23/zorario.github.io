/**
 * Zorario Certificate Verification Engine
 * Connects directly to Google Sheets (via Google Visualization API or Apps Script proxy)
 * with graceful fallback to local sample registry.
 */

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const ZORARIO_CERT_CONFIG = {
    // 1. Google Sheets ID active in Zorario PropTech
    // Direct sheet link: https://docs.google.com/spreadsheets/d/1nDhquQanD89ZA9Q6DbCazCS13WA2S9NBTK6heH5dSqA/edit
    // Tab Name: 'Certificates'
    googleSheetId: '1nDhquQanD89ZA9Q6DbCazCS13WA2S9NBTK6heH5dSqA',
    sheetName: 'Certificates',

    // 2. Google Apps Script URL (active in google-sheets-handler.js for form submissions)
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbyRXnZZ9hmlsdNPSdnLpfgVm0Cy2wlxGCi7Js59WCTWmqZ5pKYHD7OG5Z4Er-IEFjJU0g/exec',

    // 3. Fallback Sample JSON registry path (allows instant offline & test validation)
    sampleJsonPath: 'certificates-sample.json',

    // 4. Verification base URL
    baseUrl: 'https://zorario.com/verify'
};

// ── IN-MEMORY CACHE & DIAGNOSTICS ─────────────────────────────────────────────
let _certificatesCache = null;
let _sheetFetchStatus = {
    attempted: false,
    success: false,
    source: 'none',
    error: null,
    totalLoaded: 0
};

/**
 * Helper to safely extract cell text from GViz row cell object
 */
function extractCellVal(cell, fallback = '') {
    if (!cell) return fallback;
    const val = cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== undefined && cell.v !== null ? cell.v : fallback);
    return String(val).trim() || fallback;
}

/**
 * Formats track names nicely if short abbreviations are provided
 */
function formatTrack(track) {
    if (!track) return 'Internship Track';
    const lower = track.toLowerCase().trim();
    if (lower === 'dev' || lower === 'development') return 'Full-Stack & Mobile Development';
    if (lower === 'flutter') return 'Flutter & Mobile App Engineering';
    if (lower === 'web') return 'Full-Stack Web & 3D Interactive Dev';
    if (lower === 'ops' || lower === 'operations') return 'Real Estate Digital Operations';
    if (lower === 'mkt' || lower === 'marketing') return 'Growth & Content Marketing';
    if (lower === 'design' || lower === 'ui/ux') return 'UI/UX & Architectural 3D Design';
    return track;
}

/**
 * Loads all certificates from Google Sheets or sample registry
 */
async function loadCertificatesRegistry() {
    if (_certificatesCache) return _certificatesCache;

    _sheetFetchStatus.attempted = true;
    let sheetRegistry = {};

    // 1. Try Google Sheets GViz API with the configured Google Sheet
    if (ZORARIO_CERT_CONFIG.googleSheetId) {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${ZORARIO_CERT_CONFIG.googleSheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(ZORARIO_CERT_CONFIG.sheetName)}`;
            const response = await fetch(url);
            if (response.ok) {
                const text = await response.text();
                // Strip Google's JSONP wrapper: /*O_o*/ google.visualization.Query.setResponse(...);
                const start = text.indexOf('{');
                const end = text.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    const jsonStr = text.substring(start, end + 1);
                    const gvizData = JSON.parse(jsonStr);
                    const rows = gvizData?.table?.rows || [];

                    rows.forEach(row => {
                        const c = row.c;
                        if (!c) return;
                        const id = extractCellVal(c[0]).toUpperCase();
                        if (!id || id === 'CERTIFICATE ID' || id === 'CERTIFICATE_ID' || id === 'ID') return;

                        const rawTrack = extractCellVal(c[2], 'Internship Track');
                        const rawStatus = extractCellVal(c[6], 'Verified');
                        const rawPerf = extractCellVal(c[7], 'Good');
                        const rawSkills = extractCellVal(c[8]);
                        const skillsArray = rawSkills ? rawSkills.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const rawSignatory = extractCellVal(c[11], 'Akash Kumar, Founder & CEO');

                        sheetRegistry[id] = {
                            id: id,
                            name: extractCellVal(c[1], 'Internship Candidate'),
                            track: formatTrack(rawTrack),
                            college: extractCellVal(c[3], 'University'),
                            duration: extractCellVal(c[4], '3 Months'),
                            issueDate: extractCellVal(c[5], new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })),
                            status: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1),
                            performance: rawPerf.charAt(0).toUpperCase() + rawPerf.slice(1),
                            skills: skillsArray.length > 0 ? skillsArray : ['PropTech Engineering', 'Problem Solving'],
                            projects: extractCellVal(c[9], 'Production feature development for Zorario ecosystem'),
                            ppoStatus: extractCellVal(c[10], 'Completed'),
                            signatory: rawSignatory
                        };
                    });

                    _sheetFetchStatus.success = true;
                    _sheetFetchStatus.source = 'google_sheets_gviz';
                    _sheetFetchStatus.totalLoaded = Object.keys(sheetRegistry).length;
                    console.log(`✅ Zorario Verifier: Synced ${_sheetFetchStatus.totalLoaded} certificate(s) live from Google Sheet.`);
                }
            } else {
                throw new Error(`Google Sheets responded with HTTP status ${response.status}`);
            }
        } catch (err) {
            _sheetFetchStatus.error = err.message || 'CORS or restricted access';
            console.warn('⚠️ Google Sheets GViz fetch did not complete (Sheet may be Restricted/Private):', err.message);
        }
    }

    // 2. Try Apps Script GET proxy if available & GViz yielded nothing
    if (Object.keys(sheetRegistry).length === 0 && ZORARIO_CERT_CONFIG.appsScriptUrl) {
        try {
            const res = await fetch(`${ZORARIO_CERT_CONFIG.appsScriptUrl}?action=get_all_certificates`, { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                    sheetRegistry = data;
                    _sheetFetchStatus.success = true;
                    _sheetFetchStatus.source = 'apps_script_proxy';
                }
            }
        } catch (e) {
            // Apps script GET fallback
        }
    }

    // 3. Load sample JSON registry to merge or fallback
    let sampleRegistry = {};
    try {
        const sampleRes = await fetch(ZORARIO_CERT_CONFIG.sampleJsonPath);
        if (sampleRes.ok) {
            sampleRegistry = await sampleRes.json();
        }
    } catch (err) {
        console.warn('Failed to load sample certificates:', err);
    }

    // Merge: live sheet certificates take highest precedence, sample records act as fallback
    const merged = Object.assign({}, sampleRegistry, sheetRegistry);
    _certificatesCache = merged;
    return merged;
}

/**
 * Returns current diagnostics regarding Google Sheet connection
 */
function getVerificationDiagnostics() {
    return _sheetFetchStatus;
}

/**
 * Verifies a certificate by its unique ID
 * @param {string} rawId - The certificate ID entered by the user
 * @returns {Promise<Object|null>} - The certificate details or null if invalid
 */
async function verifyCertificate(rawId) {
    if (!rawId) return null;
    const cleanId = rawId.trim().toUpperCase();
    const registry = await loadCertificatesRegistry();
    return registry[cleanId] || null;
}

/**
 * Builds a direct LinkedIn "Add to Profile" URL for the certificate
 */
function getLinkedInCertificationUrl(cert) {
    if (!cert) return '#';
    const baseUrl = 'https://www.linkedin.com/profile/add';
    const params = new URLSearchParams({
        startTask: 'CERTIFICATION_NAME',
        name: `${cert.track} - Zorario PropTech Internship`,
        organizationName: 'Zorario',
        issueYear: '2025',
        issueMonth: '4',
        certUrl: `https://zorario.com/verify?id=${encodeURIComponent(cert.id)}`,
        certId: cert.id
    });
    return `${baseUrl}?${params.toString()}`;
}

/**
 * Generates an SVG / QR code URL for the certificate
 */
function getCertificateQrUrl(certId) {
    const verifyUrl = `https://zorario.com/verify?id=${encodeURIComponent(certId)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}&bgcolor=FFFFFF&color=0F2237&margin=6`;
}

