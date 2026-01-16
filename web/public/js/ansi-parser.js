/**
 * Simple ANSI escape code parser for terminal output
 * Converts ANSI codes to HTML with colors
 */
function parseAnsiToHtml(text) {
    if (!text) return '';
    
    // ANSI color codes mapping
    const colors = {
        '30': '#000000', // black
        '31': '#cd0000', // red
        '32': '#00cd00', // green
        '33': '#cdcd00', // yellow
        '34': '#0000ee', // blue
        '35': '#cd00cd', // magenta
        '36': '#00cdcd', // cyan
        '37': '#e5e5e5', // white
        '90': '#7f7f7f', // bright black
        '91': '#ff0000', // bright red
        '92': '#00ff00', // bright green
        '93': '#ffff00', // bright yellow
        '94': '#5c5cff', // bright blue
        '95': '#ff00ff', // bright magenta
        '96': '#00ffff', // bright cyan
        '97': '#ffffff', // bright white
    };
    
    let result = '';
    let i = 0;
    let currentColor = null;
    let currentBg = null;
    let bold = false;
    
    while (i < text.length) {
        if (text[i] === '\x1b' && text[i + 1] === '[') {
            // Found ANSI escape sequence
            let j = i + 2;
            let code = '';
            
            // Read the code
            while (j < text.length && text[j] !== 'm' && text[j] !== ';') {
                if (text[j] >= '0' && text[j] <= '9') {
                    code += text[j];
                }
                j++;
            }
            
            // Handle reset
            if (code === '0' || code === '') {
                if (currentColor || currentBg || bold) {
                    result += '</span>';
                }
                currentColor = null;
                currentBg = null;
                bold = false;
            } else if (code === '1') {
                // Bold
                if (currentColor || currentBg || bold) {
                    result += '</span>';
                }
                bold = true;
                result += '<span style="font-weight: bold;' + 
                    (currentColor ? ` color: ${currentColor};` : '') +
                    (currentBg ? ` background-color: ${currentBg};` : '') +
                    '">';
            } else {
                // Color code
                const colorCode = parseInt(code);
                if (colorCode >= 30 && colorCode <= 37) {
                    // Foreground color
                    if (currentColor || currentBg || bold) {
                        result += '</span>';
                    }
                    currentColor = colors[code] || null;
                    result += '<span style="' +
                        (currentColor ? `color: ${currentColor};` : '') +
                        (currentBg ? ` background-color: ${currentBg};` : '') +
                        (bold ? ' font-weight: bold;' : '') +
                        '">';
                } else if (colorCode >= 40 && colorCode <= 47) {
                    // Background color
                    if (currentColor || currentBg || bold) {
                        result += '</span>';
                    }
                    currentBg = colors[(colorCode - 10).toString()] || null;
                    result += '<span style="' +
                        (currentColor ? `color: ${currentColor};` : '') +
                        (currentBg ? ` background-color: ${currentBg};` : '') +
                        (bold ? ' font-weight: bold;' : '') +
                        '">';
                } else if (colorCode >= 90 && colorCode <= 97) {
                    // Bright foreground
                    if (currentColor || currentBg || bold) {
                        result += '</span>';
                    }
                    currentColor = colors[code] || null;
                    result += '<span style="' +
                        (currentColor ? `color: ${currentColor};` : '') +
                        (currentBg ? ` background-color: ${currentBg};` : '') +
                        (bold ? ' font-weight: bold;' : '') +
                        '">';
                }
            }
            
            // Skip to after 'm'
            i = j + 1;
        } else {
            // Regular character - escape HTML
            const char = text[i];
            if (char === '<') {
                result += '&lt;';
            } else if (char === '>') {
                result += '&gt;';
            } else if (char === '&') {
                result += '&amp;';
            } else if (char === '\n') {
                // Add <br> for line break (avoid duplicates)
                if (!result.endsWith('<br>')) {
                    result += '<br>';
                }
            } else if (char === '\r') {
                // Ignore \r (carriage return) - we handle \n for line breaks
                // Don't add anything
            } else {
                result += char;
            }
            i++;
        }
    }
    
    // Close any open spans
    if (currentColor || currentBg || bold) {
        result += '</span>';
    }
    
    return result;
}
