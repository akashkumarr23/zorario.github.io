// Google Sheets Integration Handler for Zorario Web Forms (Secure Proxy via Google Apps Script)

const googleAppScriptUrl = 'https://script.google.com/macros/s/AKfycbyRXnZZ9hmlsdNPSdnLpfgVm0Cy2wlxGCi7Js59WCTWmqZ5pKYHD7OG5Z4Er-IEFjJU0g/exec';

/**
 * Appends a row of data to the Google Sheet securely.
 * @param {Array} rowData - Array of values to insert [Date, Name, Phone, City, Intent/Background, Message, FormName]
 */
async function appendRowToGoogleSheet(rowData) {
    try {
        // Send request to Apps Script Web App
        // Using 'text/plain' makes it a simple request, skipping CORS preflight (OPTIONS check)
        const response = await fetch(googleAppScriptUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                rowData: rowData
            })
        });

        // Apps Script redirects will be followed by the browser. 
        // We return true as long as fetch does not throw a network error.
        return true;
    } catch (error) {
        console.error('Google Sheets submission error:', error);
        throw error;
    }
}
