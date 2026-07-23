// Google Sheets Integration Handler for Zorario Web Forms (Secure Proxy via Google Apps Script)

const googleAppScriptUrl = 'https://script.google.com/macros/s/AKfycbyRXnZZ9hmlsdNPSdnLpfgVm0Cy2wlxGCi7Js59WCTWmqZ5pKYHD7OG5Z4Er-IEFjJU0g/exec';

/**
 * Appends a row of data to the Google Sheet securely.
 * @param {Array} rowData - Array of values to insert [Date, Name, Phone, City, Intent/Background, Message, FormName]
 */
async function appendRowToGoogleSheet(rowData) {
    try {
        // Send request to Apps Script Web App using no-cors mode.
        // Google Apps Script redirects requests, which causes CORS violations in browsers.
        // 'no-cors' ensures the request is delivered and runs on Google's servers.
        await fetch(googleAppScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                rowData: rowData
            })
        });

        // In 'no-cors' mode, we cannot read the response, but if fetch does not throw,
        // it means the network request successfully reached Google's server and executed.
        return true;
    } catch (error) {
        console.error('Google Sheets submission error:', error);
        throw error;
    }
}
